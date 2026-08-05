import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { SignedIn, SignedOut, SignInButton, useAuth } from '@clerk/clerk-react';
import { toast } from 'sonner';
import {
  addGuildMember,
  deleteBuildOrder,
  deleteGuild,
  getMyProfile,
  listMyBuilds,
  listMyGuilds,
  removeGuildMember,
  updateBuildOrder,
  updateGuild,
  updateMyProfile,
} from '@/lib/api';
import type { BuildOrder, Guild, Profile, Visibility } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
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
import { VisibilityBadge, VISIBILITY_OPTIONS } from '@/components/VisibilityBadge';
import { CivFlag } from '@/components/CivFlag';
import { UserIcon, PlusIcon, Trash2Icon, PencilIcon, UsersIcon } from 'lucide-react';

export function ProfilePage() {
  return (
    <>
      <SignedOut>
        <Card className="mx-auto max-w-md text-center">
          <CardHeader>
            <CardTitle>Profil</CardTitle>
            <CardDescription>Connectez-vous pour voir votre profil.</CardDescription>
          </CardHeader>
          <CardContent>
            <SignInButton>
              <Button>Se connecter</Button>
            </SignInButton>
          </CardContent>
        </Card>
      </SignedOut>
      <SignedIn>
        <ProfileContent />
      </SignedIn>
    </>
  );
}

