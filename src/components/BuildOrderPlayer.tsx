import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Action, BuildOrder, Phase } from '@/lib/types';
import { AGE_LABELS, formatTime } from '@/lib/format';
import { civFlag } from '@/lib/civs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  HammerIcon,
  FlaskConicalIcon,
  SwordsIcon,
  WheatIcon,
  CogIcon,
  TrendingUpIcon,
  DotIcon,
  PlayIcon,
  PauseIcon,
  RotateCcwIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';

const ACTION_KIND_ICONS: Record<NonNullable<Action['kind']>, LucideIcon> = {
  build: HammerIcon,
  research: FlaskConicalIcon,
  train: SwordsIcon,
  gather: WheatIcon,
  tech: CogIcon,
  'age-up': TrendingUpIcon,
};

const TICK_MS = 250;

interface TimelineEntry {
  at: number;
  description: string;
  kind?: Action['kind'];
  phaseAge: Phase['age'];
}

function buildTimeline(buildOrder: BuildOrder): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  for (const phase of buildOrder.phases) {
    for (const action of phase.actions) {
      entries.push({
        at: action.at,
        description: action.description,
        kind: action.kind,
        phaseAge: phase.age,
      });
    }
  }
  return entries.sort((a, b) => a.at - b.at);
}

interface BuildOrderPlayerProps {
  buildOrder: BuildOrder;
}

export function BuildOrderPlayer({ buildOrder }: BuildOrderPlayerProps) {
  const navigate = useNavigate();
  const timeline = useMemo(() => buildTimeline(buildOrder), [buildOrder]);
  const duration = timeline.length > 0 ? timeline[timeline.length - 1].at : 0;

  const [now, setNow] = useState(0);
  const [playing, setPlaying] = useState(true);
  const startRef = useRef<number>(Date.now());
  const baseRef = useRef<number>(0);

  const finished = timeline.length > 0 && now >= duration;

  useEffect(() => {
    if (!playing || finished) return;

    startRef.current = Date.now();
    baseRef.current = now;

    const interval = setInterval(() => {
      const elapsed = (Date.now() - startRef.current) / 1000;
      setNow(Math.min(baseRef.current + elapsed, duration));
    }, TICK_MS);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, finished, duration]);

  useEffect(() => {
    if (finished) setPlaying(false);
  }, [finished]);

  const currentIndex = useMemo(() => {
    let index = 0;
    for (let i = 0; i < timeline.length; i++) {
      if (timeline[i].at <= now) index = i;
      else break;
    }
    return index;
  }, [timeline, now]);

  const currentAction = timeline[currentIndex];
  const nextAction = timeline[currentIndex + 1];

  function handleRestart() {
    setNow(0);
    setPlaying(true);
  }

  function handleQuit() {
    navigate(`/build/${buildOrder.id}`);
  }

  function goToIndex(index: number) {
    const clamped = Math.max(0, Math.min(index, timeline.length - 1));
    setNow(timeline[clamped].at);
    setPlaying(false);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === ' ') {
        event.preventDefault();
        if (finished) {
          handleRestart();
        } else {
          setPlaying((p) => !p);
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        goToIndex(currentIndex + 1);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        goToIndex(currentIndex - 1);
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        handleRestart();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        handleQuit();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, timeline, finished]);

  if (timeline.length === 0) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="text-lg text-muted-foreground">
          Ce build order ne contient aucune action à présenter.
        </p>
        <Button variant="outline" onClick={handleQuit}>
          <XIcon />
          Retour
        </Button>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-6 text-center">
        <h1 className="text-4xl font-semibold">Build terminé</h1>
        <p className="text-muted-foreground">
          <span aria-hidden="true">{civFlag(buildOrder.civ)}</span> {buildOrder.civ} ·{' '}
          {formatTime(duration)}
        </p>
        <div className="flex gap-3">
          <Button onClick={handleRestart}>
            <RotateCcwIcon />
            Rejouer
          </Button>
          <Button variant="outline" onClick={handleQuit}>
            <XIcon />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  const Icon = currentAction.kind ? ACTION_KIND_ICONS[currentAction.kind] : DotIcon;
  const progressToNext = nextAction
    ? Math.min(1, (now - currentAction.at) / (nextAction.at - currentAction.at))
    : 1;
  const globalProgress = duration > 0 ? Math.min(1, now / duration) : 1;

  return (
    <div className="flex min-h-[80vh] flex-col gap-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">{civFlag(buildOrder.civ)}</span>
          <span className="text-sm font-medium text-muted-foreground">{buildOrder.civ}</span>
          <Badge variant="outline">{buildOrder.type}</Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleQuit}>
          <XIcon />
          Quitter
        </Button>
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="font-mono text-6xl font-bold tracking-tight sm:text-7xl">
          {formatTime(Math.floor(now))}
        </span>
        <div className="h-1 w-full max-w-md overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${progressToNext * 100}%` }}
          />
        </div>
      </div>

      <Card className="flex-1">
        <CardContent className="flex h-full flex-col items-center justify-center gap-6 py-12 text-center">
          <Badge>{AGE_LABELS[currentAction.phaseAge]}</Badge>
          <div className="flex flex-col items-center gap-4">
            <div className="flex size-20 items-center justify-center rounded-full bg-muted">
              <Icon className="size-10 text-foreground" />
            </div>
            <p className="max-w-2xl text-3xl font-semibold sm:text-4xl">
              {currentAction.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {nextAction && (
        <p className="text-center text-sm text-muted-foreground">
          Prochaine : {formatTime(nextAction.at)} — {nextAction.description}
        </p>
      )}

      <div className="space-y-3">
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width]"
            style={{ width: `${globalProgress * 100}%` }}
          />
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToIndex(currentIndex - 1)}
            disabled={currentIndex === 0}
          >
            <ChevronLeftIcon />
          </Button>
          <Button size="icon" onClick={() => setPlaying((p) => !p)}>
            {playing ? <PauseIcon /> : <PlayIcon />}
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => goToIndex(currentIndex + 1)}
            disabled={currentIndex >= timeline.length - 1}
          >
            <ChevronRightIcon />
          </Button>
          <Button variant="outline" size="icon" onClick={handleRestart}>
            <RotateCcwIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
