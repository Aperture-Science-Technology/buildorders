import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getBuildOrder } from '@/lib/api';
import type { BuildOrder } from '@/lib/types';
import { BuildOrderPlayer } from '@/components/BuildOrderPlayer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function PlayPage() {
  const { id } = useParams<{ id: string }>();
  const [buildOrder, setBuildOrder] = useState<BuildOrder | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getBuildOrder(id)
      .then((data) => {
        if (!cancelled) setBuildOrder(data);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        toast.error('Impossible de charger ce build order', {
          description: error instanceof Error ? error.message : undefined,
        });
        setBuildOrder(null);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (buildOrder === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (buildOrder === null) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>Build order introuvable</CardTitle>
          <CardDescription>Il a peut-être été supprimé.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/" />}>Retour à la liste</Button>
        </CardContent>
      </Card>
    );
  }

  return <BuildOrderPlayer buildOrder={buildOrder} />;
}
