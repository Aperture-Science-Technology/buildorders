import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@clerk/clerk-react';
import { listBuildOrders } from '@/lib/api';
import type { BuildOrder, GameMode } from '@/lib/types';
import { CivFlag } from '@/components/CivFlag';
import { LikeButton } from '@/components/LikeButton';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisibilityBadge, VISIBILITY_OPTIONS } from '@/components/VisibilityBadge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ownerDisplayName, ownerInitial } from '@/lib/format';
import { PlusIcon, LayersIcon, StarIcon, XIcon } from 'lucide-react';

type SortOption = 'recent' | 'views' | 'likes';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recent', label: 'Plus récents' },
  { value: 'views', label: 'Plus vus' },
  { value: 'likes', label: 'Plus populaires' },
];

const TYPE_LABELS: Record<BuildOrder['type'], string> = {
  rush: 'Rush',
  boom: 'Boom',
  turtle: 'Turtle',
  'fast-castle': 'Fast Castle',
  defensive: 'Defensive',
  other: 'Autre',
};

const GAME_MODE_OPTIONS: { value: GameMode; label: string }[] = [
  { value: '1v1', label: '1v1' },
  { value: '2v2', label: '2v2' },
  { value: '3v3', label: '3v3' },
  { value: '4v4', label: '4v4' },
  { value: 'ffa', label: 'FFA' },
];

const TYPE_OPTIONS: { value: BuildOrder['type']; label: string }[] = [
  { value: 'rush', label: 'Rush' },
  { value: 'boom', label: 'Boom' },
  { value: 'turtle', label: 'Turtle' },
  { value: 'fast-castle', label: 'Fast Castle' },
  { value: 'defensive', label: 'Defensive' },
  { value: 'other', label: 'Autre' },
];

const DIFFICULTY_OPTIONS = ['1', '2', '3', '4', '5'];

export function ListPage() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const civFilter = searchParams.get('civ');
  const [buildOrders, setBuildOrders] = useState<BuildOrder[] | null>(null);
  const [search, setSearch] = useState('');
  const [gameModeFilter, setGameModeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [difficultyFilter, setDifficultyFilter] = useState('all');
  const [visibilityFilter, setVisibilityFilter] = useState('all');
  const [sort, setSort] = useState<SortOption>('recent');

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;

    async function load() {
      try {
        const token = isSignedIn ? ((await getToken()) ?? undefined) : undefined;
        const data = await listBuildOrders(token ? { token, sort } : { sort });
        if (!cancelled) setBuildOrders(data);
      } catch (error) {
        if (cancelled) return;
        toast.error('Impossible de charger les build orders', {
          description: error instanceof Error ? error.message : undefined,
        });
        setBuildOrders([]);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken, sort]);

  function updateBuildOrderLikeState(id: string, liked: boolean, likeCount: number) {
    setBuildOrders((prev) =>
      prev ? prev.map((item) => (item.id === id ? { ...item, liked, likeCount } : item)) : prev,
    );
  }

  function clearCivFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('civ');
    setSearchParams(next);
  }

  const filteredBuildOrders = useMemo(() => {
    if (!buildOrders) return [];
    const query = search.trim().toLowerCase();
    const civQuery = civFilter?.trim().toLowerCase();

    return buildOrders.filter((buildOrder) => {
      if (civQuery && buildOrder.civ.trim().toLowerCase() !== civQuery) return false;
      if (query && !buildOrder.civ.toLowerCase().includes(query)) return false;
      if (gameModeFilter !== 'all' && !buildOrder.gameModes?.includes(gameModeFilter as GameMode)) {
        return false;
      }
      if (typeFilter !== 'all' && buildOrder.type !== typeFilter) return false;
      if (difficultyFilter !== 'all' && buildOrder.difficulty !== Number(difficultyFilter)) {
        return false;
      }
      if (visibilityFilter !== 'all' && (buildOrder.visibility ?? 'public') !== visibilityFilter) {
        return false;
      }
      return true;
    });
  }, [buildOrders, search, civFilter, gameModeFilter, typeFilter, difficultyFilter, visibilityFilter]);

  const hasActiveFilters =
    search.trim() !== '' ||
    gameModeFilter !== 'all' ||
    typeFilter !== 'all' ||
    difficultyFilter !== 'all' ||
    visibilityFilter !== 'all';

  function resetFilters() {
    setSearch('');
    setGameModeFilter('all');
    setTypeFilter('all');
    setDifficultyFilter('all');
    setVisibilityFilter('all');
  }

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Build orders</h1>
          <p className="text-muted-foreground">
            {filteredBuildOrders.length} build order{filteredBuildOrders.length > 1 ? 's' : ''}
            {hasActiveFilters ? ` sur ${buildOrders.length}` : ''}
          </p>
          {civFilter && (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Builds : {civFilter}</Badge>
              <Button type="button" variant="ghost" size="xs" onClick={clearCivFilter}>
                <XIcon />
                Retirer le filtre
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Trier par</Label>
          <Select value={sort} onValueChange={(value) => setSort((value as SortOption) ?? 'recent')}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1.5">
            <Label htmlFor="search">Recherche</Label>
            <Input
              id="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Civilisation…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Type de partie</Label>
            <Select value={gameModeFilter} onValueChange={(value) => setGameModeFilter(value ?? 'all')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {GAME_MODE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value ?? 'all')}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tous" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Difficulté</Label>
            <Select
              value={difficultyFilter}
              onValueChange={(value) => setDifficultyFilter(value ?? 'all')}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Toutes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {DIFFICULTY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}/5
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Visibilité</Label>
            <div className="flex gap-2">
              <Select
                value={visibilityFilter}
                onValueChange={(value) => setVisibilityFilter(value ?? 'all')}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Toutes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes</SelectItem>
                  {VISIBILITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <option.icon />
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button type="button" variant="outline" onClick={resetFilters}>
                  Réinitialiser
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {filteredBuildOrders.length === 0 ? (
        <Card className="mx-auto max-w-md text-center">
          <CardHeader>
            <CardTitle>Aucun résultat</CardTitle>
            <CardDescription>Essayez d'ajuster ou de réinitialiser les filtres.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBuildOrders.map((buildOrder) => (
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
                      onChange={(liked, likeCount) =>
                        updateBuildOrderLikeState(buildOrder.id, liked, likeCount)
                      }
                    />
                  </CardAction>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-2">
                    <Badge>{TYPE_LABELS[buildOrder.type]}</Badge>
                    <VisibilityBadge visibility={buildOrder.visibility ?? 'public'} />
                    <Badge variant="outline">
                      <LayersIcon />
                      {buildOrder.phases.length} phase{buildOrder.phases.length > 1 ? 's' : ''}
                    </Badge>
                    {buildOrder.gameModes?.map((mode) => (
                      <Badge key={mode} variant="secondary">
                        {mode.toUpperCase()}
                      </Badge>
                    ))}
                  </div>
                  {buildOrder.difficulty && (
                    <div className="flex items-center gap-1 text-muted-foreground">
                      {Array.from({ length: 5 }).map((_, index) => (
                        <StarIcon
                          key={index}
                          className={
                            index < buildOrder.difficulty!
                              ? 'size-3.5 fill-primary text-primary'
                              : 'size-3.5 text-muted-foreground'
                          }
                        />
                      ))}
                    </div>
                  )}
                  {buildOrder.owner && (
                    <div className="flex items-center gap-2">
                      <Avatar className="size-5">
                        <AvatarImage src={buildOrder.owner.avatar_url ?? undefined} />
                        <AvatarFallback>{ownerInitial(buildOrder.owner)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {ownerDisplayName(buildOrder.owner)}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
