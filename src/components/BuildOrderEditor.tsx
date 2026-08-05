import { useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';
import type { Action, BuildOrder, Phase } from '@/lib/types';
import { updateBuildOrder } from '@/lib/api';
import { AGE_LABELS, formatTime } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  HammerIcon,
  FlaskConicalIcon,
  SwordsIcon,
  WheatIcon,
  CogIcon,
  TrendingUpIcon,
  DotIcon,
  PlusIcon,
  Trash2Icon,
  SaveIcon,
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

const ACTION_KIND_OPTIONS: { value: NonNullable<Action['kind']>; label: string }[] = [
  { value: 'build', label: 'Build' },
  { value: 'research', label: 'Research' },
  { value: 'train', label: 'Train' },
  { value: 'gather', label: 'Gather' },
  { value: 'tech', label: 'Tech' },
  { value: 'age-up', label: 'Age Up' },
];

const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 140;
const ROW_Y_OFFSET = 80;

interface ActionNodeData extends Record<string, unknown> {
  description: string;
  at: number;
  kind?: Action['kind'];
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

interface PhaseHeaderNodeData extends Record<string, unknown> {
  age: Phase['age'];
  timeStart: number;
  phaseIndex: number;
  onAddAction: (phaseIndex: number) => void;
}

interface NodeHandlers {
  onAddAction: (phaseIndex: number) => void;
  onEditAction: (id: string) => void;
  onDeleteAction: (id: string) => void;
}

function ActionNode({ id, data }: NodeProps<Node<ActionNodeData, 'action'>>) {
  const Icon = data.kind ? ACTION_KIND_ICONS[data.kind] : DotIcon;
  return (
    <div
      className="group relative w-[280px] rounded-lg border bg-card text-card-foreground shadow-sm"
      onDoubleClick={() => data.onEdit(id)}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-start gap-3 p-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-mono text-xs text-muted-foreground">{formatTime(data.at)}</span>
          <span className="text-sm font-medium leading-snug">
            {data.description || 'Nouvelle action'}
          </span>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="nodrag opacity-0 transition-opacity group-hover:opacity-100"
          onClick={(event) => {
            event.stopPropagation();
            data.onDelete(id);
          }}
        >
          <Trash2Icon />
        </Button>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

function PhaseHeaderNode({ data }: NodeProps<Node<PhaseHeaderNodeData, 'phaseHeader'>>) {
  return (
    <div className="flex w-[280px] flex-col items-start gap-2">
      <Badge>{AGE_LABELS[data.age]}</Badge>
      <span className="font-mono text-xs text-muted-foreground">{formatTime(data.timeStart)}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="nodrag"
        onClick={() => data.onAddAction(data.phaseIndex)}
      >
        <PlusIcon />
        Action
      </Button>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  action: ActionNode,
  phaseHeader: PhaseHeaderNode,
};

function buildEditorElements(
  phases: Phase[],
  handlers: NodeHandlers,
  layout?: Record<string, { x: number; y: number }>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let previousPhaseLastActionId: string | null = null;

  phases.forEach((phase, phaseIndex) => {
    const x = phaseIndex * COLUMN_WIDTH;

    nodes.push({
      id: `phase-${phaseIndex}-header`,
      type: 'phaseHeader',
      position: { x, y: 0 },
      data: {
        age: phase.age,
        timeStart: phase.timeStart,
        phaseIndex,
        onAddAction: handlers.onAddAction,
      },
      draggable: false,
      selectable: false,
    });

    let previousActionId: string | null = null;

    phase.actions.forEach((action, actionIndex) => {
      const id = `phase-${phaseIndex}-action-${actionIndex}`;
      const defaultPosition = { x, y: actionIndex * ROW_HEIGHT + ROW_Y_OFFSET };
      nodes.push({
        id,
        type: 'action',
        position: layout?.[id] ?? defaultPosition,
        data: {
          description: action.description,
          at: action.at,
          kind: action.kind,
          onEdit: handlers.onEditAction,
          onDelete: handlers.onDeleteAction,
        },
        draggable: true,
      });

      if (previousActionId) {
        edges.push({
          id: `${previousActionId}->${id}`,
          source: previousActionId,
          target: id,
          type: 'smoothstep',
          animated: false,
        });
      } else if (previousPhaseLastActionId) {
        edges.push({
          id: `${previousPhaseLastActionId}->${id}`,
          source: previousPhaseLastActionId,
          target: id,
          type: 'smoothstep',
          animated: false,
        });
      }

      previousActionId = id;
    });

    if (previousActionId) {
      previousPhaseLastActionId = previousActionId;
    }
  });

  return { nodes, edges };
}

/**
 * Derives the phases JSON from the current node positions: phases are ordered by
 * column (x), actions within a phase by row (y) then made stable by `at` — a drag
 * that didn't touch `at` keeps its row order, ties on `at` fall back to row order.
 */
function nodesToPhases(nodes: Node[], originalPhases: Phase[]): Phase[] {
  const headers = nodes
    .filter((node): node is Node<PhaseHeaderNodeData> => node.type === 'phaseHeader')
    .slice()
    .sort((a, b) => a.position.x - b.position.x);

  const actionNodes = nodes.filter((node): node is Node<ActionNodeData> => node.type === 'action');
  const actionsByHeaderId = new Map<string, Node<ActionNodeData>[]>();
  headers.forEach((header) => actionsByHeaderId.set(header.id, []));

  for (const actionNode of actionNodes) {
    let nearestHeader: Node<PhaseHeaderNodeData> | undefined;
    let nearestDistance = Infinity;
    for (const header of headers) {
      const distance = Math.abs(header.position.x - actionNode.position.x);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestHeader = header;
      }
    }
    if (nearestHeader) actionsByHeaderId.get(nearestHeader.id)?.push(actionNode);
  }

  return headers.map((header, phaseIndex) => {
    const original = originalPhases[phaseIndex];
    const orderedActions = (actionsByHeaderId.get(header.id) ?? [])
      .slice()
      .sort((a, b) => a.position.y - b.position.y)
      .sort((a, b) => Number(a.data.at) - Number(b.data.at));

    return {
      age: header.data.age,
      timeStart: header.data.timeStart,
      targetResources: original?.targetResources,
      targetVillagers: original?.targetVillagers,
      actions: orderedActions.map((node) => ({
        at: Number(node.data.at),
        description: node.data.description,
        kind: node.data.kind,
      })),
    };
  });
}

interface EditDraft {
  id: string;
  at: string;
  description: string;
  kind: NonNullable<Action['kind']> | 'none';
}

const DEFAULT_DRAFT_PHASES: Phase[] = [{ age: 'dark', timeStart: 0, actions: [] }];

interface BuildOrderEditorProps {
  buildOrder?: BuildOrder;
  initialPhases?: Phase[];
  onPhasesChange?: (phases: Phase[]) => void;
  getToken?: () => Promise<string | null>;
  onSaved?: (updated: BuildOrder) => void;
  heightClassName?: string;
}

export function BuildOrderEditor({
  buildOrder,
  initialPhases,
  onPhasesChange,
  getToken,
  onSaved,
  heightClassName = 'h-[600px]',
}: BuildOrderEditorProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const nodesRef = useRef<Node[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const latestPhasesRef = useRef<Phase[]>(
    buildOrder?.phases ?? (initialPhases?.length ? initialPhases : DEFAULT_DRAFT_PHASES),
  );

  function originalPhasesSource(): Phase[] {
    return buildOrder ? buildOrder.phases : latestPhasesRef.current;
  }

  function requestDelete(id: string) {
    setDeleteTargetId(id);
  }

  function openEditDialog(id: string) {
    const node = nodesRef.current.find((candidate) => candidate.id === id);
    if (!node || node.type !== 'action') return;
    const data = node.data as ActionNodeData;
    setEditDraft({
      id,
      at: String(data.at),
      description: data.description,
      kind: data.kind ?? 'none',
    });
  }

  function handleAddAction(phaseIndex: number) {
    const phases = nodesToPhases(nodesRef.current, originalPhasesSource());
    const phase = phases[phaseIndex];
    if (!phase) return;
    const lastAction = phase.actions[phase.actions.length - 1];
    const at = lastAction ? lastAction.at + 30 : phase.timeStart;
    const nextPhases = phases.map((p, index) =>
      index === phaseIndex
        ? { ...p, actions: [...p.actions, { at, description: '', kind: 'build' as const }] }
        : p,
    );
    const rebuilt = buildEditorElements(nextPhases, handlers);
    setNodes(rebuilt.nodes);
    setEdges(rebuilt.edges);
  }

  const handlers: NodeHandlers = {
    onAddAction: handleAddAction,
    onEditAction: openEditDialog,
    onDeleteAction: requestDelete,
  };

  function confirmDelete() {
    if (!deleteTargetId) return;
    const remainingNodes = nodesRef.current.filter((node) => node.id !== deleteTargetId);
    const phases = nodesToPhases(remainingNodes, originalPhasesSource());
    const rebuilt = buildEditorElements(phases, handlers);
    setNodes(rebuilt.nodes);
    setEdges(rebuilt.edges);
    setDeleteTargetId(null);
  }

  function applyEdit() {
    if (!editDraft) return;
    const description = editDraft.description.trim();
    const at = Number(editDraft.at);

    if (!description) {
      toast.error('La description ne peut pas être vide.');
      return;
    }
    if (!Number.isFinite(at) || at < 0) {
      toast.error('Le temps doit être un nombre positif.');
      return;
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === editDraft.id
          ? {
              ...node,
              data: {
                ...node.data,
                at,
                description,
                kind: editDraft.kind === 'none' ? undefined : editDraft.kind,
              },
            }
          : node,
      ),
    );
    setEditDraft(null);
  }

  function addPhase() {
    const phases = nodesToPhases(nodesRef.current, originalPhasesSource());
    const lastPhase = phases[phases.length - 1];
    const timeStart = lastPhase ? lastPhase.timeStart + 60 : 0;
    const nextPhases: Phase[] = [...phases, { age: 'dark', timeStart, actions: [] }];
    const rebuilt = buildEditorElements(nextPhases, handlers);
    setNodes(rebuilt.nodes);
    setEdges(rebuilt.edges);
  }

  function resetFromSource() {
    const source = buildOrder
      ? buildOrder.phases
      : initialPhases?.length
        ? initialPhases
        : DEFAULT_DRAFT_PHASES;
    const rebuilt = buildEditorElements(source, handlers, buildOrder?.layout);
    latestPhasesRef.current = source;
    setNodes(rebuilt.nodes);
    setEdges(rebuilt.edges);
    setEditDraft(null);
    setDeleteTargetId(null);
  }

  useEffect(() => {
    resetFromSource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildOrder]);

  useEffect(() => {
    if (buildOrder) return;
    const phases = nodesToPhases(nodes, latestPhasesRef.current);
    latestPhasesRef.current = phases;
    onPhasesChange?.(phases);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  const onConnect: OnConnect = (connection) => {
    setEdges((current) => addEdge({ ...connection, type: 'smoothstep' }, current));
  };

  async function handleSave() {
    if (!buildOrder || !getToken) return;
    const currentNodes = nodesRef.current;
    const actionNodes = currentNodes.filter(
      (node): node is Node<ActionNodeData> => node.type === 'action',
    );

    for (const node of actionNodes) {
      if (!node.data.description.trim()) {
        toast.error('Chaque action doit avoir une description.');
        return;
      }
      const at = Number(node.data.at);
      if (!Number.isFinite(at) || at < 0) {
        toast.error("Le temps d'une action doit être un nombre positif.");
        return;
      }
    }

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Vous devez être connecté pour enregistrer.');
        return;
      }
      const phases = nodesToPhases(currentNodes, originalPhasesSource());
      const updated = await updateBuildOrder(buildOrder.id, { phases }, token);
      toast.success('Build order enregistré.');
      onSaved?.(updated);
    } catch (error) {
      toast.error("Impossible d'enregistrer le build order", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`flex ${heightClassName} flex-col`}>
      <div className="mb-3 flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={addPhase}>
          <PlusIcon />
          Ajouter une phase
        </Button>
        <div className="flex-1" />
        {buildOrder && (
          <>
            <Button type="button" variant="outline" size="sm" onClick={resetFromSource}>
              <XIcon />
              Annuler
            </Button>
            <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
              <SaveIcon />
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
          panOnDrag
          zoomOnScroll
          zoomOnPinch
          selectionOnDrag
          panOnScroll={false}
          nodesDraggable={true}
          nodesConnectable={true}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      <Dialog open={editDraft !== null} onOpenChange={(open) => !open && setEditDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l&apos;action</DialogTitle>
            <DialogDescription>Ajustez l&apos;instant, la description et le type.</DialogDescription>
          </DialogHeader>
          {editDraft && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="action-at">Instant (secondes)</Label>
                <Input
                  id="action-at"
                  type="number"
                  min={0}
                  value={editDraft.at}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, at: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="action-description">Description</Label>
                <Textarea
                  id="action-description"
                  value={editDraft.description}
                  onChange={(event) =>
                    setEditDraft({ ...editDraft, description: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="action-kind">Type</Label>
                <Select
                  value={editDraft.kind}
                  onValueChange={(value) =>
                    setEditDraft({ ...editDraft, kind: (value ?? 'none') as EditDraft['kind'] })
                  }
                >
                  <SelectTrigger id="action-kind" className="w-full">
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
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDraft(null)}>
              Annuler
            </Button>
            <Button onClick={applyEdit}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTargetId !== null}
        onOpenChange={(open) => !open && setDeleteTargetId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette action ?</DialogTitle>
            <DialogDescription>Cette action sera retirée du build order.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTargetId(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
