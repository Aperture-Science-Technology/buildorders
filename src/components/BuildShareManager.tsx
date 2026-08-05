import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import {
  listBuildShares,
  listMyGuilds,
  shareBuild,
  unshareBuild,
  updateBuildOrder,
} from '@/lib/api';
import type { BuildShare, Guild, Visibility } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2Icon, UserIcon, UsersIcon } from 'lucide-react';

interface BuildShareManagerProps {
  buildId: string;
  visibility: Visibility;
  onVisibilityChange: (visibility: Visibility) => void;
  getToken: () => Promise<string | null>;
}

export function BuildShareManager({
  buildId,
  visibility,
  onVisibilityChange,
  getToken,
}: BuildShareManagerProps) {
  const [shares, setShares] = useState<BuildShare[] | null>(null);
  const [guilds, setGuilds] = useState<Guild[] | null>(null);
  const [userIdInput, setUserIdInput] = useState('');
  const [selectedGuildId, setSelectedGuildId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<BuildShare | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        if (!token) throw new Error('Session expirée, reconnectez-vous.');
        const [shareData, guildData] = await Promise.all([
          listBuildShares(token, buildId),
          listMyGuilds(token),
        ]);
        if (!cancelled) {
          setShares(shareData);
          setGuilds(guildData);
        }
      } catch (error) {
        if (cancelled) return;
        toast.error('Impossible de charger les partages', {
          description: error instanceof Error ? error.message : undefined,
        });
        setShares([]);
        setGuilds([]);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [buildId, getToken]);

  async function ensureShared(token: string) {
    if (visibility === 'shared') return;
    await updateBuildOrder(buildId, { visibility: 'shared' }, token);
    onVisibilityChange('shared');
  }

  async function handleShareUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!userIdInput.trim()) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      const share = await shareBuild(token, { build_id: buildId, user_id: userIdInput.trim() });
      await ensureShared(token);
      setShares((prev) => [...(prev ?? []), share]);
      setUserIdInput('');
      toast.success('Build partagé');
    } catch (error) {
      toast.error('Partage impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleShareGuild(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedGuildId) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      const share = await shareBuild(token, { build_id: buildId, guild_id: selectedGuildId });
      await ensureShared(token);
      setShares((prev) => [...(prev ?? []), share]);
      setSelectedGuildId('');
      toast.success('Build partagé');
    } catch (error) {
      toast.error('Partage impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveShare() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await unshareBuild(token, {
        build_id: buildId,
        user_id: removeTarget.user_id ?? undefined,
        guild_id: removeTarget.guild_id ?? undefined,
      });
      setShares((prev) => prev?.filter((share) => share !== removeTarget) ?? null);
      toast.success('Partage retiré');
      setRemoveTarget(null);
    } catch (error) {
      toast.error('Impossible de retirer ce partage', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Partage</CardTitle>
        <CardDescription>Gérez qui peut voir ce build order.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {shares === null ? (
          <Skeleton className="h-16 w-full" />
        ) : shares.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun partage pour l'instant.</p>
        ) : (
          <ul className="space-y-2">
            {shares.map((share) => (
              <li
                key={`${share.guild_id ?? share.user_id}-${share.created_at}`}
                className="flex items-center justify-between gap-2 rounded-lg border p-2 text-sm"
              >
                <span className="flex items-center gap-2">
                  {share.guild_id ? (
                    <UsersIcon className="size-4 text-muted-foreground" />
                  ) : (
                    <UserIcon className="size-4 text-muted-foreground" />
                  )}
                  {share.guild_id ? (share.guild_name ?? share.guild_id) : share.user_id}
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Retirer ce partage"
                  onClick={() => setRemoveTarget(share)}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <Separator />

        <Tabs defaultValue="user">
          <TabsList>
            <TabsTrigger value="user">Utilisateur</TabsTrigger>
            <TabsTrigger value="guild">Guilde</TabsTrigger>
          </TabsList>

          <TabsContent value="user">
            <form onSubmit={handleShareUser} className="flex gap-2 pt-2">
              <Input
                value={userIdInput}
                onChange={(event) => setUserIdInput(event.target.value)}
                placeholder="ID utilisateur Clerk"
                aria-label="ID utilisateur"
              />
              <Button type="submit" disabled={submitting || !userIdInput.trim()}>
                Partager
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="guild">
            {guilds === null ? (
              <Skeleton className="mt-2 h-8 w-full" />
            ) : guilds.length === 0 ? (
              <p className="pt-2 text-sm text-muted-foreground">Vous n'avez aucune guilde.</p>
            ) : (
              <form onSubmit={handleShareGuild} className="flex gap-2 pt-2">
                <Select
                  value={selectedGuildId}
                  onValueChange={(value) => setSelectedGuildId(value ?? '')}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Choisir une guilde" />
                  </SelectTrigger>
                  <SelectContent>
                    {guilds.map((guild) => (
                      <SelectItem key={guild.id} value={guild.id}>
                        {guild.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={submitting || !selectedGuildId}>
                  Partager
                </Button>
              </form>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={removeTarget !== null} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retirer ce partage ?</DialogTitle>
            <DialogDescription>
              {removeTarget?.guild_id
                ? (removeTarget.guild_name ?? removeTarget.guild_id)
                : removeTarget?.user_id}{' '}
              n'aura plus accès à ce build order.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleRemoveShare} disabled={removing}>
              {removing ? 'Suppression…' : 'Retirer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
