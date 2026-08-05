import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { SignedIn, SignedOut, RedirectToSignIn, useAuth } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { BuildOrderForm } from '@/components/BuildOrderForm';
import { getBuildOrder, updateBuildOrder, type BuildOrderInput } from '@/lib/api';
import type { BuildOrder } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export function EditPage() {
  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <EditBuildOrderForm />
      </SignedIn>
    </>
  );
}

function EditBuildOrderForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, getToken } = useAuth();
  const [buildOrder, setBuildOrder] = useState<BuildOrder | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    getToken()
      .then((token) => getBuildOrder(id, token ?? undefined))
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
  }, [id, getToken]);

  async function handleSubmit(input: BuildOrderInput) {
    if (!id) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await updateBuildOrder(id, input, token);
      toast.success('Build order mis à jour');
      navigate(`/build/${id}`);
    } catch (error) {
      toast.error('Mise à jour impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
      setSubmitting(false);
    }
  }

  if (buildOrder === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
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

  if (buildOrder.ownerId !== userId) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>Vous n'êtes pas le propriétaire de ce build order.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to={`/build/${buildOrder.id}`} />}>Voir le build order</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Modifier le build order</h1>
        <p className="text-muted-foreground">{buildOrder.civ}</p>
      </div>
      <BuildOrderForm
        initial={buildOrder}
        submitLabel="Enregistrer"
        submitting={submitting}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
