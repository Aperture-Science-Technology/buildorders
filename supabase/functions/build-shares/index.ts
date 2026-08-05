// Edge Function: authenticated management of build_orders sharing (to a user
// or to a guild). service-role bypasses RLS, so ownership checks happen here.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyToken } from 'npm:@clerk/backend@3';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
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

function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

interface BuildRow {
  id: string;
  owner_id: string | null;
}

async function getBuild(buildId: string): Promise<BuildRow | null> {
  const { data, error } = await supabaseAdmin
    .from('build_orders')
    .select('id, owner_id')
    .eq('id', buildId)
    .maybeSingle();
  if (error) throw error;
  return data as BuildRow | null;
}

interface SharePayload {
  build_id?: unknown;
  user_id?: unknown;
  guild_id?: unknown;
}

interface ParsedShare {
  buildId: string;
  userId: string | null;
  guildId: string | null;
}

function parseSharePayload(body: SharePayload): ParsedShare | { error: string } {
  const buildId = typeof body.build_id === 'string' ? body.build_id : '';
  if (!buildId) return { error: 'build_id is required' };

  const userId = body.user_id === undefined || body.user_id === null
    ? null
    : typeof body.user_id === 'string'
      ? body.user_id
      : undefined;
  const guildId = body.guild_id === undefined || body.guild_id === null
    ? null
    : typeof body.guild_id === 'string'
      ? body.guild_id
      : undefined;

  if (userId === undefined || guildId === undefined) {
    return { error: 'user_id and guild_id must be strings' };
  }
  if (!userId && !guildId) {
    return { error: 'At least one of user_id or guild_id is required' };
  }

  return { buildId, userId, guildId };
}

// Verifies the build exists and the caller owns it; returns the parsed
// ownership-check outcome as an early Response, or null when authorized.
async function checkBuildOwnership(buildId: string, callerId: string): Promise<Response | null> {
  const build = await getBuild(buildId);
  if (!build) return json({ error: 'Not found' }, 404);
  if (build.owner_id !== callerId) return json({ error: 'Forbidden' }, 403);
  return null;
}

async function handleGet(req: Request, userId: string): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const buildId = searchParams.get('build_id');
  if (!buildId) return json({ error: 'build_id is required' }, 400);

  try {
    const denied = await checkBuildOwnership(buildId, userId);
    if (denied) return denied;

    const { data: shares, error } = await supabaseAdmin
      .from('build_shares')
      .select('build_id, user_id, guild_id, created_at')
      .eq('build_id', buildId);
    if (error) return json({ error: error.message }, 500);

    const guildIds = Array.from(
      new Set((shares ?? []).map((s) => s.guild_id as string | null).filter((id): id is string => !!id)),
    );

    let nameByGuild = new Map<string, string>();
    if (guildIds.length > 0) {
      const { data: guilds, error: guildsError } = await supabaseAdmin
        .from('guilds')
        .select('id, name')
        .in('id', guildIds);
      if (guildsError) return json({ error: guildsError.message }, 500);
      nameByGuild = new Map((guilds ?? []).map((g) => [g.id as string, g.name as string]));
    }

    const result = (shares ?? []).map((s) => ({
      build_id: s.build_id,
      user_id: s.user_id,
      guild_id: s.guild_id,
      guild_name: s.guild_id ? nameByGuild.get(s.guild_id as string) ?? null : undefined,
      created_at: s.created_at,
    }));

    return json(result, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

async function handleCreate(userId: string, body: SharePayload): Promise<Response> {
  const parsed = parseSharePayload(body);
  if ('error' in parsed) return json({ error: parsed.error }, 400);
  const { buildId, userId: shareUserId, guildId } = parsed;

  try {
    const denied = await checkBuildOwnership(buildId, userId);
    if (denied) return denied;

    if (shareUserId) await ensureProfile(shareUserId);
    if (guildId) {
      const { data: guild, error: guildError } = await supabaseAdmin
        .from('guilds')
        .select('id')
        .eq('id', guildId)
        .maybeSingle();
      if (guildError) return json({ error: guildError.message }, 500);
      if (!guild) return json({ error: 'guild not found' }, 404);
    }

    const { data, error } = await supabaseAdmin
      .from('build_shares')
      .insert({ build_id: buildId, user_id: shareUserId, guild_id: guildId })
      .select()
      .single();

    if (error) {
      if (isUniqueViolation(error)) return json({ error: 'Already shared' }, 409);
      return json({ error: error.message }, 500);
    }

    return json(data, 201);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

async function handleDelete(userId: string, body: SharePayload): Promise<Response> {
  const parsed = parseSharePayload(body);
  if ('error' in parsed) return json({ error: parsed.error }, 400);
  const { buildId, userId: shareUserId, guildId } = parsed;

  try {
    const denied = await checkBuildOwnership(buildId, userId);
    if (denied) return denied;

    let query = supabaseAdmin.from('build_shares').delete().eq('build_id', buildId);
    query = shareUserId ? query.eq('user_id', shareUserId) : query.is('user_id', null);
    query = guildId ? query.eq('guild_id', guildId) : query.is('guild_id', null);

    const { error } = await query;
    if (error) return json({ error: error.message }, 500);

    return json({ build_id: buildId, user_id: shareUserId, guild_id: guildId }, 200);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Internal error' }, 500);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    return json({ error: 'Method not allowed' }, 405);
  }

  const userId = await getUserId(req);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401);
  }

  if (req.method === 'GET') {
    return handleGet(req, userId);
  }

  const body = await readJson<SharePayload>(req);
  if (body === null) return json({ error: 'Invalid JSON body' }, 400);

  if (req.method === 'POST') {
    return handleCreate(userId, body);
  }

  return handleDelete(userId, body);
});
