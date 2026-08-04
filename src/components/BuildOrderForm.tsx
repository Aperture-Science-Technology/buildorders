import { useState, type FormEvent } from 'react';
import type { BuildOrder, Action, Phase } from '@/lib/types';
import type { BuildOrderInput } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PlusIcon, Trash2Icon } from 'lucide-react';

const TYPE_OPTIONS: { value: BuildOrder['type']; label: string }[] = [
  { value: 'rush', label: 'Rush' },
  { value: 'boom', label: 'Boom' },
  { value: 'turtle', label: 'Turtle' },
  { value: 'fast-castle', label: 'Fast Castle' },
  { value: 'defensive', label: 'Defensive' },
  { value: 'other', label: 'Autre' },
];

const SOURCE_TYPE_OPTIONS: { value: BuildOrder['sourceType']; label: string }[] = [
  { value: 'aoe4world', label: 'aoe4world.com' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'ageofempires', label: 'ageofempires.com' },
  { value: 'manual', label: 'Manuel' },
];

const AGE_OPTIONS: { value: Phase['age']; label: string }[] = [
  { value: 'dark', label: 'Dark Age' },
  { value: 'feudal', label: 'Feudal Age' },
  { value: 'castle', label: 'Castle Age' },
  { value: 'imperial', label: 'Imperial Age' },
];

const ACTION_KIND_OPTIONS: { value: NonNullable<Action['kind']>; label: string }[] = [
  { value: 'build', label: 'Build' },
  { value: 'research', label: 'Research' },
  { value: 'train', label: 'Train' },
  { value: 'gather', label: 'Gather' },
  { value: 'tech', label: 'Tech' },
  { value: 'age-up', label: 'Age Up' },
];

interface ActionDraft {
  at: string;
  description: string;
  kind: Action['kind'] | 'none';
}

interface PhaseDraft {
  age: Phase['age'];
  timeStart: string;
  targetVillagers: string;
  actions: ActionDraft[];
}

function phaseToDraft(phase: Phase): PhaseDraft {
  return {
    age: phase.age,
    timeStart: String(phase.timeStart),
    targetVillagers: phase.targetVillagers !== undefined ? String(phase.targetVillagers) : '',
    actions: phase.actions.map((action) => ({
      at: String(action.at),
      description: action.description,
      kind: action.kind ?? 'none',
    })),
  };
}

function emptyPhase(): PhaseDraft {
  return { age: 'dark', timeStart: '0', targetVillagers: '', actions: [] };
}

function emptyAction(): ActionDraft {
  return { at: '0', description: '', kind: 'none' };
}

interface BuildOrderFormProps {
  initial?: BuildOrder;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: BuildOrderInput) => void;
}

