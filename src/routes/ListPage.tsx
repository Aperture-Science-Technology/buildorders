import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { listBuildOrders } from '@/lib/api';
import type { BuildOrder } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { PlusIcon, LayersIcon } from 'lucide-react';

const TYPE_LABELS: Record<BuildOrder['type'], string> = {
  rush: 'Rush',
  boom: 'Boom',
  turtle: 'Turtle',
  'fast-castle': 'Fast Castle',
  defensive: 'Defensive',
  other: 'Autre',
};

export function ListPage() {
  const [buildOrders, setBuildOrders] = useState<BuildOrder[] | null>(null);

  useEffect(() => {
    let cancelled = false;

    listBuildOrders()
      .then((data) => {
        if (!cancelled) setBuildOrders(data);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        toast.error('Impossible de charger les build orders', { description: error.message });
        setBuildOrders([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (buildOrders === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36" />
        ))}
      </div>
    );
  }

  if (buildOrders.length === 0) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>Aucun build order pour l'instant</CardTitle>
          <CardDescription>
            Créez le premier build order pour commencer à construire votre bibliothèque.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/new" />}>
            <PlusIcon />
            Créer un build
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Build orders</h1>
        <p className="text-muted-foreground">
          {buildOrders.length} build order{buildOrders.length > 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {buildOrders.map((buildOrder) => (
          <Link key={buildOrder.id} to={`/build/${buildOrder.id}`}>
            <Card className="h-full transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{buildOrder.civ}</CardTitle>
                <CardDescription className="capitalize">{buildOrder.sourceType}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Badge>{TYPE_LABELS[buildOrder.type]}</Badge>
                <Badge variant="outline">
                  <LayersIcon />
                  {buildOrder.phases.length} phase{buildOrder.phases.length > 1 ? 's' : ''}
                </Badge>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
