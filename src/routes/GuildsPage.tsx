import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { SignInButton, useAuth } from '@clerk/clerk-react';
import { toast } from 'sonner';
import {
  approveJoinRequest,
  createGuild,
  getGuild,
  joinGuild,
  leaveGuild,
  listAllGuilds,
  rejectJoinRequest,
} from '@/lib/api';
import type { Guild } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { ArrowLeftIcon, CheckIcon, PlusIcon, UsersIcon, XIcon } from 'lucide-react';

export function GuildsPage() {
  const { isSignedIn, getToken } = useAuth();
  const [guilds, setGuilds] = useState<Guild[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');

  async function loadGuilds() {
    try {
      const token = isSignedIn ? await getToken() : null;
      const data = await listAllGuilds(token);
      setGuilds(data);
    } catch (error) {
      toast.error('Impossible de charger les guildes', {
        description: error instanceof Error ? error.message : undefined,
      });
      setGuilds([]);
    }
  }

  useEffect(() => {
    loadGuilds();
  }, [isSignedIn]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await createGuild(token, { name, slug, description: description || undefined });
      toast.success('Guilde créée');
      setCreateOpen(false);
      setName('');
      setSlug('');
      setDescription('');
      await loadGuilds();
    } catch (error) {
      toast.error('Création impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  }

  if (selectedId) {
    return (
      <GuildDetail
        id={selectedId}
        onBack={() => setSelectedId(null)}
        onChange={loadGuilds}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Guildes</h1>
          <p className="text-muted-foreground">Trouvez une guilde et partagez vos builds.</p>
        </div>
        {isSignedIn && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger render={<Button />}>
              <PlusIcon />
              Créer une guilde
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreate} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Créer une guilde</DialogTitle>
                  <DialogDescription>
                    Regroupez des joueurs pour partager des builds.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="guild-name">Nom</Label>
                    <Input
                      id="guild-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guild-slug">Slug</Label>
                    <Input
                      id="guild-slug"
                      value={slug}
                      onChange={(event) => setSlug(event.target.value)}
                      placeholder="ma-guilde"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guild-description">Description</Label>
                    <Textarea
                      id="guild-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? 'Création…' : 'Créer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {guilds === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-40" />
          ))}
        </div>
      ) : guilds.length === 0 ? (
        <Card className="mx-auto max-w-md text-center">
          <CardHeader>
            <CardTitle>Aucune guilde</CardTitle>
            <CardDescription>Créez la première guilde pour commencer.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guilds.map((guild) => (
            <GuildDirectoryCard
              key={guild.id}
              guild={guild}
              isSignedIn={Boolean(isSignedIn)}
              getToken={getToken}
              onSelect={() => setSelectedId(guild.id)}
              onChange={loadGuilds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface GuildDirectoryCardProps {
  guild: Guild;
  isSignedIn: boolean;
  getToken: () => Promise<string | null>;
  onSelect: () => void;
  onChange: () => Promise<void>;
}

function GuildDirectoryCard({
  guild,
  isSignedIn,
  getToken,
  onSelect,
  onChange,
}: GuildDirectoryCardProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleJoin(event: MouseEvent) {
    event.stopPropagation();
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await joinGuild(token, guild.id);
      toast.success('Demande envoyée au propriétaire');
      await onChange();
    } catch (error) {
      toast.error("Impossible d'envoyer la demande", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeave(event: MouseEvent) {
    event.stopPropagation();
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await leaveGuild(token, guild.id);
      toast.success(`Vous avez quitté ${guild.name}`);
      await onChange();
    } catch (error) {
      toast.error('Impossible de quitter cette guilde', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="cursor-pointer transition-colors hover:bg-muted/50" onClick={onSelect}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UsersIcon className="size-4 text-muted-foreground" />
          {guild.name}
        </CardTitle>
        <CardDescription>{guild.description || 'Pas de description.'}</CardDescription>
        <CardAction>
          <Badge variant="secondary">
            {guild.member_count ?? 0} membre{(guild.member_count ?? 0) > 1 ? 's' : ''}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex items-center justify-between gap-2">
        {guild.role ? (
          <Badge variant="outline" className="capitalize">
            {guild.role}
          </Badge>
        ) : (
          <span />
        )}
        {guild.role === 'owner' ? null : guild.role ? (
          <Button variant="outline" size="sm" onClick={handleLeave} disabled={submitting}>
            Quitter
          </Button>
        ) : guild.joinRequested ? (
          <Badge variant="secondary">Demande envoyée</Badge>
        ) : isSignedIn ? (
          <Button size="sm" onClick={handleJoin} disabled={submitting}>
            Demander à rejoindre
          </Button>
        ) : (
          <SignInButton>
            <Button size="sm" onClick={(event: MouseEvent) => event.stopPropagation()}>
              Se connecter
            </Button>
          </SignInButton>
        )}
      </CardContent>
    </Card>
  );
}

interface GuildDetailProps {
  id: string;
  onBack: () => void;
  onChange: () => Promise<void>;
}

function GuildDetail({ id, onBack, onChange }: GuildDetailProps) {
  const { isSignedIn, getToken } = useAuth();
  const [guild, setGuild] = useState<Guild | null | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const token = isSignedIn ? await getToken() : null;
      const data = await getGuild(token, id);
      setGuild(data);
    } catch (error) {
      toast.error('Impossible de charger cette guilde', {
        description: error instanceof Error ? error.message : undefined,
      });
      setGuild(null);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isSignedIn]);

  async function refresh() {
    await load();
    await onChange();
  }

  async function handleJoin() {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await joinGuild(token, id);
      toast.success('Demande envoyée au propriétaire');
      await refresh();
    } catch (error) {
      toast.error("Impossible d'envoyer la demande", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleApprove(userId: string) {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await approveJoinRequest(token, id, userId);
      toast.success('Demande acceptée');
      await refresh();
    } catch (error) {
      toast.error("Impossible d'accepter cette demande", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReject(userId: string) {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await rejectJoinRequest(token, id, userId);
      toast.success('Demande refusée');
      await refresh();
    } catch (error) {
      toast.error('Impossible de refuser cette demande', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLeave() {
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await leaveGuild(token, id);
      toast.success('Guilde quittée');
      await refresh();
    } catch (error) {
      toast.error('Impossible de quitter cette guilde', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeftIcon />
        Retour au répertoire
      </Button>

      {guild === undefined ? (
        <Skeleton className="h-64 w-full" />
      ) : guild === null ? (
        <Card className="mx-auto max-w-md text-center">
          <CardHeader>
            <CardTitle>Guilde introuvable</CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <UsersIcon className="size-5 text-muted-foreground" />
                  {guild.name}
                </CardTitle>
                <CardDescription>{guild.description || 'Pas de description.'}</CardDescription>
              </div>
              <Badge variant="secondary">
                {guild.member_count ?? guild.members.length} membre
                {(guild.member_count ?? guild.members.length) > 1 ? 's' : ''}
              </Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-2">
              {guild.role ? (
                <Badge variant="outline" className="capitalize">
                  {guild.role}
                </Badge>
              ) : (
                <span />
              )}
              {guild.role === 'owner' ? (
                <Button size="sm" render={<Link to="/profile" />}>
                  Gérer
                </Button>
              ) : guild.role ? (
                <Button variant="outline" size="sm" onClick={handleLeave} disabled={submitting}>
                  Quitter
                </Button>
              ) : guild.joinRequested ? (
                <Badge variant="secondary">Demande envoyée</Badge>
              ) : isSignedIn ? (
                <Button size="sm" onClick={handleJoin} disabled={submitting}>
                  Demander à rejoindre
                </Button>
              ) : (
                <SignInButton>
                  <Button size="sm">Se connecter</Button>
                </SignInButton>
              )}
            </CardContent>
          </Card>

          {(guild.role === 'owner' || guild.role === 'admin') && (
            <Card>
              <CardHeader>
                <CardTitle>Demandes d'adhésion</CardTitle>
              </CardHeader>
              <CardContent>
                {guild.joinRequests && guild.joinRequests.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Demandeur</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {guild.joinRequests.map((request) => (
                        <TableRow key={request.user_id}>
                          <TableCell>{request.display_name || request.user_id}</TableCell>
                          <TableCell>
                            {new Date(request.created_at).toLocaleDateString('fr-FR')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleApprove(request.user_id)}
                                disabled={submitting}
                              >
                                <CheckIcon />
                                Accepter
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleReject(request.user_id)}
                                disabled={submitting}
                              >
                                <XIcon />
                                Refuser
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Membres</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Membre</TableHead>
                    <TableHead>Rôle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {guild.members.map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell>{member.display_name || member.user_id}</TableCell>
                      <TableCell className="capitalize">{member.role}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
