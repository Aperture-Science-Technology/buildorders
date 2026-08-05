// Edge Function: authenticated CRUD for build_orders.
// Reads are public via the client's anon/publishable key + RLS; writes go through
// here so we can verify the caller's Clerk session token and enforce ownership
// before touching the table with the service-role key (which bypasses RLS).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { verifyToken } from 'npm:@clerk/backend@3';

const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PATCH, DELETE, OPTIONS',
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

interface BuildOrderPayload {
  id?: unknown;
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
}

const GAME_MODES = ['1v1', '2v2', '3v3', '4v4', 'ffa'];

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

  return row;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (!['POST', 'PATCH', 'DELETE'].includes(req.method)) {
    return json({ error: 'Method not allowed' }, 405);
  }

  const userId = await getUserId(req);
  if (!userId) {
    return json({ error: 'Unauthorized' }, 401);
  }

  let body: BuildOrderPayload;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  if (req.method === 'POST') {
    const row = toRow(body);
    if ('error' in row) return json({ error: row.error }, 400);
    if (!row.civ || !row.type || !row.source_url || !row.source_type || !row.phases) {
      return json({ error: 'Missing required fields: civ, type, sourceUrl, sourceType, phases' }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from('build_orders')
      .insert({ ...row, owner_id: userId })
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);
    return json(data, 201);
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
  return json(data, 200);
});
