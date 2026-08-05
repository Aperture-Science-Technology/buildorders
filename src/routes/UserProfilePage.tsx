import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@clerk/clerk-react';
import { getUserBuilds, getUserProfile } from '@/lib/api';
import type { BuildOrder, PublicUserProfile } from '@/lib/types';
import { CivFlag } from '@/components/CivFlag';
import { LikeButton } from '@/components/LikeButton';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { UserIcon, LayersIcon } from 'lucide-react';

const TYPE_LABELS: Record<BuildOrder['type'], string> = {
  rush: 'Rush',
  boom: 'Boom',
  turtle: 'Turtle',
  'fast-castle': 'Fast Castle',
  defensive: 'Defensive',
  other: 'Autre',
};

export function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [profile, setProfile] = useState<PublicUserProfile | null | undefined>(undefined);
  const [builds, setBuilds] = useState<BuildOrder[] | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    async function load() {
      try {
        const token = await getToken();
        const [profileData, buildsData] = await Promise.all([
          getUserProfile(id!, token),
          getUserBuilds(id!, token),
        ]);
        if (!cancelled) {
          setProfile(profileData);
          setBuilds(buildsData);
        }
      } catch (error) {
        if (cancelled) return;
        toast.error('Impossible de charger ce profil', {
          description: error instanceof Error ? error.message : undefined,
        });
        setProfile(null);
        setBuilds([]);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [id, getToken]);

  if (profile === undefined) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-36" />
          ))}
        </div>
      </div>
    );
  }

  if (profile === null) {
    return (
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>Utilisateur introuvable</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  const displayName = profile.display_name?.trim() ? profile.display_name : 'Utilisateur inconnu';
  const primaryGuild = profile.guilds[0];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader className="flex-row items-center gap-4">
          <Avatar size="lg">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={displayName} />
            <AvatarFallback>
              <UserIcon />
            </AvatarFallback>
          </Avatar>
          <div className="space-y-1.5">
            <CardTitle className="text-xl">{displayName}</CardTitle>
            {primaryGuild && (
              <Link to="/guilds">
                <Badge variant="secondary">{primaryGuild.name}</Badge>
              </Link>
            )}
          </div>
        </CardHeader>
      </Card>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">Builds publics</h2>
        {builds === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-36" />
            ))}
          </div>
        ) : builds.length === 0 ? (
          <Card className="mx-auto max-w-md text-center">
            <CardHeader>
              <CardTitle>Aucun build public</CardTitle>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {builds.map((buildOrder) => (
              <Link key={buildOrder.id} to={`/build/${buildOrder.id}`}>
                <Card className="h-full transition-colors hover:bg-muted/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CivFlag civ={buildOrder.civ} size="sm" />
                      {buildOrder.civ}
                    </CardTitle>
                    <CardDescription className="capitalize">{buildOrder.sourceType}</CardDescription>
                    <CardAction>
                      <LikeButton
                        buildId={buildOrder.id}
                        liked={buildOrder.liked ?? false}
                        likeCount={buildOrder.likeCount ?? 0}
                      />
                    </CardAction>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Badge>{TYPE_LABELS[buildOrder.type]}</Badge>
                      <Badge variant="outline">
                        <LayersIcon />
                        {buildOrder.phases.length} phase{buildOrder.phases.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
