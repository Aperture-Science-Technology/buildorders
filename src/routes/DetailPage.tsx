import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@clerk/clerk-react';
import { getBuildOrder, deleteBuildOrder } from '@/lib/api';
import type { BuildOrder, Visibility } from '@/lib/types';
import { CivFlag } from '@/components/CivFlag';
import { LikeButton } from '@/components/LikeButton';
import { BuildOrderFlow } from '@/components/BuildOrderFlow';
import { BuildOrderEditor } from '@/components/BuildOrderEditor';
import { Scenarios } from '@/components/Scenarios';
import { BuildShareManager } from '@/components/BuildShareManager';
import { VisibilityBadge } from '@/components/VisibilityBadge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ownerDisplayName, ownerInitial } from '@/lib/format';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PencilIcon, PlayIcon, Trash2Icon } from 'lucide-react';

const TYPE_LABELS: Record<BuildOrder['type'], string> = {
  rush: 'Rush',
  boom: 'Boom',
  turtle: 'Turtle',
  'fast-castle': 'Fast Castle',
  defensive: 'Defensive',
  other: 'Autre',
};

export function DetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userId, getToken } = useAuth();
  const [buildOrder, setBuildOrder] = useState<BuildOrder | null | undefined>(undefined);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await deleteBuildOrder(id, token);
      toast.success('Build order supprimé');
      navigate('/builds');
    } catch (error) {
      toast.error('Suppression impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
      setDeleting(false);
      setConfirmOpen(false);
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
          <Button render={<Link to="/builds" />}>Retour à la liste</Button>
        </CardContent>
      </Card>
    );
  }

  const isOwner = Boolean(userId) && buildOrder.ownerId === userId;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <CivFlag civ={buildOrder.civ} />
            {buildOrder.civ}
          </h1>
          <div className="flex flex-wrap gap-2">
            <Badge>{TYPE_LABELS[buildOrder.type]}</Badge>
            <VisibilityBadge visibility={buildOrder.visibility ?? 'public'} />
            <Badge
              variant="outline"
              render={<a href={buildOrder.sourceUrl} target="_blank" rel="noreferrer" />}
            >
              Source : {buildOrder.sourceType}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            {buildOrder.owner?.id ? (
              <Link
                to={`/u/${buildOrder.owner.id}`}
                className="flex items-center gap-2 hover:underline"
              >
                <Avatar className="size-6">
                  <AvatarImage src={buildOrder.owner?.avatar_url ?? undefined} />
                  <AvatarFallback>{ownerInitial(buildOrder.owner)}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  Créé par {ownerDisplayName(buildOrder.owner)}
                </span>
              </Link>
            ) : (
              <>
                <Avatar className="size-6">
                  <AvatarImage src={buildOrder.owner?.avatar_url ?? undefined} />
                  <AvatarFallback>{ownerInitial(buildOrder.owner)}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  Créé par {ownerDisplayName(buildOrder.owner)}
                </span>
              </>
            )}
            <LikeButton
              buildId={buildOrder.id}
              liked={buildOrder.liked ?? false}
              likeCount={buildOrder.likeCount ?? 0}
              size="lg"
              onChange={(liked, likeCount) =>
                setBuildOrder((prev) => (prev ? { ...prev, liked, likeCount } : prev))
              }
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button size="sm" render={<Link to={`/play/${buildOrder.id}`} />}>
            <PlayIcon />
            Lancer
          </Button>
          {isOwner && (
            <>
              <Button variant="outline" size="sm" render={<Link to={`/edit/${buildOrder.id}`} />}>
                <PencilIcon />
                Modifier
              </Button>
              <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
                <Trash2Icon />
                Supprimer
              </Button>
            </>
          )}
        </div>
      </div>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Build Order</h2>
        <Card>
          <CardContent className="h-[700px]">
            {isOwner ? (
              <BuildOrderEditor
                buildOrder={buildOrder}
                getToken={getToken}
                onSaved={(updated) => setBuildOrder(updated)}
                heightClassName="h-[700px]"
              />
            ) : (
              <BuildOrderFlow buildOrder={buildOrder} />
            )}
          </CardContent>
        </Card>
      </section>

      {buildOrder.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
            {buildOrder.notes}
          </CardContent>
        </Card>
      )}

      <Separator />

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Scénarios</h2>
        <Scenarios buildOrder={buildOrder} />
      </section>

      {isOwner && (
        <>
          <Separator />
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Partage</h2>
            <BuildShareManager
              buildId={buildOrder.id}
              visibility={buildOrder.visibility ?? 'public'}
              onVisibilityChange={(nextVisibility: Visibility) =>
                setBuildOrder((prev) => (prev ? { ...prev, visibility: nextVisibility } : prev))
              }
              getToken={getToken}
            />
          </section>
        </>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce build order ?</DialogTitle>
            <DialogDescription>Cette action est irréversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Suppression…' : 'Supprimer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