function ProfileContent() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon espace</h1>
        <p className="text-muted-foreground">Profil, builds et guilde.</p>
      </div>
      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Mon profil</TabsTrigger>
          <TabsTrigger value="builds">Mes builds</TabsTrigger>
          <TabsTrigger value="guild">Ma guilde</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <MyProfileTab />
        </TabsContent>
        <TabsContent value="builds">
          <MyBuildsTab />
        </TabsContent>
        <TabsContent value="guild">
          <MyGuildTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MyProfileTab() {
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [displayName, setDisplayName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        if (!token) throw new Error('Session expirée, reconnectez-vous.');
        const data = await getMyProfile(token);
        if (!cancelled) {
          setProfile(data);
          setDisplayName(data.display_name ?? '');
        }
      } catch (error) {
        if (cancelled) return;
        toast.error('Impossible de charger le profil', {
          description: error instanceof Error ? error.message : undefined,
        });
        setProfile(null);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [getToken]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      const updated = await updateMyProfile(token, { display_name: displayName });
      setProfile(updated);
      setDisplayName(updated.display_name ?? '');
      toast.success('Profil mis à jour');
    } catch (error) {
      toast.error('Impossible de mettre à jour le profil', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  if (profile === undefined) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (profile === null) {
    return (
      <Card className="text-center">
        <CardHeader>
          <CardTitle>Profil introuvable</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3">
        <Avatar size="lg">
          <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.display_name ?? 'Avatar'} />
          <AvatarFallback>
            <UserIcon />
          </AvatarFallback>
        </Avatar>
        <div>
          <CardTitle>{profile.display_name || 'Sans nom'}</CardTitle>
          <CardDescription>{profile.id}</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Nom affiché</Label>
            <Input
              id="display-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={40}
              disabled={saving}
            />
          </div>
          <Button type="submit" disabled={saving}>
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

const TYPE_LABELS: Record<BuildOrder['type'], string> = {
  rush: 'Rush',
  boom: 'Boom',
  turtle: 'Turtle',
  'fast-castle': 'Fast Castle',
  defensive: 'Defensive',
  other: 'Autre',
};

function MyBuildsTab() {
  const { getToken } = useAuth();
  const [builds, setBuilds] = useState<BuildOrder[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BuildOrder | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function loadBuilds() {
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      const data = await listMyBuilds(token);
      setBuilds(data);
    } catch (error) {
      toast.error('Impossible de charger vos builds', {
        description: error instanceof Error ? error.message : undefined,
      });
      setBuilds([]);
    }
  }

  useEffect(() => {
    loadBuilds();
  }, []);

  async function handleVisibilityChange(build: BuildOrder, visibility: Visibility) {
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await updateBuildOrder(build.id, { visibility }, token);
      setBuilds((prev) =>
        prev ? prev.map((item) => (item.id === build.id ? { ...item, visibility } : item)) : prev,
      );
      toast.success('Visibilité mise à jour');
    } catch (error) {
      toast.error('Impossible de changer la visibilité', {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await deleteBuildOrder(deleteTarget.id, token);
      toast.success('Build order supprimé');
      setDeleteTarget(null);
      await loadBuilds();
    } catch (error) {
      toast.error('Suppression impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDeleting(false);
    }
  }

  if (builds === null) {
    return <Skeleton className="h-48 w-full" />;
  }

  if (builds.length === 0) {
    return (
      <Card className="text-center">
        <CardHeader>
          <CardTitle>Vous n'avez pas encore créé de build</CardTitle>
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
    <Card>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titre</TableHead>
              <TableHead>Civ</TableHead>
              <TableHead>Visibilité</TableHead>
              <TableHead>Likes</TableHead>
              <TableHead>Vues</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {builds.map((build) => (
              <TableRow key={build.id}>
                <TableCell>
                  <Link to={`/build/${build.id}`} className="font-medium hover:underline">
                    {build.civ} — {TYPE_LABELS[build.type]}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    <CivFlag civ={build.civ} size="sm" />
                    {build.civ}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Select
                    value={build.visibility ?? 'public'}
                    onValueChange={(value) =>
                      value && handleVisibilityChange(build, value as Visibility)
                    }
                  >
                    <SelectTrigger className="w-32" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIBILITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <option.icon />
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>{build.likeCount ?? 0}</TableCell>
                <TableCell>{build.viewCount ?? 0}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" render={<Link to={`/edit/${build.id}`} />}>
                      <PencilIcon />
                      Éditer
                    </Button>
                    <Button variant="ghost" size="sm" render={<Link to={`/build/${build.id}`} />}>
                      Voir
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      aria-label="Supprimer ce build"
                      onClick={() => setDeleteTarget(build)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer ce build order ?</DialogTitle>
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
    </Card>
  );
}

function MyGuildTab() {
  const { getToken } = useAuth();
  const [guilds, setGuilds] = useState<Guild[] | null>(null);

  async function loadGuilds() {
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      const data = await listMyGuilds(token);
      setGuilds(data);
    } catch (error) {
      toast.error('Impossible de charger vos guildes', {
        description: error instanceof Error ? error.message : undefined,
      });
      setGuilds([]);
    }
  }

  useEffect(() => {
    loadGuilds();
  }, []);

  if (guilds === null) {
    return <Skeleton className="h-48 w-full" />;
  }

  const ownedGuild = guilds.find((guild) => guild.role === 'owner');

  if (ownedGuild) {
    return <OwnedGuildCard guild={ownedGuild} getToken={getToken} onChange={loadGuilds} />;
  }

  if (guilds.length === 0) {
    return (
      <Card className="text-center">
        <CardHeader>
          <CardTitle>Vous n'êtes membre d'aucune guilde</CardTitle>
          <CardDescription>Rejoignez une guilde depuis le répertoire.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button render={<Link to="/guilds" />}>Voir les guildes</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mes guildes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Guilde</TableHead>
              <TableHead>Rôle</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {guilds.map((guild) => (
              <TableRow key={guild.id}>
                <TableCell>{guild.name}</TableCell>
                <TableCell className="capitalize">{guild.role}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Button variant="outline" render={<Link to="/guilds" />}>
          Voir les guildes
        </Button>
      </CardContent>
    </Card>
  );
}

interface OwnedGuildCardProps {
  guild: Guild;
  getToken: () => Promise<string | null>;
  onChange: () => Promise<void>;
}

function OwnedGuildCard({ guild, getToken, onChange }: OwnedGuildCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState(guild.name);
  const [slug, setSlug] = useState(guild.slug);
  const [description, setDescription] = useState(guild.description ?? '');
  const [savingEdit, setSavingEdit] = useState(false);

  const [memberUserId, setMemberUserId] = useState('');
  const [memberRole, setMemberRole] = useState<'admin' | 'member'>('member');
  const [addingMember, setAddingMember] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingEdit(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await updateGuild(token, guild.id, { name, slug, description: description || undefined });
      toast.success('Guilde mise à jour');
      setEditOpen(false);
      await onChange();
    } catch (error) {
      toast.error('Mise à jour impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleAddMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberUserId.trim()) return;
    setAddingMember(true);
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
      setAddingMember(false);
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

  async function handleDeleteGuild() {
    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      await deleteGuild(token, guild.id);
      toast.success('Guilde supprimée');
      setDeleteOpen(false);
      await onChange();
    } catch (error) {
      toast.error('Suppression impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setDeleting(false);
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
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              <PencilIcon />
              Modifier
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleEdit} className="space-y-4">
                <DialogHeader>
                  <DialogTitle>Modifier la guilde</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-guild-name">Nom</Label>
                    <Input
                      id="edit-guild-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-guild-slug">Slug</Label>
                    <Input
                      id="edit-guild-slug"
                      value={slug}
                      onChange={(event) => setSlug(event.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="edit-guild-description">Description</Label>
                    <Textarea
                      id="edit-guild-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={savingEdit}>
                    {savingEdit ? 'Enregistrement…' : 'Enregistrer'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          <Badge variant="outline" className="capitalize">
            {guild.role}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Membre</TableHead>
              <TableHead>Rôle</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {guild.members.map((member) => (
              <TableRow key={member.user_id}>
                <TableCell>{member.display_name || member.user_id}</TableCell>
                <TableCell className="capitalize">{member.role}</TableCell>
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
              </TableRow>
            ))}
          </TableBody>
        </Table>

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
          <Button type="submit" disabled={addingMember || !memberUserId.trim()}>
            <PlusIcon />
            Ajouter
          </Button>
        </form>

        <Separator />
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogTrigger render={<Button variant="destructive" size="sm" />}>
            <Trash2Icon />
            Supprimer la guilde
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer "{guild.name}" ?</DialogTitle>
              <DialogDescription>Cette action est irréversible.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteOpen(false)}>
                Annuler
              </Button>
              <Button variant="destructive" onClick={handleDeleteGuild} disabled={deleting}>
                {deleting ? 'Suppression…' : 'Supprimer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
