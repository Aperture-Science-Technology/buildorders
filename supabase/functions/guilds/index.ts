// Edge Function: authenticated CRUD for guilds and guild membership.
// service-role bypasses RLS, so authorization (ownership/role checks) is
// enforced here rather than in the database.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyToken } from 'npm:@clerk/backend@3';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, PATCH, DELETE, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

const supabaseAdmin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_SECRET_KEY') ?? '',
);

const CLERK_SECRET_KEY = Deno.env.get('CLERK_SECRET_KEY');

async function getUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  if (!CLERK_SECRET_KEY) return null;

  const token = authHeader.slice('Bearer '.length);
  try {
    // @clerk/backend v3 : verifyToken retourne les claims directement et throw en cas d'échec.
    const claims = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    return typeof claims?.sub === 'string' ? claims.sub : null;
  } catch (err) {
    console.error('Clerk token verification failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function ensureProfile(userId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, display_name: '' }, { onConflict: 'id', ignoreDuplicates: true });
  if (error) {
    console.error('Profile upsert failed:', error.message);
  }
}

async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

const SLUG_RE = /^[a-z0-9-]+$/;
const ASSIGNABLE_ROLES = ['admin', 'member'];

interface GuildRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface MemberOut {
  user_id: string;
  display_name: string;
  role: string;
}

async function getGuild(id: string): Promise<GuildRow | null> {
  const { data, error } = await supabaseAdmin.from('guilds').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as GuildRow | null;
}

async function getMemberRole(guildId: string, userId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('guild_members')
    .select('role')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? (data.role as string) : null;
}

async function getMembers(guildId: string): Promise<MemberOut[]> {
  const { data: members, error } = await supabaseAdmin
    .from('guild_members')
    .select('user_id, role')
    .eq('guild_id', guildId);
  if (error) throw error;
  if (!members || members.length === 0) return [];

  const userIds = members.map((m) => m.user_id as string);
  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name')
    .in('id', userIds);
  if (profilesError) throw profilesError;

  const nameById = new Map<string, string>();
  for (const p of profiles ?? []) nameById.set(p.id as string, (p.display_name as string) ?? '');

  return members.map((m) => ({
    user_id: m.user_id as string,
    display_name: nameById.get(m.user_id as string) ?? '',
    role: m.role as string,
  }));
}

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

async function getMemberCounts(guildIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (guildIds.length === 0) return counts;
  const { data, error } = await supabaseAdmin.from('guild_members').select('guild_id').in('guild_id', guildIds);
  if (error) throw error;
  for (const row of data ?? []) {
    const gid = row.guild_id as string;
    counts.set(gid, (counts.get(gid) ?? 0) + 1);
  }
  return counts;
}

async function handleGet(req: Request, userId: string | null): Promise<Response> {
  const { searchParams } = new URL(req.url);

  try {
    if (searchParams.get('mine') === 'true') {
      if (!userId) return json({ error: 'Unauthorized' }, 401);

      const { data: memberships, error } = await supabaseAdmin
        .from('guild_members')
        .select('guild_id, role')
        .eq('user_id', userId);
      if (error) return json({ error: error.message }, 500);

      const guildIds = (memberships ?? []).map((m) => m.guild_id as string);
      if (guildIds.length === 0) return json([], 200);

      const roleByGuild = new Map<string, string>();
      for (const m of memberships ?? []) roleByGuild.set(m.guild_id as string, m.role as string);

      const { data: guilds, error: guildsError } = await supabaseAdmin
        .from('guilds')
        .select('*')
        .in('id', guildIds)
        .order('created_at', { ascending: false });
      if (guildsError) return json({ error: guildsError.message }, 500);

      const result = await Promise.all(
        (guilds ?? []).map(async (g) => ({
          ...g,
          role: roleByGuild.get(g.id as string) ?? null,
          members: await getMembers(g.id as string),
        })),
      );
      return json(result, 200);
    }

    const id = searchParams.get('id');
    if (id) {
      const guild = await getGuild(id);
      if (!guild) return json({ error: 'Not found' }, 404);

      const role = userId ? await getMemberRole(id, userId) : null;
      const members = await getMembers(id);
      return json({ ...guild, role, members }, 200);
    }

    // No filter: public directory of every guild, lightweight (member_count
    // only — full member lists stay on the ?id= detail view).
    const { data: guilds, error } = await supabaseAdmin
      .from('guilds')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) return json({ error: error.message }, 500);

    const guildIds = (guilds ?? []).map((g) => g.id as string);
    const memberCounts = await getMemberCounts(guildIds);

    const roleByGuild = new Map<string, string>();
    if (userId && guildIds.length > 0) {
      const { data: memberships, error: membershipsError } = await supabaseAdmin
        .from('guild_members')
        .select('guild_id, role')
        .eq('user_id', userId)
        .in('guild_id', guildIds);
      if (membershipsError) return json({ error: membershipsError.message }, 500);
      for (const m of memberships ?? []) roleByGuild.set(m.guild_id as string, m.role as string);
    }

    const result = (guilds ?? []).map((g) => ({
      ...g,
      member_count: memberCounts.get(g.id as string) ?? 0,
      role: roleByGuild.get(g.id as string) ?? null,
    }));
    return json(result, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

interface CreateGuildBody {
  name?: unknown;
  slug?: unknown;
  description?: unknown;
}

async function handleCreate(userId: string, body: CreateGuildBody): Promise<Response> {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
  const description = body.description === undefined || body.description === null
    ? null
    : typeof body.description === 'string'
      ? body.description
      : undefined;

  if (!name) return json({ error: 'name is required' }, 400);
  if (!slug || !SLUG_RE.test(slug)) {
    return json({ error: 'slug must match [a-z0-9-]+' }, 400);
  }
  if (description === undefined) {
    return json({ error: 'description must be a string' }, 400);
  }

  await ensureProfile(userId);

  const { data: guild, error } = await supabaseAdmin
    .from('guilds')
    .insert({ name, slug, description, owner_id: userId })
    .select()
    .single();

  if (error) {
    if (isUniqueViolation(error)) return json({ error: 'slug already in use' }, 409);
    return json({ error: error.message }, 500);
  }

  const { error: memberError } = await supabaseAdmin
    .from('guild_members')
    .insert({ guild_id: guild.id, user_id: userId, role: 'owner' });

  if (memberError) {
    await supabaseAdmin.from('guilds').delete().eq('id', guild.id);
    return json({ error: memberError.message }, 500);
  }

  return json(
    { ...guild, role: 'owner', members: [{ user_id: userId, display_name: '', role: 'owner' }] },
    201,
  );
}

interface UpdateGuildBody {
  id?: unknown;
  name?: unknown;
  slug?: unknown;
  description?: unknown;
}

async function handleUpdate(userId: string, body: UpdateGuildBody): Promise<Response> {
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return json({ error: 'Missing "id" field' }, 400);

  try {
    const guild = await getGuild(id);
    if (!guild) return json({ error: 'Not found' }, 404);

    const role = await getMemberRole(id, userId);
    if (role !== 'owner') return json({ error: 'Forbidden' }, 403);

    const row: Record<string, unknown> = {};
    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : '';
      if (!name) return json({ error: 'name must be a non-empty string' }, 400);
      row.name = name;
    }
    if (body.slug !== undefined) {
      const slug = typeof body.slug === 'string' ? body.slug.trim() : '';
      if (!slug || !SLUG_RE.test(slug)) return json({ error: 'slug must match [a-z0-9-]+' }, 400);
      row.slug = slug;
    }
    if (body.description !== undefined) {
      if (body.description !== null && typeof body.description !== 'string') {
        return json({ error: 'description must be a string or null' }, 400);
      }
      row.description = body.description;
    }

    if (Object.keys(row).length === 0) return json({ error: 'No fields to update' }, 400);

    const { data, error } = await supabaseAdmin.from('guilds').update(row).eq('id', id).select().single();
    if (error) {
      if (isUniqueViolation(error)) return json({ error: 'slug already in use' }, 409);
      return json({ error: error.message }, 500);
    }

    return json(data, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

interface DeleteGuildBody {
  id?: unknown;
}

async function handleDelete(userId: string, body: DeleteGuildBody): Promise<Response> {
  const id = typeof body.id === 'string' ? body.id : '';
  if (!id) return json({ error: 'Missing "id" field' }, 400);

  try {
    const guild = await getGuild(id);
    if (!guild) return json({ error: 'Not found' }, 404);

    const role = await getMemberRole(id, userId);
    if (role !== 'owner') return json({ error: 'Forbidden' }, 403);

    const { error } = await supabaseAdmin.from('guilds').delete().eq('id', id);
    if (error) return json({ error: error.message }, 500);

    return json({ id }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

interface AddMemberBody {
  guild_id?: unknown;
  user_id?: unknown;
  role?: unknown;
}

async function handleAddMember(userId: string, body: AddMemberBody): Promise<Response> {
  const guildId = typeof body.guild_id === 'string' ? body.guild_id : '';
  const targetUserId = typeof body.user_id === 'string' ? body.user_id : '';
  if (!guildId || !targetUserId) return json({ error: 'guild_id and user_id are required' }, 400);

  let role = 'member';
  if (body.role !== undefined) {
    if (typeof body.role !== 'string' || !ASSIGNABLE_ROLES.includes(body.role)) {
      return json({ error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` }, 400);
    }
    role = body.role;
  }

  try {
    const guild = await getGuild(guildId);
    if (!guild) return json({ error: 'Not found' }, 404);

    const callerRole = await getMemberRole(guildId, userId);
    if (callerRole !== 'owner' && callerRole !== 'admin') return json({ error: 'Forbidden' }, 403);

    await ensureProfile(targetUserId);

    const { data, error } = await supabaseAdmin
      .from('guild_members')
      .insert({ guild_id: guildId, user_id: targetUserId, role })
      .select()
      .single();

    if (error) {
      if (isUniqueViolation(error)) return json({ error: 'User is already a member' }, 409);
      return json({ error: error.message }, 500);
    }

    return json(data, 201);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

interface RemoveMemberBody {
  guild_id?: unknown;
  user_id?: unknown;
}

async function handleRemoveMember(userId: string, body: RemoveMemberBody): Promise<Response> {
  const guildId = typeof body.guild_id === 'string' ? body.guild_id : '';
  const targetUserId = typeof body.user_id === 'string' ? body.user_id : '';
  if (!guildId || !targetUserId) return json({ error: 'guild_id and user_id are required' }, 400);

  try {
    const guild = await getGuild(guildId);
    if (!guild) return json({ error: 'Not found' }, 404);

    const callerRole = await getMemberRole(guildId, userId);
    if (callerRole !== 'owner' && callerRole !== 'admin') return json({ error: 'Forbidden' }, 403);

    const targetRole = await getMemberRole(guildId, targetUserId);
    if (targetRole === null) return json({ error: 'Not found' }, 404);
    if (targetRole === 'owner' && callerRole !== 'owner') {
      return json({ error: 'Forbidden' }, 403);
    }

    const { error } = await supabaseAdmin
      .from('guild_members')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', targetUserId);
    if (error) return json({ error: error.message }, 500);

    return json({ guild_id: guildId, user_id: targetUserId }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

interface JoinGuildBody {
  guild_id?: unknown;
}

async function handleJoin(userId: string, body: JoinGuildBody): Promise<Response> {
  const guildId = typeof body.guild_id === 'string' ? body.guild_id : '';
  if (!guildId) return json({ error: 'guild_id is required' }, 400);

  try {
    const guild = await getGuild(guildId);
    if (!guild) return json({ error: 'Not found' }, 404);

    const existingRole = await getMemberRole(guildId, userId);
    if (existingRole !== null) {
      const members = await getMembers(guildId);
      return json({ ...guild, role: existingRole, members }, 200);
    }

    await ensureProfile(userId);

    const { error } = await supabaseAdmin
      .from('guild_members')
      .insert({ guild_id: guildId, user_id: userId, role: 'member' });

    if (error && !isUniqueViolation(error)) {
      return json({ error: error.message }, 500);
    }

    const role = await getMemberRole(guildId, userId);
    const members = await getMembers(guildId);
    return json({ ...guild, role, members }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

interface LeaveGuildBody {
  guild_id?: unknown;
}

async function handleLeave(userId: string, body: LeaveGuildBody): Promise<Response> {
  const guildId = typeof body.guild_id === 'string' ? body.guild_id : '';
  if (!guildId) return json({ error: 'guild_id is required' }, 400);

  try {
    const guild = await getGuild(guildId);
    if (!guild) return json({ error: 'Not found' }, 404);

    const role = await getMemberRole(guildId, userId);
    if (role === null) return json({ guild_id: guildId }, 200);
    if (role === 'owner') {
      return json({ error: 'Le propriétaire ne peut pas quitter sa guilde' }, 400);
    }

    const { error } = await supabaseAdmin
      .from('guild_members')
      .delete()
      .eq('guild_id', guildId)
      .eq('user_id', userId);
    if (error) return json({ error: error.message }, 500);

    return json({ guild_id: guildId }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const { pathname } = new URL(req.url);
  const isMembersRoute = pathname.endsWith('/members');
  const isJoinRoute = pathname.endsWith('/join');
  const isLeaveRoute = pathname.endsWith('/leave');

  if (req.method === 'GET' && !isMembersRoute && !isJoinRoute && !isLeaveRoute) {
    // Public directory + detail reads must work without a token.
    const userId = await getUserId(req);
    return handleGet(req, userId);
  }

  const userId = await getUserId(req);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (isJoinRoute) {
    if (req.method === 'POST') {
      const body = await readJson<JoinGuildBody>(req);
      if (body === null) return json({ error: 'Invalid JSON body' }, 400);
      return handleJoin(userId, body);
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  if (isLeaveRoute) {
    if (req.method === 'POST') {
      const body = await readJson<LeaveGuildBody>(req);
      if (body === null) return json({ error: 'Invalid JSON body' }, 400);
      return handleLeave(userId, body);
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  if (isMembersRoute) {
    if (req.method === 'POST') {
      const body = await readJson<AddMemberBody>(req);
      if (body === null) return json({ error: 'Invalid JSON body' }, 400);
      return handleAddMember(userId, body);
    }
    if (req.method === 'DELETE') {
      const body = await readJson<RemoveMemberBody>(req);
      if (body === null) return json({ error: 'Invalid JSON body' }, 400);
      return handleRemoveMember(userId, body);
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  if (req.method === 'POST') {
    const body = await readJson<CreateGuildBody>(req);
    if (body === null) return json({ error: 'Invalid JSON body' }, 400);
    return handleCreate(userId, body);
  }
  if (req.method === 'PATCH') {
    const body = await readJson<UpdateGuildBody>(req);
    if (body === null) return json({ error: 'Invalid JSON body' }, 400);
    return handleUpdate(userId, body);
  }
  if (req.method === 'DELETE') {
    const body = await readJson<DeleteGuildBody>(req);
    if (body === null) return json({ error: 'Invalid JSON body' }, 400);
    return handleDelete(userId, body);
  }

  return json({ error: 'Method not allowed' }, 405);
});
