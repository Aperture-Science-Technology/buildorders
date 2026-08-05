import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import type { BuildOrder, GameMode, MatchupNote, Phase, Visibility } from '@/lib/types';
import { parseBuildOrderUrl, type BuildOrderInput } from '@/lib/api';
import { VISIBILITY_OPTIONS } from '@/components/VisibilityBadge';
import { CIV_NAMES } from '@/lib/civs';
import { iconIdFromDescription } from '@/lib/gameIcons';
import { BuildOrderEditor } from '@/components/BuildOrderEditor';
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
import { PlusIcon, Trash2Icon, ChevronDownIcon } from 'lucide-react';

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
  { value: 'aoeivbuilds', label: 'aoeivbuilds.com' },
  { value: 'manual', label: 'Manuel' },
];

const GAME_MODE_OPTIONS: { value: GameMode; label: string }[] = [
  { value: '1v1', label: '1v1' },
  { value: '2v2', label: '2v2' },
  { value: '3v3', label: '3v3' },
  { value: '4v4', label: '4v4' },
  { value: 'ffa', label: 'FFA' },
];

const DIFFICULTY_OPTIONS: { value: string; label: string }[] = [
  { value: '1', label: '1 - Très simple' },
  { value: '2', label: '2 - Simple' },
  { value: '3', label: '3 - Moyen' },
  { value: '4', label: '4 - Difficile' },
  { value: '5', label: '5 - Très difficile' },
];

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
  const [visibility, setVisibility] = useState<Visibility>(initial?.visibility ?? 'public');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [phases, setPhases] = useState<Phase[]>(initial?.phases ?? []);
  const [phasesResetKey, setPhasesResetKey] = useState(0);
  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);

  const [difficulty, setDifficulty] = useState(
    initial?.difficulty ? String(initial.difficulty) : 'none',
  );
  const [gameModes, setGameModes] = useState<GameMode[]>(initial?.gameModes ?? []);
  const [strengths, setStrengths] = useState<string[]>(initial?.strengths ?? []);
  const [weaknesses, setWeaknesses] = useState<string[]>(initial?.weaknesses ?? []);
  const [matchupNotes, setMatchupNotes] = useState<MatchupNote[]>(initial?.matchupNotes ?? []);
  const [matchupNotesOpen, setMatchupNotesOpen] = useState(
    (initial?.matchupNotes?.length ?? 0) > 0,
  );

  function toggleGameMode(mode: GameMode) {
    setGameModes((prev) =>
      prev.includes(mode) ? prev.filter((value) => value !== mode) : [...prev, mode],
    );
  }

  function addStrength() {
    setStrengths((prev) => [...prev, '']);
  }

  function updateStrength(index: number, value: string) {
    setStrengths((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function removeStrength(index: number) {
    setStrengths((prev) => prev.filter((_, i) => i !== index));
  }

  function addWeakness() {
    setWeaknesses((prev) => [...prev, '']);
  }

  function updateWeakness(index: number, value: string) {
    setWeaknesses((prev) => prev.map((item, i) => (i === index ? value : item)));
  }

  function removeWeakness(index: number) {
    setWeaknesses((prev) => prev.filter((_, i) => i !== index));
  }

  function addMatchupNote() {
    setMatchupNotes((prev) => [...prev, { civ: '', note: '' }]);
  }

  function updateMatchupNote(index: number, patch: Partial<MatchupNote>) {
    setMatchupNotes((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function removeMatchupNote(index: number) {
    setMatchupNotes((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImport() {
    if (!importUrl.trim()) return;
    setImporting(true);
    try {
      const parsed = await parseBuildOrderUrl(importUrl.trim());
      setCiv(parsed.civ);
      setType(parsed.type);
      setSourceUrl(parsed.sourceUrl);
      setSourceType(parsed.sourceType);
      setNotes(parsed.notes ?? '');
      setPhases(
        parsed.phases.map((phase) => ({
          ...phase,
          actions: phase.actions.map((action) =>
            action.iconId
              ? action
              : { ...action, iconId: iconIdFromDescription(action.description) },
          ),
        })),
      );
      setPhasesResetKey((key) => key + 1);
      setGameModes(parsed.gameModes ?? []);
      setStrengths(parsed.strengths ?? []);
      setWeaknesses(parsed.weaknesses ?? []);
      setMatchupNotes(parsed.matchupNotes ?? []);
      setDifficulty(parsed.difficulty ? String(parsed.difficulty) : 'none');
      toast.success('Build order importé');
    } catch (error) {
      toast.error('Import impossible', {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setImporting(false);
    }
  }

  function handlePhasesChange(nextPhases: Phase[]) {
    setPhases(nextPhases);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const cleanedStrengths = strengths.map((item) => item.trim()).filter(Boolean);
    const cleanedWeaknesses = weaknesses.map((item) => item.trim()).filter(Boolean);
    const cleanedMatchupNotes = matchupNotes
      .map((entry) => ({ civ: entry.civ.trim(), note: entry.note.trim() }))
      .filter((entry) => entry.civ.length > 0 && entry.note.length > 0);

    const input: BuildOrderInput = {
      civ,
      type,
      sourceUrl,
      sourceType,
      notes: notes || undefined,
      gameModes: gameModes.length ? gameModes : undefined,
      strengths: cleanedStrengths.length ? cleanedStrengths : undefined,
      weaknesses: cleanedWeaknesses.length ? cleanedWeaknesses : undefined,
      matchupNotes: cleanedMatchupNotes.length ? cleanedMatchupNotes : undefined,
      difficulty: difficulty === 'none' ? undefined : Number(difficulty),
      visibility,
      phases: phases.map((phase) => ({
        ...phase,
        actions: phase.actions.filter((action) => action.description.trim().length > 0),
      })),
    };

    onSubmit(input);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Importer depuis une URL</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            type="url"
            value={importUrl}
            onChange={(event) => setImportUrl(event.target.value)}
            placeholder="https://www.aoeivbuilds.com/build_orders/118"
            aria-label="URL à importer"
          />
          <Button type="button" onClick={handleImport} disabled={importing || !importUrl.trim()}>
            {importing ? 'Import en cours…' : 'Importer'}
          </Button>
        </CardContent>
      </Card>

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
              list="civ-suggestions"
              required
            />
            <datalist id="civ-suggestions">
              {CIV_NAMES.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
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

          <div className="space-y-1.5">
            <Label htmlFor="visibility">Visibilité</Label>
            <Select
              value={visibility}
              onValueChange={(value) => setVisibility((value as Visibility) ?? 'public')}
            >
              <SelectTrigger id="visibility" className="w-full">
                <SelectValue placeholder="Visibilité" />
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

      <Card>
        <CardHeader>
          <CardTitle>Classification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="difficulty">Difficulté</Label>
              <Select value={difficulty} onValueChange={(value) => setDifficulty(value ?? 'none')}>
                <SelectTrigger id="difficulty" className="w-full">
                  <SelectValue placeholder="Non classé" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Non classé</SelectItem>
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Types de partie</Label>
              <div className="flex flex-wrap gap-2">
                {GAME_MODE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={gameModes.includes(option.value) ? 'default' : 'outline'}
                    onClick={() => toggleGameMode(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Forces</Label>
                <Button type="button" variant="outline" size="xs" onClick={addStrength}>
                  <PlusIcon />
                  Ajouter
                </Button>
              </div>
              {strengths.map((strength, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    aria-label="Force"
                    placeholder="Ex: agression rapide"
                    value={strength}
                    onChange={(event) => updateStrength(index, event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeStrength(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Faiblesses</Label>
                <Button type="button" variant="outline" size="xs" onClick={addWeakness}>
                  <PlusIcon />
                  Ajouter
                </Button>
              </div>
              {weaknesses.map((weakness, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    aria-label="Faiblesse"
                    placeholder="Ex: vulnérable au tower rush"
                    value={weakness}
                    onChange={(event) => updateWeakness(index, event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeWeakness(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          <details
            className="group space-y-3"
            open={matchupNotesOpen}
            onToggle={(event) => setMatchupNotesOpen(event.currentTarget.open)}
          >
            <summary className="flex cursor-pointer list-none items-center justify-between">
              <Label className="cursor-pointer">Notes de matchup (optionnel)</Label>
              <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
            </summary>

            <div className="space-y-3 pt-2">
              {matchupNotes.map((entry, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
                  <Input
                    aria-label="Civilisation"
                    placeholder="Civilisation"
                    value={entry.civ}
                    onChange={(event) => updateMatchupNote(index, { civ: event.target.value })}
                  />
                  <Textarea
                    aria-label="Note"
                    placeholder="Détails du matchup"
                    value={entry.note}
                    onChange={(event) => updateMatchupNote(index, { note: event.target.value })}
                    rows={1}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeMatchupNote(index)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addMatchupNote}>
                <PlusIcon />
                Ajouter un matchup
              </Button>
            </div>
          </details>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Phases</CardTitle>
        </CardHeader>
        <CardContent>
          <BuildOrderEditor
            key={phasesResetKey}
            initialPhases={phases}
            onPhasesChange={handlePhasesChange}
            heightClassName="h-[500px]"
          />
        </CardContent>
      </Card>

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
