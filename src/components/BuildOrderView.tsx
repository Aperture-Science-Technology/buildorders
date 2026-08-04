import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { hreFastCastle } from '@/lib/mock-data';
import type { BuildOrder, Phase, Scenario } from '@/lib/types';
import { Timeline } from '@/components/Timeline';
import { Cheatsheet } from '@/components/Cheatsheet';
import { Scenarios } from '@/components/Scenarios';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface BuildOrderRow {
  id: string;
  civ: string;
  type: BuildOrder['type'];
  source_url: string;
  source_type: BuildOrder['sourceType'];
  phases: Phase[];
  notes: string | null;
  scenarios: Scenario[] | null;
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
  };
}

export function BuildOrderView() {
  const [buildOrders, setBuildOrders] = useState<BuildOrder[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setBuildOrders([hreFastCastle]);
      setSelectedId(hreFastCastle.id);
      setLoading(false);
      return;
    }

    let cancelled = false;

    supabase
      .from('build_orders')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(10)
      .then(({ data, error }) => {
        if (cancelled) return;

        if (error) {
          console.error('Failed to load build orders from Supabase:', error);
          setBuildOrders([hreFastCastle]);
          setSelectedId(hreFastCastle.id);
          setLoading(false);
          return;
        }

        const rows = (data ?? []) as BuildOrderRow[];
        const mapped = rows.map(mapRowToBuildOrder);
        setBuildOrders(mapped);
        setSelectedId(mapped[0]?.id ?? null);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">Loading…</p>;
  }

  if (!buildOrders || buildOrders.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No build orders yet</CardTitle>
          <CardDescription>Check back once some have been ingested.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const selected =
    buildOrders.find((buildOrder) => buildOrder.id === selectedId) ?? buildOrders[0];

  return (
    <div className="space-y-8">
      {buildOrders.length > 1 && (
        <select
          className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm shadow-xs sm:w-auto"
          value={selected.id}
          onChange={(event) => setSelectedId(event.target.value)}
        >
          {buildOrders.map((buildOrder) => (
            <option key={buildOrder.id} value={buildOrder.id}>
              {buildOrder.civ} · {buildOrder.type}
            </option>
          ))}
        </select>
      )}

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Timeline</h2>
        <Timeline buildOrder={selected} />
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Cheatsheet</h2>
        <Cheatsheet buildOrder={selected} />
      </section>

      <Separator />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Scénarios</h2>
        <Scenarios />
      </section>
    </div>
  );
}
