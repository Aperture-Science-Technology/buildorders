import { useEffect, useState, type FormEvent } from 'react';
import { SignedIn, SignedOut, SignInButton, useAuth } from '@clerk/clerk-react';
import { toast } from 'sonner';
import { getMyProfile, updateMyProfile } from '@/lib/api';
import type { Profile } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserIcon } from 'lucide-react';

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
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (profile === null) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>Profil introuvable</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Mon profil</h1>
        <p className="text-muted-foreground">Vos informations de compte.</p>
      </div>
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
    </div>
  );
}