export function BuildOrderForm({
  initial,
  submitLabel,
  submitting,
  onSubmit,
}: BuildOrderFormProps) {
  const [civ, setCiv] = useState(initial?.civ ?? '');
  const [type, setType] = useState<BuildOrder['type']>(initial?.type ?? 'fast-castle');
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? '');
  const [sourceType, setSourceType] = useState<BuildOrder['sourceType']>(
    initial?.sourceType ?? 'manual',
  );
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [phases, setPhases] = useState<PhaseDraft[]>(
    initial?.phases.length ? initial.phases.map(phaseToDraft) : [emptyPhase()],
  );

  function updatePhase(index: number, patch: Partial<PhaseDraft>) {
    setPhases((prev) => prev.map((phase, i) => (i === index ? { ...phase, ...patch } : phase)));
  }

  function addPhase() {
    setPhases((prev) => [...prev, emptyPhase()]);
  }

  function removePhase(index: number) {
    setPhases((prev) => prev.filter((_, i) => i !== index));
  }

  function addAction(phaseIndex: number) {
    setPhases((prev) =>
      prev.map((phase, i) =>
        i === phaseIndex ? { ...phase, actions: [...phase.actions, emptyAction()] } : phase,
      ),
    );
  }

  function updateAction(phaseIndex: number, actionIndex: number, patch: Partial<ActionDraft>) {
    setPhases((prev) =>
      prev.map((phase, i) =>
        i === phaseIndex
          ? {
              ...phase,
              actions: phase.actions.map((action, j) =>
                j === actionIndex ? { ...action, ...patch } : action,
              ),
            }
          : phase,
      ),
    );
  }

  function removeAction(phaseIndex: number, actionIndex: number) {
    setPhases((prev) =>
      prev.map((phase, i) =>
        i === phaseIndex
          ? { ...phase, actions: phase.actions.filter((_, j) => j !== actionIndex) }
          : phase,
      ),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const input: BuildOrderInput = {
      civ,
      type,
      sourceUrl,
      sourceType,
      notes: notes || undefined,
      phases: phases.map((phase) => ({
        age: phase.age,
        timeStart: Number(phase.timeStart) || 0,
        targetVillagers: phase.targetVillagers ? Number(phase.targetVillagers) : undefined,
        actions: phase.actions
          .filter((action) => action.description.trim().length > 0)
          .map((action) => ({
            at: Number(action.at) || 0,
            description: action.description.trim(),
            kind: action.kind === 'none' ? undefined : action.kind,
          })),
      })),
    };

    onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Informations générales</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="civ">Civilisation</Label>
            <Input
              id="civ"
              value={civ}
              onChange={(event) => setCiv(event.target.value)}
              placeholder="Holy Roman Empire"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as BuildOrder['type'])}>
              <SelectTrigger id="type" className="w-full">
                <SelectValue placeholder="Type de build" />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sourceUrl">URL source</Label>
            <Input
              id="sourceUrl"
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://aoe4world.com/build-orders/..."
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="sourceType">Type de source</Label>
            <Select
              value={sourceType}
              onValueChange={(value) => setSourceType(value as BuildOrder['sourceType'])}
            >
              <SelectTrigger id="sourceType" className="w-full">
                <SelectValue placeholder="Type de source" />
              </SelectTrigger>
              <SelectContent>
                {SOURCE_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Détails, timings clés, pièges à éviter…"
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Phases</h2>
          <Button type="button" variant="outline" size="sm" onClick={addPhase}>
            <PlusIcon />
            Ajouter une phase
          </Button>
        </div>

        {phases.map((phase, phaseIndex) => (
          <Card key={phaseIndex}>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Phase {phaseIndex + 1}</CardTitle>
              {phases.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removePhase(phaseIndex)}
                >
                  <Trash2Icon />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label>Âge</Label>
                  <Select
                    value={phase.age}
                    onValueChange={(value) =>
                      updatePhase(phaseIndex, { age: value as Phase['age'] })
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Âge" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Début (secondes)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={phase.timeStart}
                    onChange={(event) =>
                      updatePhase(phaseIndex, { timeStart: event.target.value })
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Villageois cible</Label>
                  <Input
                    type="number"
                    min={0}
                    value={phase.targetVillagers}
                    onChange={(event) =>
                      updatePhase(phaseIndex, { targetVillagers: event.target.value })
                    }
                  />
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Actions</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={() => addAction(phaseIndex)}
                  >
                    <PlusIcon />
                    Ajouter une action
                  </Button>
                </div>

                {phase.actions.map((action, actionIndex) => (
                  <div
                    key={actionIndex}
                    className="grid gap-2 sm:grid-cols-[5rem_1fr_9rem_auto] sm:items-center"
                  >
                    <Input
                      type="number"
                      min={0}
                      aria-label="Instant (secondes)"
                      placeholder="s"
                      value={action.at}
                      onChange={(event) =>
                        updateAction(phaseIndex, actionIndex, { at: event.target.value })
                      }
                    />
                    <Input
                      aria-label="Description"
                      placeholder="Description de l'action"
                      value={action.description}
                      onChange={(event) =>
                        updateAction(phaseIndex, actionIndex, { description: event.target.value })
                      }
                    />
                    <Select
                      value={action.kind}
                      onValueChange={(value) =>
                        updateAction(phaseIndex, actionIndex, {
                          kind: value as ActionDraft['kind'],
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">—</SelectItem>
                        {ACTION_KIND_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeAction(phaseIndex, actionIndex)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Enregistrement…' : submitLabel}
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
