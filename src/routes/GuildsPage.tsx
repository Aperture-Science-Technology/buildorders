import { useEffect, useState, type FormEvent } from 'react';
import { SignedIn, SignedOut, SignInButton, useAuth } from '@clerk/clerk-react';
import { toast } from 'sonner';
import {
  addGuildMember,
  createGuild,
  deleteGuild,
  listMyGuilds,
  removeGuildMember,
} from '@/lib/api';
import type { Guild } from '@/lib/types';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { PlusIcon, Trash2Icon, UsersIcon } from 'lucide-react';

export function GuildsPage() {
  return (
    <>
      <SignedOut>
        <Card className="mx-auto max-w-md text-center">
          <CardHeader>
            <CardTitle>Guildes</CardTitle>
            <CardDescription>Connectez-vous pour voir et gérer vos guildes.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignInButton>
              <Button>Se connecter</Button>
            </SignInButton>
          </CardContent>
        </Card>
      </SignedOut>
      <SignedIn>
        <GuildsContent />
      </SignedIn>
    </>
  );
}

function GuildsContent() {
  const { getToken } = useAuth();
  const [guilds, setGuilds] = useState<Guild[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Guild | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadGuilds() {
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      const data = await listMyGuilds(token);
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
  }, []);

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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await deleteGuild(token, deleteTarget.id);
      toast.success('Guilde supprimée');
      setDeleteTarget(null);
      await loadGuilds();
    } catch (error) {
      toast.error('Suppression impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  if (guilds === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Mes guildes</h1>
          <p className="text-muted-foreground">Partagez vos builds avec votre équipe.</p>
        </div>
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
      </div>

      {guilds.length === 0 ? (
        <Card className="mx-auto max-w-md text-center">
          <CardHeader>
            <CardTitle>Aucune guilde</CardTitle>
            <CardDescription>Créez votre première guilde pour commencer.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {guilds.map((guild) => (
            <GuildCard
              key={guild.id}
              guild={guild}
              getToken={getToken}
              onChange={loadGuilds}
              onDeleteRequest={() => setDeleteTarget(guild)}
            />
          ))}
        </div>
      )}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer "{deleteTarget?.name}" ?</DialogTitle>
            <DialogDescription>Cette action est irréversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
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

interface GuildCardProps {
  guild: Guild;
  getToken: () => Promise<string | null>;
  onChange: () => Promise<void>;
  onDeleteRequest: () => void;
}

function GuildCard({ guild, getToken, onChange, onDeleteRequest }: GuildCardProps) {
  const canManage = guild.role === 'owner' || guild.role === 'admin';
  const canDelete = guild.role === 'owner';
  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'member'>('member');
  const [submitting, setSubmitting] = useState(false);

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberUserId.trim()) return;
    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await addGuildMember(token, {
        guild_id: guild.id,
        user_id: memberUserId.trim(),
        role: memberRole,
      });
      setMemberUserId('');
      toast.success('Membre ajouté');
      await onChange();
    } catch (error) {
      toast.error("Impossible d'ajouter ce membre", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await removeGuildMember(token, { guild_id: guild.id, user_id: userId });
      toast.success('Membre retiré');
      await onChange();
    } catch (error) {
      toast.error('Impossible de retirer ce membre', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="size-4 text-muted-foreground" />
            {guild.name}
          </CardTitle>
          <CardDescription>{guild.description || guild.slug}</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {guild.role}
          </Badge>
          {canDelete && (
            <Button
              variant="destructive"
              size="icon-sm"
              aria-label="Supprimer la guilde"
              onClick={onDeleteRequest}
            >
              <Trash2Icon />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead>Rôle</TableHead>
              {canManage && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {guild.members.map((member) => (
              <TableRow key={member.user_id}>
                <TableCell>{member.display_name || member.user_id}</TableCell>
                <TableCell className="capitalize">{member.role}</TableCell>
                {canManage && (
                  <TableCell>
                    {member.role !== 'owner' && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Retirer ce membre"
                        onClick={() => handleRemoveMember(member.user_id)}
                      >
                        <Trash2Icon />
                      </Button>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {canManage && (
          <>
            <Separator />
            <form onSubmit={handleAddMember} className="flex flex-wrap gap-2">
              <Input
                value={memberUserId}
                onChange={(event) => setMemberUserId(event.target.value)}
                placeholder="ID utilisateur Clerk"
                aria-label="ID utilisateur"
                className="flex-1"
              />
              <Select
                value={memberRole}
                onValueChange={(value) => setMemberRole((value as 'admin' | 'member') ?? 'member')}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membre</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={submitting || !memberUserId.trim()}>
                <PlusIcon />
                Ajouter
              </Button>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
}
