import type {
  BuildOrder,
  BuildShare,
  GameMode,
  Guild,
  GuildMember,
  MatchupNote,
  Phase,
  Profile,
  Scenario,
  Visibility,
} from '@/lib/types';

interface BuildOrderRow {
  id: string;
  civ: string;
  type: BuildOrder['type'];
  source_url: string;
  source_type: BuildOrder['sourceType'];
  phases: Phase[];
  notes: string | null;
  scenarios: Scenario[] | null;
  owner_id: string | null;
  created_at: string;
  game_modes: GameMode[] | null;
  strengths: string[] | null;
  weaknesses: string[] | null;
  matchup_notes: MatchupNote[] | null;
  difficulty: number | null;
  layout: Record<string, { x: number; y: number }> | null;
  visibility: Visibility | null;
}

function mapRowToBuildOrder(row: BuildOrderRow): BuildOrder {
  return {
    id: row.id,
    civ: row.civ,
    type: row.type,
    sourceUrl: row.source_url,
    sourceType: row.source_type,
    phases: row.phases,
    notes: row.notes ?? undefined,
    scenarios: row.scenarios ?? undefined,
    ownerId: row.owner_id ?? undefined,
    createdAt: row.created_at,
    gameModes: row.game_modes ?? undefined,
    strengths: row.strengths ?? undefined,
    weaknesses: row.weaknesses ?? undefined,
    matchupNotes: row.matchup_notes ?? undefined,
    difficulty: row.difficulty ?? undefined,
    layout: row.layout ?? undefined,
    visibility: row.visibility ?? undefined,
  };
}

export class EdgeFunctionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'EdgeFunctionError';
    this.status = status;
  }
}

interface EdgeCallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
  query?: Record<string, string | undefined>;
}

async function edgeCall<T>(path: string, options: EdgeCallOptions = {}): Promise<T> {
  const { method = 'GET', token, body, query } = options;

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const apikey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!supabaseUrl || !apikey) throw new Error('Supabase is not configured.');

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) search.set(key, value);
  }
  const queryString = search.toString();
  const url = `${supabaseUrl}/functions/v1/${path}${queryString ? `?${queryString}` : ''}`;

  const headers: Record<string, string> = { apikey };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const response = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error ?? 'Request failed';
    throw new EdgeFunctionError(message, response.status);
  }

  return payload as T;
}

export interface ListBuildOrdersOptions {
  mine?: boolean;
  public?: boolean;
  token?: string;
}

export async function listBuildOrders(
  options: ListBuildOrdersOptions = {},
): Promise<BuildOrder[]> {
  const { mine, public: onlyPublic, token } = options;

  // No args (no token) => public-only, so anonymous visitors keep working.
  // Token + mine => caller's own builds. Token, no mine/public => mixed list.
  let query: Record<string, string> | undefined;
  if (mine) {
    query = { mine: 'true' };
  } else if (onlyPublic || !token) {
    query = { public: 'true' };
  }

  const rows = await edgeCall<BuildOrderRow[]>('build-orders', { query, token });
  return rows.map(mapRowToBuildOrder);
}

export async function getBuildOrder(id: string, token?: string): Promise<BuildOrder | null> {
  try {
    const row = await edgeCall<BuildOrderRow>('build-orders', { query: { id }, token });
    return mapRowToBuildOrder(row);
  } catch (error) {
    if (error instanceof EdgeFunctionError && error.status === 404) return null;
    throw error;
  }
}

export function getMyProfile(token: string): Promise<Profile> {
  return edgeCall<Profile>('build-orders', { query: { profile: 'true' }, token });
}

export interface UpdateProfileInput {
  display_name?: string;
  avatar_url?: string;
}

export function updateMyProfile(token: string, input: UpdateProfileInput): Promise<Profile> {
  return edgeCall<Profile>('build-orders', {
    method: 'PATCH',
    token,
    query: { profile: 'true' },
    body: { profile: true, ...input },
  });
}

export interface BuildOrderInput {
  civ: string;
  type: BuildOrder['type'];
  sourceUrl: string;
  sourceType: BuildOrder['sourceType'];
  phases: Phase[];
  notes?: string;
  gameModes?: GameMode[];
  strengths?: string[];
  weaknesses?: string[];
  matchupNotes?: MatchupNote[];
  difficulty?: number;
  layout?: Record<string, { x: number; y: number }>;
  visibility?: Visibility;
}

function parseFunctionUrl(): string {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase is not configured.');
  return `${supabaseUrl}/functions/v1/parse-build-order`;
}

export type ParsedBuildOrder = Omit<BuildOrder, 'id' | 'ownerId' | 'createdAt'>;

export async function parseBuildOrderUrl(url: string): Promise<ParsedBuildOrder> {
  const response = await fetch(parseFunctionUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error ?? 'Import failed';
    throw new Error(message);
  }

  return payload as ParsedBuildOrder;
}

export function createBuildOrder(input: BuildOrderInput, token: string): Promise<BuildOrder> {
  return edgeCall<BuildOrderRow>('build-orders', { method: 'POST', token, body: input }).then(
    mapRowToBuildOrder,
  );
}

export function updateBuildOrder(
  id: string,
  input: Partial<BuildOrderInput>,
  token: string,
): Promise<BuildOrder> {
  return edgeCall<BuildOrderRow>('build-orders', {
    method: 'PATCH',
    token,
    body: { id, ...input },
  }).then(mapRowToBuildOrder);
}

export async function deleteBuildOrder(id: string, token: string): Promise<void> {
  await edgeCall<unknown>('build-orders', { method: 'DELETE', token, body: { id } });
}

export function listMyGuilds(token: string): Promise<Guild[]> {
  return edgeCall<Guild[]>('guilds', { query: { mine: 'true' }, token });
}

export interface CreateGuildInput {
  name: string;
  slug: string;
  description?: string;
}

export function createGuild(token: string, input: CreateGuildInput): Promise<Guild> {
  return edgeCall<Guild>('guilds', { method: 'POST', token, body: input });
}

export async function deleteGuild(token: string, id: string): Promise<void> {
  await edgeCall<unknown>('guilds', { method: 'DELETE', token, body: { id } });
}

export interface AddGuildMemberInput {
  guild_id: string;
  user_id: string;
  role?: 'admin' | 'member';
}

export function addGuildMember(token: string, input: AddGuildMemberInput): Promise<GuildMember> {
  return edgeCall<GuildMember>('guilds/members', { method: 'POST', token, body: input });
}

export interface RemoveGuildMemberInput {
  guild_id: string;
  user_id: string;
}

export async function removeGuildMember(
  token: string,
  input: RemoveGuildMemberInput,
): Promise<void> {
  await edgeCall<unknown>('guilds/members', { method: 'DELETE', token, body: input });
}

export function listBuildShares(token: string, buildId: string): Promise<BuildShare[]> {
  return edgeCall<BuildShare[]>('build-shares', { query: { build_id: buildId }, token });
}

export interface ShareBuildInput {
  build_id: string;
  user_id?: string;
  guild_id?: string;
}

export function shareBuild(token: string, input: ShareBuildInput): Promise<BuildShare> {
  return edgeCall<BuildShare>('build-shares', { method: 'POST', token, body: input });
}

export async function unshareBuild(token: string, input: ShareBuildInput): Promise<void> {
  await edgeCall<unknown>('build-shares', { method: 'DELETE', token, body: input });
}
