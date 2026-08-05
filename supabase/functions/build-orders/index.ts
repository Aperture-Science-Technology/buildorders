// Edge Function: authenticated CRUD + visibility-aware reads for build_orders.
// All reads and writes go through here so we can verify the caller's Clerk
// session token, enforce ownership/visibility, and touch the tables with the
// service-role key (which bypasses RLS). PostgREST direct access is no longer
// used for private/shared data.

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

interface ProfilePatchPayload {
  profile?: unknown;
  display_name?: unknown;
  avatar_url?: unknown;
}

interface BuildOrderPayload {
  id?: unknown;
  like?: unknown;
  build_id?: unknown;
  civ?: unknown;
  type?: unknown;
  sourceUrl?: unknown;
  sourceType?: unknown;
  phases?: unknown;
  notes?: unknown;
  scenarios?: unknown;
  gameModes?: unknown;
  strengths?: unknown;
  weaknesses?: unknown;
  matchupNotes?: unknown;
  difficulty?: unknown;
  layout?: unknown;
  visibility?: unknown;
}

const GAME_MODES = ['1v1', '2v2', '3v3', '4v4', 'ffa'];
const VISIBILITIES = ['public', 'private', 'shared'];

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function toRow(payload: BuildOrderPayload): Record<string, unknown> | { error: string } {
  const row: Record<string, unknown> = {};
  if (payload.civ !== undefined) row.civ = payload.civ;
  if (payload.type !== undefined) row.type = payload.type;
  if (payload.sourceUrl !== undefined) row.source_url = payload.sourceUrl;
  if (payload.sourceType !== undefined) row.source_type = payload.sourceType;
  if (payload.phases !== undefined) row.phases = payload.phases;
  if (payload.notes !== undefined) row.notes = payload.notes;
  if (payload.scenarios !== undefined) row.scenarios = payload.scenarios;

  if (payload.gameModes !== undefined) {
    const modes = sanitizeStringArray(payload.gameModes);
    if (!modes.every((mode) => GAME_MODES.includes(mode))) {
      return { error: `gameModes must only contain: ${GAME_MODES.join(', ')}` };
    }
    row.game_modes = modes;
  }

  if (payload.strengths !== undefined) {
    row.strengths = sanitizeStringArray(payload.strengths);
  }

  if (payload.weaknesses !== undefined) {
    row.weaknesses = sanitizeStringArray(payload.weaknesses);
  }

  if (payload.matchupNotes !== undefined) {
    if (payload.matchupNotes !== null) {
      if (
        !Array.isArray(payload.matchupNotes) ||
        !payload.matchupNotes.every(
          (entry) =>
            entry !== null &&
            typeof entry === 'object' &&
            typeof (entry as Record<string, unknown>).civ === 'string' &&
            typeof (entry as Record<string, unknown>).note === 'string',
        )
      ) {
        return { error: 'matchupNotes must be an array of { civ: string, note: string }' };
      }
    }
    row.matchup_notes = payload.matchupNotes;
  }

  if (payload.difficulty !== undefined) {
    if (payload.difficulty !== null) {
      if (
        typeof payload.difficulty !== 'number' ||
        !Number.isInteger(payload.difficulty) ||
        payload.difficulty < 1 ||
        payload.difficulty > 5
      ) {
        return { error: 'difficulty must be an integer between 1 and 5' };
      }
    }
    row.difficulty = payload.difficulty;
  }

  if (payload.layout !== undefined) {
    if (payload.layout !== null) {
      if (
        typeof payload.layout !== 'object' ||
        Array.isArray(payload.layout) ||
        !Object.values(payload.layout as Record<string, unknown>).every(
          (entry) =>
            entry !== null &&
            typeof entry === 'object' &&
            typeof (entry as Record<string, unknown>).x === 'number' &&
            typeof (entry as Record<string, unknown>).y === 'number',
        )
      ) {
        return { error: 'layout must be an object mapping nodeId to { x: number, y: number }' };
      }
    }
    row.layout = payload.layout;
  }

  if (payload.visibility !== undefined) {
    if (!VISIBILITIES.includes(payload.visibility as string)) {
      return { error: `visibility must be one of: ${VISIBILITIES.join(', ')}` };
    }
    row.visibility = payload.visibility;
  }

  return row;
}

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

