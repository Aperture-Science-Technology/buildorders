import type { BuildOrder } from '@/lib/types';
import { formatTime } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface ScenariosProps {
  buildOrder: BuildOrder;
}

export function Scenarios({ buildOrder }: ScenariosProps) {
  const scenarios = buildOrder.scenarios ?? [];

  if (scenarios.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Pas de scénario alternatif</CardTitle>
          <CardDescription>
            Ce build order ne documente pas encore de branche décisionnelle.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {scenarios.map((scenario) => (
        <Card key={scenario.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {scenario.label}
              <Badge variant="secondary">à {formatTime(scenario.branchAt)}</Badge>
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
