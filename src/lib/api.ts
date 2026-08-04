import { supabase } from '@/lib/supabase';
import type { BuildOrder, Phase, Scenario } from '@/lib/types';

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
  };
}

export async function listBuildOrders(): Promise<BuildOrder[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('build_orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as BuildOrderRow[]).map(mapRowToBuildOrder);
}

export async function getBuildOrder(id: string): Promise<BuildOrder | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('build_orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? mapRowToBuildOrder(data as BuildOrderRow) : null;
}

export interface BuildOrderInput {
  civ: string;
  type: BuildOrder['type'];
  sourceUrl: string;
  sourceType: BuildOrder['sourceType'];
  phases: Phase[];
  notes?: string;
}

function edgeFunctionUrl(): string {
  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) throw new Error('Supabase is not configured.');
  return `${supabaseUrl}/functions/v1/build-orders`;
}

async function callEdgeFunction(
  method: 'POST' | 'PATCH' | 'DELETE',
  token: string,
  body: object,
): Promise<BuildOrder> {
  const response = await fetch(edgeFunctionUrl(), {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error ?? 'Request failed';
    throw new Error(message);
  }

  return mapRowToBuildOrder(payload as BuildOrderRow);
}

export function createBuildOrder(input: BuildOrderInput, token: string): Promise<BuildOrder> {
  return callEdgeFunction('POST', token, input);
}

export function updateBuildOrder(
  id: string,
  input: BuildOrderInput,
  token: string,
): Promise<BuildOrder> {
  return callEdgeFunction('PATCH', token, { id, ...input });
}

export async function deleteBuildOrder(id: string, token: string): Promise<void> {
  await callEdgeFunction('DELETE', token, { id });
}