interface OwnerInfo {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

// Joins the creator's profile onto build rows. Fail-open: a join error must
// not block reads of the builds themselves.
async function attachOwners(rows: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
  const ownerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter(Boolean))) as string[];
  if (ownerIds.length === 0) return rows;
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', ownerIds);
  if (error) return rows;
  const byId = new Map((data ?? []).map((p) => [p.id, p] as [string, OwnerInfo]));
  return rows.map((r) => ({ ...r, owner: r.owner_id ? (byId.get(r.owner_id as string) ?? null) : null }));
}

interface ClerkUserInfo {
  displayName: string;
  avatarUrl: string | null;
}

async function fetchClerkUserInfo(userId: string): Promise<ClerkUserInfo | null> {
  if (!CLERK_SECRET_KEY) return null;
  try {
    const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${CLERK_SECRET_KEY}` },
    });
    if (!response.ok) return null;
    const user = await response.json();
    const firstName = typeof user.first_name === 'string' ? user.first_name : '';
    const lastName = typeof user.last_name === 'string' ? user.last_name : '';
    const displayName = [firstName, lastName].filter(Boolean).join(' ').trim();
    const avatarUrl = typeof user.image_url === 'string' ? user.image_url : null;
    return { displayName, avatarUrl };
  } catch (err) {
    console.error('Clerk user fetch failed:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

async function ensureProfile(userId: string): Promise<void> {
  // Only fetch Clerk info for brand-new profiles: an existing row may carry a
  // display_name the user customized themselves, which must never be overwritten.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (existingError) {
    console.error('Profile lookup failed:', existingError.message);
    return;
  }
  if (existing) return;

  const clerkInfo = await fetchClerkUserInfo(userId);

  const { error } = await supabaseAdmin.from('profiles').upsert(
    { id: userId, display_name: clerkInfo?.displayName ?? '', avatar_url: clerkInfo?.avatarUrl ?? null },
    { onConflict: 'id', ignoreDuplicates: true },
  );
  if (error) {
    console.error('Profile upsert failed:', error.message);
  }
}

const MAX_DISPLAY_NAME_LENGTH = 40;

async function handlePatchProfile(userId: string, body: ProfilePatchPayload): Promise<Response> {
  const row: Record<string, unknown> = {};

  if (body.display_name !== undefined) {
    if (typeof body.display_name !== 'string') {
      return json({ error: 'display_name must be a string' }, 400);
    }
    const trimmed = body.display_name.trim();
    if (trimmed.length > MAX_DISPLAY_NAME_LENGTH) {
      return json({ error: `display_name must be at most ${MAX_DISPLAY_NAME_LENGTH} characters` }, 400);
    }
    row.display_name = trimmed;
  }

  if (body.avatar_url !== undefined) {
    if (typeof body.avatar_url !== 'string') {
      return json({ error: 'avatar_url must be a string' }, 400);
    }
    row.avatar_url = body.avatar_url;
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, ...row }, { onConflict: 'id' })
    .select('id, display_name, avatar_url, preferences')
    .single();

  if (error) return json({ error: error.message }, 500);
  return json(data, 200);
}

// Build ids shared directly with the user, or via a guild they're a member of.
async function getSharedBuildIds(userId: string): Promise<string[]> {
  const { data: memberships, error: membershipsError } = await supabaseAdmin
    .from('guild_members')
    .select('guild_id')
    .eq('user_id', userId);
  if (membershipsError) throw membershipsError;
  const guildIds = (memberships ?? []).map((row) => row.guild_id as string);

  const { data: userShares, error: userSharesError } = await supabaseAdmin
    .from('build_shares')
    .select('build_id')
    .eq('user_id', userId);
  if (userSharesError) throw userSharesError;

  let guildShares: { build_id: string }[] = [];
  if (guildIds.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('build_shares')
      .select('build_id')
      .in('guild_id', guildIds);
    if (error) throw error;
    guildShares = data ?? [];
  }

  const ids = new Set<string>();
  for (const row of userShares ?? []) ids.add(row.build_id as string);
  for (const row of guildShares) ids.add(row.build_id as string);
  return Array.from(ids);
}

async function canReadBuild(build: Record<string, unknown>, userId: string | null): Promise<boolean> {
  if (build.visibility === 'public') return true;
  if (!userId) return false;
  if (build.owner_id === userId) return true;
  const sharedIds = await getSharedBuildIds(userId);
  return sharedIds.includes(build.id as string);
}

function parseLimit(params: URLSearchParams): number {
  const raw = Number(params.get('limit'));
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_LIST_LIMIT;
  return Math.min(Math.floor(raw), MAX_LIST_LIMIT);
}

type SortOption = 'recent' | 'views' | 'likes';

function parseSort(params: URLSearchParams): SortOption {
  const raw = params.get('sort');
  return raw === 'views' || raw === 'likes' ? raw : 'recent';
}

function sortColumn(sort: SortOption): string {
  if (sort === 'views') return 'view_count';
  if (sort === 'likes') return 'like_count';
  return 'created_at';
}

// Used to re-sort the merged mixed list (public + mine + shared), since each
// sub-query is already ordered but the merge itself needs re-sorting.
function sortRows(rows: Record<string, unknown>[], sort: SortOption): Record<string, unknown>[] {
  if (sort === 'views') {
    return rows.sort((a, b) => (Number(b.view_count) || 0) - (Number(a.view_count) || 0));
  }
  if (sort === 'likes') {
    return rows.sort((a, b) => (Number(b.like_count) || 0) - (Number(a.like_count) || 0));
  }
  return rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

async function handleLikeBuild(userId: string, payload: { build_id?: unknown }): Promise<Response> {
  const buildId = payload.build_id;
  if (typeof buildId !== 'string' || buildId.length === 0) {
    return json({ error: 'Missing "build_id" field' }, 400);
  }

  const { data: build, error: fetchError } = await supabaseAdmin
    .from('build_orders')
    .select('*')
    .eq('id', buildId)
    .maybeSingle();
  if (fetchError) return json({ error: fetchError.message }, 500);
  if (!build || !(await canReadBuild(build, userId))) {
    return json({ error: 'Not found' }, 404);
  }

  const { error: insertError } = await supabaseAdmin
    .from('build_likes')
    .insert({ build_id: buildId, user_id: userId });

  if (insertError) {
    // Unique violation: already liked, idempotent success without a re-increment.
    if (insertError.code === '23505') {
      return json({ liked: true, like_count: Number(build.like_count) || 0 }, 200);
    }
    return json({ error: insertError.message }, 500);
  }

  const newCount = (Number(build.like_count) || 0) + 1;
  const { error: updateError } = await supabaseAdmin
    .from('build_orders')
    .update({ like_count: newCount })
    .eq('id', buildId);
  if (updateError) return json({ error: updateError.message }, 500);

  return json({ liked: true, like_count: newCount }, 200);
}

async function handleUnlikeBuild(userId: string, buildId: string): Promise<Response> {
  const { data: existingLike, error: likeFetchError } = await supabaseAdmin
    .from('build_likes')
    .select('build_id')
    .eq('build_id', buildId)
    .eq('user_id', userId)
    .maybeSingle();
  if (likeFetchError) return json({ error: likeFetchError.message }, 500);

  const { data: build, error: buildFetchError } = await supabaseAdmin
    .from('build_orders')
    .select('like_count')
    .eq('id', buildId)
    .maybeSingle();
  if (buildFetchError) return json({ error: buildFetchError.message }, 500);
  if (!build) return json({ error: 'Not found' }, 404);

  if (!existingLike) {
    return json({ liked: false, like_count: Number(build.like_count) || 0 }, 200);
  }

  const { error: deleteError } = await supabaseAdmin
    .from('build_likes')
    .delete()
    .eq('build_id', buildId)
    .eq('user_id', userId);
  if (deleteError) return json({ error: deleteError.message }, 500);

  const newCount = Math.max(0, (Number(build.like_count) || 0) - 1);
  const { error: updateError } = await supabaseAdmin
    .from('build_orders')
    .update({ like_count: newCount })
    .eq('id', buildId);
  if (updateError) return json({ error: updateError.message }, 500);

  return json({ liked: false, like_count: newCount }, 200);
}

async function handleGet(req: Request, userId: string | null): Promise<Response> {
  const { searchParams } = new URL(req.url);

  try {
    if (searchParams.get('profile') === 'true') {
      if (!userId) return json({ error: 'Unauthorized' }, 401);
      await ensureProfile(userId);
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, avatar_url, preferences')
        .eq('id', userId)
        .single();
      if (error) return json({ error: error.message }, 500);
      return json(data, 200);
    }

    const userProfileParam = searchParams.get('user_profile');
    if (userProfileParam) {
      const { data: profileRow, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, avatar_url')
        .eq('id', userProfileParam)
        .maybeSingle();
      if (profileError) {
        console.error('Profile lookup failed:', profileError.message);
      }
      const profile = profileRow ?? { id: userProfileParam, display_name: null, avatar_url: null };

      const { data: memberships, error: membershipsError } = await supabaseAdmin
        .from('guild_members')
        .select('guild_id, role')
        .eq('user_id', userProfileParam);
      if (membershipsError) return json({ error: membershipsError.message }, 500);

      const guildIds = (memberships ?? []).map((m) => m.guild_id as string);
      let guilds: { id: string; name: string; slug: string; role: string }[] = [];
      if (guildIds.length > 0) {
        const { data: guildRows, error: guildsError } = await supabaseAdmin
          .from('guilds')
          .select('id, name, slug')
          .in('id', guildIds);
        if (guildsError) return json({ error: guildsError.message }, 500);

        const roleByGuild = new Map<string, string>();
        for (const m of memberships ?? []) roleByGuild.set(m.guild_id as string, m.role as string);
        guilds = (guildRows ?? []).map((g) => ({
          id: g.id as string,
          name: g.name as string,
          slug: g.slug as string,
          role: roleByGuild.get(g.id as string) ?? '',
        }));
      }

      return json({ profile, guilds }, 200);
    }

    const userParam = searchParams.get('user');
    if (userParam) {
      const includePrivate = userId !== null && userId === userParam;
      let query = supabaseAdmin
        .from('build_orders')
        .select('*')
        .eq('owner_id', userParam)
        .order('created_at', { ascending: false });
      if (!includePrivate) {
        query = query.eq('visibility', 'public');
      }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json(await attachOwners(data ?? []), 200);
    }

    const id = searchParams.get('id');
    if (id) {
      const { data, error } = await supabaseAdmin.from('build_orders').select('*').eq('id', id).maybeSingle();
      if (error) return json({ error: error.message }, 500);
      if (!data || !(await canReadBuild(data, userId))) {
        return json({ error: 'Not found' }, 404);
      }

      try {
        await supabaseAdmin
          .from('build_orders')
          .update({ view_count: (Number(data.view_count) || 0) + 1 })
          .eq('id', id);
      } catch (err) {
        console.error('view_count increment failed:', err instanceof Error ? err.message : String(err));
      }

      let liked = false;
      if (userId) {
        const { data: likeRow } = await supabaseAdmin
          .from('build_likes')
          .select('build_id')
          .eq('build_id', id)
          .eq('user_id', userId)
          .maybeSingle();
        liked = !!likeRow;
      }

      const [withOwner] = await attachOwners([data]);
      return json({ ...withOwner, liked }, 200);
    }

    const limit = parseLimit(searchParams);
    const sort = parseSort(searchParams);
    const mineOnly = searchParams.get('mine') === 'true';
    const publicOnly = searchParams.get('public') === 'true';

    if (mineOnly) {
      if (!userId) return json({ error: 'Unauthorized' }, 401);
      const { data, error } = await supabaseAdmin
        .from('build_orders')
        .select('*')
        .eq('owner_id', userId)
        .order(sortColumn(sort), { ascending: false })
        .limit(limit);
      if (error) return json({ error: error.message }, 500);
      return json(await attachOwners(data ?? []), 200);
    }

    if (publicOnly) {
      const { data, error } = await supabaseAdmin
        .from('build_orders')
        .select('*')
        .eq('visibility', 'public')
        .order(sortColumn(sort), { ascending: false })
        .limit(limit);
      if (error) return json({ error: error.message }, 500);
      return json(await attachOwners(data ?? []), 200);
    }

    if (!userId) {
      // No token: same as ?public=true.
      const { data, error } = await supabaseAdmin
        .from('build_orders')
        .select('*')
        .eq('visibility', 'public')
        .order(sortColumn(sort), { ascending: false })
        .limit(limit);
      if (error) return json({ error: error.message }, 500);
      return json(await attachOwners(data ?? []), 200);
    }

    // Mixed list: public builds + the caller's own builds + builds shared with them.
    // Three separate simple queries, deduped by id, rather than one complex SQL query.
    const sharedIds = await getSharedBuildIds(userId);
    const queries = [
      supabaseAdmin
        .from('build_orders')
        .select('*')
        .eq('visibility', 'public')
        .order(sortColumn(sort), { ascending: false })
        .limit(limit),
      supabaseAdmin
        .from('build_orders')
        .select('*')
        .eq('owner_id', userId)
        .order(sortColumn(sort), { ascending: false })
        .limit(limit),
    ];
    if (sharedIds.length > 0) {
      queries.push(
        supabaseAdmin
          .from('build_orders')
          .select('*')
          .in('id', sharedIds)
          .order(sortColumn(sort), { ascending: false })
          .limit(limit),
      );
    }

    const results = await Promise.all(queries);
    for (const result of results) {
      if (result.error) return json({ error: result.error.message }, 500);
    }

    const byId = new Map<string, Record<string, unknown>>();
    for (const result of results) {
      for (const row of result.data ?? []) {
        byId.set(row.id as string, row);
      }
    }

    const merged = sortRows(Array.from(byId.values()), sort).slice(0, limit);

    return json(await attachOwners(merged), 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method === 'GET') {
    // Public builds must remain readable without a token; handleGet enforces
    // auth itself for anything that isn't visibility='public'.
    const userId = await getUserId(req);
    return handleGet(req, userId);
  }

  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return json({ error: 'Method not allowed' }, 405);
  }

  const userId = await getUserId(req);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: BuildOrderPayload & ProfilePatchPayload;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (req.method === 'PATCH') {
    const { searchParams } = new URL(req.url);
    if (body.profile === true || searchParams.get('profile') === 'true') {
      return handlePatchProfile(userId, body);
    }
  }

  if (req.method === 'POST') {
    if (body.like && typeof body.like === 'object') {
      return handleLikeBuild(userId, body.like as { build_id?: unknown });
    }

    const row = toRow(body);
    if ('error' in row) return json({ error: row.error }, 400);
    if (!row.civ || !row.type || !row.source_url || !row.source_type || !row.phases) {
      return json({ error: 'Missing required fields: civ, type, sourceUrl, sourceType, phases' }, 400);
    }

    await ensureProfile(userId);

    const { data, error } = await supabaseAdmin
      .from('build_orders')
      .insert({ ...row, owner_id: userId })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);
    const [withOwner] = await attachOwners([data]);
    return json(withOwner, 201);
  }

  // Unlike uses body.build_id (distinct from the build DELETE below, which uses body.id).
  if (req.method === 'DELETE' && body.id === undefined && typeof body.build_id === 'string') {
    return handleUnlikeBuild(userId, body.build_id);
  }

  // PATCH and DELETE both require an existing row owned by the caller.
  const id = body.id;
  if (typeof id !== 'string' || id.length === 0) {
    return json({ error: 'Missing "id" field' }, 400);
  }

  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('build_orders')
    .select('owner_id')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return json({ error: fetchError.message }, 500);
  if (!existing) return json({ error: 'Not found' }, 404);
  if (existing.owner_id !== userId) return json({ error: 'Forbidden' }, 403);

  if (req.method === 'DELETE') {
    const { error } = await supabaseAdmin.from('build_orders').delete().eq('id', id);
    if (error) return json({ error: error.message }, 500);
    return json({ id }, 200);
  }

  const row = toRow(body);
  if ('error' in row) return json({ error: row.error }, 400);
  const { data, error } = await supabaseAdmin
    .from('build_orders')
    .update(row)
    .eq('id', id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  const [withOwner] = await attachOwners([data]);
  return json(withOwner, 200);
});
