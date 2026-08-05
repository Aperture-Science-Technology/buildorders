import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type NodeProps,
  type NodeTypes,
  type OnConnect,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toast } from 'sonner';
import type { Action, ActionBranch, BuildOrder, Phase } from '@/lib/types';
import { updateBuildOrder } from '@/lib/api';
import { AGE_LABELS, formatTime } from '@/lib/format';
import { GAME_ICONS } from '@/lib/gameIcons';
import { ActionDescription } from '@/components/ActionDescription';
import { cn } from '@/lib/utils';
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
import { EditorContextMenu, type ContextMenuItem } from '@/components/EditorContextMenu';
import {
  PlusIcon,
  Trash2Icon,
  SaveIcon,
  XIcon,
  Link2Icon,
  Link2OffIcon,
  ArrowDownUpIcon,
  PencilIcon,
  Rows3Icon,
  SplitIcon,
  GitBranchIcon,
} from 'lucide-react';

const AGE_OPTIONS: { value: Phase['age']; label: string }[] = [
  { value: 'dark', label: AGE_LABELS.dark },
  { value: 'feudal', label: AGE_LABELS.feudal },
  { value: 'castle', label: AGE_LABELS.castle },
  { value: 'imperial', label: AGE_LABELS.imperial },
];

function generateActionId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

/** Kahn-style topological sort with `at` as a tiebreaker among ready nodes; leftover ids on cycle. */
function topologicalOrder(
  items: { id: string; at: number; dependsOn: string[] }[],
): { order: string[]; cyclic: string[] } {
  const ids = new Set(items.map((item) => item.id));
  const remaining = new Map(items.map((item) => [item.id, item]));
  const order: string[] = [];

  while (remaining.size > 0) {
    const ready = [...remaining.values()].filter((item) =>
      item.dependsOn.every((dep) => !ids.has(dep) || !remaining.has(dep)),
    );
    if (ready.length === 0) break;
    ready.sort((a, b) => a.at - b.at || items.indexOf(a) - items.indexOf(b));
    order.push(ready[0].id);
    remaining.delete(ready[0].id);
  }

  return { order, cyclic: [...remaining.keys()] };
}

/** DFS cycle detection over the dependsOn graph; returns the cyclic chain of ids, or null. */
function findDependencyCycle(items: { id: string; dependsOn: string[] }[]): string[] | null {
  const dependsOnMap = new Map(items.map((item) => [item.id, item.dependsOn]));
  const color = new Map<string, 1 | 2>();
  const stack: string[] = [];
  let cycle: string[] | null = null;

  function visit(id: string) {
    if (cycle) return;
    color.set(id, 1);
    stack.push(id);
    for (const dep of dependsOnMap.get(id) ?? []) {
      if (cycle) return;
      if (!dependsOnMap.has(dep)) continue;
      const state = color.get(dep);
      if (state === 1) {
        const idx = stack.indexOf(dep);
        cycle = stack.slice(idx).concat(dep);
        return;
      }
      if (state !== 2) visit(dep);
    }
    stack.pop();
    color.set(id, 2);
  }

  for (const item of items) {
    if (cycle) break;
    if (!color.has(item.id)) visit(item.id);
  }
  return cycle;
}

/** Flattens actions and, recursively, every branch's actions — used for save-time validation. */
function flattenActionsDeep(actions: Action[]): Action[] {
  const result: Action[] = [];
  for (const action of actions) {
    result.push(action);
    for (const branch of action.branches ?? []) {
      result.push(...flattenActionsDeep(branch.actions));
    }
  }
  return result;
}

const ACTION_KIND_OPTIONS: { value: NonNullable<Action['kind']>; label: string }[] = [
  { value: 'build', label: 'Build' },
  { value: 'research', label: 'Research' },
  { value: 'train', label: 'Train' },
  { value: 'gather', label: 'Gather' },
  { value: 'tech', label: 'Tech' },
  { value: 'age-up', label: 'Age Up' },
];

const COLUMN_WIDTH = 360;
const ROW_HEIGHT = 180;
const ROW_Y_OFFSET = 100;
const CURSOR_NODE_ID = '__cursor__';
/** Edge color for decision -> branch links (matches the amber decision border/badge). */
const BRANCH_EDGE_COLOR = '#f59e0b';

const ACTION_CONTEXT_ITEMS: ContextMenuItem[] = [
  { id: 'edit', label: 'Modifier', icon: PencilIcon },
  { id: 'add-after', label: 'Ajouter après', icon: PlusIcon },
  { id: 'link-from', label: 'Lier vers…', icon: Link2Icon },
  { id: 'make-decision', label: 'Faire une décision', icon: SplitIcon },
  { id: 'delete', label: 'Supprimer', icon: Trash2Icon, danger: true },
];

const BRANCH_ACTION_CONTEXT_ITEMS: ContextMenuItem[] = [
  { id: 'edit', label: 'Modifier', icon: PencilIcon },
  { id: 'add-after', label: 'Ajouter après', icon: PlusIcon },
  { id: 'link-from', label: 'Lier vers…', icon: Link2Icon },
  { id: 'delete', label: 'Supprimer', icon: Trash2Icon, danger: true },
];

const DECISION_ACTION_CONTEXT_ITEMS: ContextMenuItem[] = [
  { id: 'edit-decision', label: 'Éditer la décision', icon: SplitIcon },
  { id: 'add-branch', label: 'Ajouter une branche', icon: GitBranchIcon },
  { id: 'add-after', label: 'Ajouter après', icon: PlusIcon },
  { id: 'link-from', label: 'Lier vers…', icon: Link2Icon },
  { id: 'delete', label: 'Supprimer', icon: Trash2Icon, danger: true },
];

const BRANCH_HEADER_CONTEXT_ITEMS: ContextMenuItem[] = [
  { id: 'edit-branch', label: 'Modifier la condition', icon: PencilIcon },
  { id: 'add-branch-action', label: 'Ajouter une action', icon: PlusIcon },
  { id: 'delete-branch', label: 'Supprimer la branche', icon: Trash2Icon, danger: true },
];

const PHASE_CONTEXT_ITEMS: ContextMenuItem[] = [
  { id: 'edit-phase', label: 'Modifier la phase', icon: PencilIcon },
  { id: 'add-action', label: 'Ajouter une action', icon: PlusIcon },
  { id: 'delete-phase', label: 'Supprimer la phase', icon: Trash2Icon, danger: true },
];

const PANE_CONTEXT_ITEMS: ContextMenuItem[] = [
  { id: 'add-phase', label: 'Ajouter une phase', icon: Rows3Icon },
  { id: 'add-action', label: 'Ajouter une action', icon: PlusIcon },
  { id: 'auto-reorder', label: 'Réordonner auto', icon: ArrowDownUpIcon },
  { id: 'clear-links', label: 'Supprimer les liens', icon: Link2OffIcon, danger: true },
];

interface ActionNodeData extends Record<string, unknown> {
  description: string;
  at: number;
  kind?: Action['kind'];
  iconId?: string;
  condition?: string;
  isDecision?: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  /** Internal bookkeeping (not exported): set when this action node lives inside a decision's branch. */
  branchOwnerId?: string;
  branchIndex?: number;
}

interface PhaseHeaderNodeData extends Record<string, unknown> {
  title?: string;
  age: Phase['age'];
  timeStart: number;
  targetVillagers?: number;
  phaseIndex: number;
  onAddAction: (phaseIndex: number) => void;
  onEditHeader: (phaseIndex: number) => void;
}

interface BranchHeaderNodeData extends Record<string, unknown> {
  condition: string;
  branchId?: string;
  decisionId: string;
  branchIndex: number;
  onEditBranch: (decisionId: string, branchIndex: number) => void;
  onDeleteBranch: (decisionId: string, branchIndex: number) => void;
  onAddBranchAction: (decisionId: string, branchIndex: number) => void;
}

type CursorNodeData = Record<string, unknown>;

interface NodeHandlers {
  onAddAction: (phaseIndex: number) => void;
  onEditAction: (id: string) => void;
  onDeleteAction: (id: string) => void;
  onEditHeader: (phaseIndex: number) => void;
  onEditBranch: (decisionId: string, branchIndex: number) => void;
  onDeleteBranch: (decisionId: string, branchIndex: number) => void;
  onAddBranchAction: (decisionId: string, branchIndex: number) => void;
}

/** Menu context: what was right-clicked, so item selection can be dispatched. */
type MenuContext =
  | { type: 'action'; id: string }
  | { type: 'phaseHeader'; phaseIndex: number }
  | { type: 'branchHeader'; decisionId: string; branchIndex: number }
  | { type: 'pane'; flowX: number };

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
  context: MenuContext;
}

function ActionNode({ id, data }: NodeProps<Node<ActionNodeData, 'action'>>) {
  return (
    <div
      className={cn(
        'group relative w-[300px] rounded-lg border bg-card text-card-foreground shadow-sm',
        data.isDecision && 'border-2 border-amber-400/60',
      )}
      onDoubleClick={() => data.onEdit(id)}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-start gap-3 p-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{formatTime(data.at)}</span>
            {data.isDecision && (
              <Badge variant="outline" className="gap-1 text-[10px]">
                <SplitIcon className="size-3" />
                Décision
              </Badge>
            )}
          </div>
          {data.condition && (
            <Badge variant="outline" className="w-fit gap-1 text-[10px]">
              <GitBranchIcon className="size-3" />
              {data.condition}
            </Badge>
          )}
          <span className="text-sm font-medium leading-snug">
            <ActionDescription
              action={{
                description: data.description || 'Nouvelle action',
                kind: data.kind,
                iconId: data.iconId,
              }}
              iconSize={18}
            />
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
    <div
      className="flex w-[280px] flex-col items-start gap-2"
      onDoubleClick={() => data.onEditHeader(data.phaseIndex)}
    >
      {data.title && <span className="text-sm font-semibold leading-snug">{data.title}</span>}
      <Badge>{AGE_LABELS[data.age]}</Badge>
      <span className="font-mono text-xs text-muted-foreground">{formatTime(data.timeStart)}</span>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="nodrag"
        onClick={() => data.onAddAction(data.phaseIndex)}
        onDoubleClick={(event) => event.stopPropagation()}
      >
        <PlusIcon />
        Action
      </Button>
    </div>
  );
}

function BranchHeaderNode({ data }: NodeProps<Node<BranchHeaderNodeData, 'branchHeader'>>) {
  return (
    <div className="group flex w-[280px] items-center justify-between gap-2">
      <Badge variant="outline" className="gap-1 border-amber-400/60 text-[10px]">
        <GitBranchIcon className="size-3" />
        {data.condition}
      </Badge>
      <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="nodrag"
          title="Modifier la condition"
          onClick={() => data.onEditBranch(data.decisionId, data.branchIndex)}
        >
          <PencilIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="nodrag"
          title="Ajouter une action"
          onClick={() => data.onAddBranchAction(data.decisionId, data.branchIndex)}
        >
          <PlusIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="nodrag text-destructive"
          title="Supprimer la branche"
          onClick={() => data.onDeleteBranch(data.decisionId, data.branchIndex)}
        >
          <Trash2Icon />
        </Button>
      </div>
    </div>
  );
}

function CursorNode() {
  return <div className="size-px opacity-0" />;
}

const nodeTypes: NodeTypes = {
  action: ActionNode,
  phaseHeader: PhaseHeaderNode,
  branchHeader: BranchHeaderNode,
  cursor: CursorNode,
};

function buildEditorElements(
  phases: Phase[],
  handlers: NodeHandlers,
  layout?: Record<string, { x: number; y: number }>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const allActionRefs: { action: Action; id: string }[] = [];

  function pushActionNode(
    action: Action,
    defaultPosition: { x: number; y: number },
    extra?: { branchOwnerId: string; branchIndex: number },
  ): { id: string; position: { x: number; y: number } } {
    const id = action.id ?? generateActionId();
    const position = layout?.[id] ?? defaultPosition;
    nodes.push({
      id,
      type: 'action',
      position,
      data: {
        description: action.description,
        at: action.at,
        kind: action.kind,
        iconId: action.iconId,
        condition: action.condition,
        isDecision: Boolean(action.branches?.length),
        onEdit: handlers.onEditAction,
        onDelete: handlers.onDeleteAction,
        ...(extra ?? {}),
      },
      draggable: true,
    });
    allActionRefs.push({ action, id });
    return { id, position };
  }

  function buildBranches(
    decisionId: string,
    decisionPosition: { x: number; y: number },
    branches: ActionBranch[],
  ) {
    branches.forEach((branch, branchIndex) => {
      const columnX = decisionPosition.x + COLUMN_WIDTH * (branchIndex + 1);
      const headerId = `${decisionId}-branch-${branchIndex}-header`;

      nodes.push({
        id: headerId,
        type: 'branchHeader',
        position: { x: columnX, y: decisionPosition.y },
        data: {
          condition: branch.condition,
          branchId: branch.id,
          decisionId,
          branchIndex,
          onEditBranch: handlers.onEditBranch,
          onDeleteBranch: handlers.onDeleteBranch,
          onAddBranchAction: handlers.onAddBranchAction,
        },
        draggable: false,
        selectable: false,
      });

      edges.push({
        id: `${decisionId}->${headerId}`,
        source: decisionId,
        target: headerId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: BRANCH_EDGE_COLOR },
        data: { auto: true },
      });

      let previousBranchActionId: string | null = null;
      branch.actions.forEach((branchAction, branchActionIndex) => {
        const { id: branchActionId } = pushActionNode(
          branchAction,
          { x: columnX, y: decisionPosition.y + ROW_HEIGHT * (branchActionIndex + 1) },
          { branchOwnerId: decisionId, branchIndex },
        );

        if (!branchAction.dependsOn?.length) {
          const source = previousBranchActionId ?? headerId;
          edges.push({
            id: `${source}->${branchActionId}`,
            source,
            target: branchActionId,
            type: 'smoothstep',
            animated: false,
            data: { auto: true },
          });
        }
        previousBranchActionId = branchActionId;
      });
    });
  }

  phases.forEach((phase, phaseIndex) => {
    const x = phaseIndex * COLUMN_WIDTH;

    nodes.push({
      id: `phase-${phaseIndex}-header`,
      type: 'phaseHeader',
      position: { x, y: 0 },
      data: {
        title: phase.title,
        age: phase.age,
        timeStart: phase.timeStart,
        targetVillagers: phase.targetVillagers,
        phaseIndex,
        onAddAction: handlers.onAddAction,
        onEditHeader: handlers.onEditHeader,
      },
      draggable: false,
      selectable: false,
    });

    let previousActionId: string | null = null;
    phase.actions.forEach((action, actionIndex) => {
      const defaultPosition = { x, y: actionIndex * ROW_HEIGHT + ROW_Y_OFFSET };
      const { id, position } = pushActionNode(action, defaultPosition);

      if (!action.dependsOn?.length && previousActionId) {
        edges.push({
          id: `${previousActionId}->${id}`,
          source: previousActionId,
          target: id,
          type: 'smoothstep',
          animated: false,
          data: { auto: true },
        });
      }

      if (action.branches?.length) {
        buildBranches(id, position, action.branches);
      }

      previousActionId = id;
    });
  });

  const actionIds = new Set(allActionRefs.map((ref) => ref.id));
  for (const { action, id } of allActionRefs) {
    for (const sourceId of action.dependsOn ?? []) {
      if (!actionIds.has(sourceId)) continue;
      edges.push({
        id: `${sourceId}->${id}`,
        source: sourceId,
        target: id,
        type: 'smoothstep',
        animated: false,
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    }
  }

  return { nodes, edges };
}

/** Groups action nodes under their nearest phase header by column (x) distance. */
function groupActionsByHeader(
  headers: Node<PhaseHeaderNodeData>[],
  actionNodes: Node<ActionNodeData>[],
): Map<string, Node<ActionNodeData>[]> {
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

  return actionsByHeaderId;
}

/** Where an action lives in the phases tree: directly in a phase, or inside one of a decision's branches. */
type ActionLocation =
  | { kind: 'phase'; phaseIndex: number; actionIndex: number }
  | { kind: 'branch'; phaseIndex: number; actionIndex: number; branchIndex: number; branchActionIndex: number };

function findActionLocation(phases: Phase[], actionId: string): ActionLocation | null {
  for (let phaseIndex = 0; phaseIndex < phases.length; phaseIndex += 1) {
    const actions = phases[phaseIndex].actions;
    for (let actionIndex = 0; actionIndex < actions.length; actionIndex += 1) {
      const action = actions[actionIndex];
      if (action.id === actionId) return { kind: 'phase', phaseIndex, actionIndex };
      if (!action.branches) continue;
      for (let branchIndex = 0; branchIndex < action.branches.length; branchIndex += 1) {
        const branchActions = action.branches[branchIndex].actions;
        for (let branchActionIndex = 0; branchActionIndex < branchActions.length; branchActionIndex += 1) {
          if (branchActions[branchActionIndex].id === actionId) {
            return { kind: 'branch', phaseIndex, actionIndex, branchIndex, branchActionIndex };
          }
        }
      }
    }
  }
  return null;
}

function getActionAtLocation(phases: Phase[], location: ActionLocation): Action {
  const decision = phases[location.phaseIndex].actions[location.actionIndex];
  if (location.kind === 'phase') return decision;
  return decision.branches![location.branchIndex].actions[location.branchActionIndex];
}

/** Immutably replaces the single action at `location` with `nextAction`. */
function setActionAtLocation(phases: Phase[], location: ActionLocation, nextAction: Action): Phase[] {
  return phases.map((phase, phaseIndex) => {
    if (phaseIndex !== location.phaseIndex) return phase;
    return {
      ...phase,
      actions: phase.actions.map((action, actionIndex) => {
        if (actionIndex !== location.actionIndex) return action;
        if (location.kind === 'phase') return nextAction;
        const branches = (action.branches ?? []).map((branch, branchIndex) => {
          if (branchIndex !== location.branchIndex) return branch;
          return {
            ...branch,
            actions: branch.actions.map((branchAction, branchActionIndex) =>
              branchActionIndex === location.branchActionIndex ? nextAction : branchAction,
            ),
          };
        });
        return { ...action, branches };
      }),
    };
  });
}

/** The sibling action list that owns `location` — a phase's actions, or a branch's actions. */
function getSiblingActions(phases: Phase[], location: ActionLocation): Action[] {
  if (location.kind === 'phase') return phases[location.phaseIndex].actions;
  const decision = phases[location.phaseIndex].actions[location.actionIndex];
  return decision.branches![location.branchIndex].actions;
}

/** Immutably replaces the sibling action list that owns `location`. */
function setSiblingActions(phases: Phase[], location: ActionLocation, nextActions: Action[]): Phase[] {
  return phases.map((phase, phaseIndex) => {
    if (phaseIndex !== location.phaseIndex) return phase;
    if (location.kind === 'phase') return { ...phase, actions: nextActions };
    return {
      ...phase,
      actions: phase.actions.map((action, actionIndex) => {
        if (actionIndex !== location.actionIndex) return action;
        const branches = (action.branches ?? []).map((branch, branchIndex) =>
          branchIndex === location.branchIndex ? { ...branch, actions: nextActions } : branch,
        );
        return { ...action, branches };
      }),
    };
  });
}

/**
 * Derives the phases JSON from the current node positions: phases are ordered by
 * column (x), actions within a phase by row (y) then made stable by `at` — a drag
 * that didn't touch `at` keeps its row order, ties on `at` fall back to row order.
 * Edges are the source of truth for `dependsOn`: an edge is only kept if both its
 * source and target are still present among the given nodes.
 *
 * Decisions: an action becomes a decision if `branchHeader` nodes tagged with its id
 * (`data.decisionId`) exist among the nodes. A branch's actions are the `action` nodes
 * tagged with `data.branchOwnerId`/`data.branchIndex` pointing at that header — this
 * tagging (not position) is what makes branch membership survive free dragging.
 * Orphaned branch nodes (owner decision no longer present) are silently dropped,
 * which is what makes deleting a decision node cascade-delete its branches for free.
 */
function nodesToPhases(nodes: Node[], edges: Edge[], originalPhases: Phase[]): Phase[] {
  const headers = nodes
    .filter((node): node is Node<PhaseHeaderNodeData> => node.type === 'phaseHeader')
    .slice()
    .sort((a, b) => a.position.x - b.position.x);

  const allActionNodes = nodes.filter((node): node is Node<ActionNodeData> => node.type === 'action');
  const actionIds = new Set(allActionNodes.map((node) => node.id));

  const topLevelActionNodes = allActionNodes.filter((node) => !node.data.branchOwnerId);
  const actionsByHeaderId = groupActionsByHeader(headers, topLevelActionNodes);

  const branchActionsByKey = new Map<string, Node<ActionNodeData>[]>();
  for (const node of allActionNodes) {
    if (!node.data.branchOwnerId) continue;
    const key = `${node.data.branchOwnerId}::${node.data.branchIndex}`;
    const list = branchActionsByKey.get(key) ?? [];
    list.push(node);
    branchActionsByKey.set(key, list);
  }

  const branchHeadersByDecisionId = new Map<string, Node<BranchHeaderNodeData>[]>();
  for (const node of nodes) {
    if (node.type !== 'branchHeader') continue;
    const data = node.data as BranchHeaderNodeData;
    const list = branchHeadersByDecisionId.get(data.decisionId) ?? [];
    list.push(node as Node<BranchHeaderNodeData>);
    branchHeadersByDecisionId.set(data.decisionId, list);
  }
  for (const list of branchHeadersByDecisionId.values()) {
    list.sort((a, b) => a.data.branchIndex - b.data.branchIndex);
  }

  const dependsOnByTarget = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.data?.auto) continue;
    if (!actionIds.has(edge.source) || !actionIds.has(edge.target)) continue;
    const list = dependsOnByTarget.get(edge.target) ?? [];
    if (!list.includes(edge.source)) list.push(edge.source);
    dependsOnByTarget.set(edge.target, list);
  }

  function branchesForDecision(decisionId: string): ActionBranch[] | undefined {
    const headerNodes = branchHeadersByDecisionId.get(decisionId);
    if (!headerNodes?.length) return undefined;
    return headerNodes.map((headerNode) => {
      const key = `${decisionId}::${headerNode.data.branchIndex}`;
      const branchActionNodes = (branchActionsByKey.get(key) ?? [])
        .slice()
        .sort((a, b) => a.position.y - b.position.y)
        .sort((a, b) => Number(a.data.at) - Number(b.data.at));
      return {
        ...(headerNode.data.branchId ? { id: headerNode.data.branchId } : {}),
        condition: headerNode.data.condition,
        actions: branchActionNodes.map(nodeToAction),
      };
    });
  }

  function nodeToAction(node: Node<ActionNodeData>): Action {
    const dependsOn = dependsOnByTarget.get(node.id);
    const branches = branchesForDecision(node.id);
    return {
      id: node.id,
      at: Number(node.data.at),
      description: node.data.description,
      kind: node.data.kind,
      ...(node.data.iconId ? { iconId: node.data.iconId } : {}),
      ...(node.data.condition ? { condition: node.data.condition } : {}),
      ...(dependsOn && dependsOn.length ? { dependsOn } : {}),
      ...(branches && branches.length ? { branches } : {}),
    };
  }

  return headers.map((header, phaseIndex) => {
    const original = originalPhases[phaseIndex];
    const orderedActions = (actionsByHeaderId.get(header.id) ?? [])
      .slice()
      .sort((a, b) => a.position.y - b.position.y)
      .sort((a, b) => Number(a.data.at) - Number(b.data.at));

    return {
      title: header.data.title,
      age: header.data.age,
      timeStart: header.data.timeStart,
      targetResources: original?.targetResources,
      targetVillagers: header.data.targetVillagers,
      actions: orderedActions.map(nodeToAction),
    };
  });
}

interface EditDraft {
  id: string;
  at: string;
  description: string;
  kind: NonNullable<Action['kind']> | 'none';
  iconId: string | null;
}

interface HeaderDraft {
  phaseIndex: number;
  title: string;
  age: Phase['age'];
  timeStart: string;
  targetVillagers: string;
}

interface DecisionBranchDraft {
  key: string;
  originalIndex: number | null;
  condition: string;
  actionCount: number;
}

interface DecisionDraft {
  actionId: string;
  condition: string;
  branches: DecisionBranchDraft[];
}

interface BranchEditDraft {
  decisionId: string;
  branchIndex: number;
  condition: string;
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
  const [deletePhaseIndex, setDeletePhaseIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [headerDraft, setHeaderDraft] = useState<HeaderDraft | null>(null);
  const [decisionDraft, setDecisionDraft] = useState<DecisionDraft | null>(null);
  const [branchEditDraft, setBranchEditDraft] = useState<BranchEditDraft | null>(null);
  const [deleteBranchTarget, setDeleteBranchTarget] = useState<{
    decisionId: string;
    branchIndex: number;
  } | null>(null);
  const [menuState, setMenuState] = useState<MenuState | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [cursorFlowPos, setCursorFlowPos] = useState<{ x: number; y: number } | null>(null);

  const nodesRef = useRef<Node[]>([]);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  const edgesRef = useRef<Edge[]>([]);
  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  const latestPhasesRef = useRef<Phase[]>(
    buildOrder?.phases ?? (initialPhases?.length ? initialPhases : DEFAULT_DRAFT_PHASES),
  );

  /** Origin phases (canonicalised through nodesToPhases) — the dirty baseline. */
  const originRef = useRef<string | null>(null);

  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  function originalPhasesSource(): Phase[] {
    return buildOrder ? buildOrder.phases : latestPhasesRef.current;
  }

  function cancelLinkMode() {
    setLinkFrom(null);
    setCursorFlowPos(null);
  }

  function requestDelete(id: string) {
    setDeleteTargetId(id);
  }

  function rebuildFrom(nextPhases: Phase[]) {
    const rebuilt = buildEditorElements(nextPhases, handlers);
    setNodes(rebuilt.nodes);
    setEdges(rebuilt.edges);
  }

  function openEditDialog(id: string) {
    const node = nodesRef.current.find((candidate) => candidate.id === id);
    if (!node || node.type !== 'action') return;
    const data = node.data as ActionNodeData;
    if (data.isDecision) {
      openDecisionDialog(id);
      return;
    }
    setEditDraft({
      id,
      at: String(data.at),
      description: data.description,
      kind: data.kind ?? 'none',
      iconId: data.iconId ?? null,
    });
  }

  function openHeaderEditDialog(phaseIndex: number) {
    const node = nodesRef.current.find((candidate) => candidate.id === `phase-${phaseIndex}-header`);
    if (!node || node.type !== 'phaseHeader') return;
    const data = node.data as PhaseHeaderNodeData;
    setHeaderDraft({
      phaseIndex,
      title: data.title ?? '',
      age: data.age,
      timeStart: String(data.timeStart),
      targetVillagers: data.targetVillagers !== undefined ? String(data.targetVillagers) : '',
    });
  }

  function handleAddAction(phaseIndex: number) {
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const phase = phases[phaseIndex];
    if (!phase) return;
    const lastAction = phase.actions[phase.actions.length - 1];
    const at = lastAction ? lastAction.at + 30 : phase.timeStart;
    const nextPhases = phases.map((p, index) =>
      index === phaseIndex
        ? { ...p, actions: [...p.actions, { at, description: '', kind: 'build' as const }] }
        : p,
    );
    rebuildFrom(nextPhases);
  }

  function insertActionAfter(afterActionId: string) {
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const location = findActionLocation(phases, afterActionId);
    if (!location) return;

    const siblings = getSiblingActions(phases, location);
    const index = location.kind === 'phase' ? location.actionIndex : location.branchActionIndex;
    const after = siblings[index];
    const next = siblings[index + 1];
    let at = after.at + 30;
    if (next) {
      const midpoint = Math.floor((after.at + next.at) / 2);
      at = midpoint > after.at ? midpoint : after.at + 1;
    }

    const nextSiblings = [
      ...siblings.slice(0, index + 1),
      { at, description: '', kind: 'build' as const },
      ...siblings.slice(index + 1),
    ];
    rebuildFrom(setSiblingActions(phases, location, nextSiblings));
  }

  function makeDecision(actionId: string) {
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const location = findActionLocation(phases, actionId);
    if (!location || location.kind !== 'phase') return;
    const decision = getActionAtLocation(phases, location);
    const nextAction: Action = {
      ...decision,
      branches: [
        { condition: 'Si …', actions: [] },
        { condition: 'Sinon', actions: [] },
      ],
    };
    rebuildFrom(setActionAtLocation(phases, location, nextAction));
  }

  function addBranch(actionId: string) {
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const location = findActionLocation(phases, actionId);
    if (!location || location.kind !== 'phase') return;
    const decision = getActionAtLocation(phases, location);
    const nextAction: Action = {
      ...decision,
      branches: [...(decision.branches ?? []), { condition: 'Si …', actions: [] }],
    };
    rebuildFrom(setActionAtLocation(phases, location, nextAction));
  }

  function addBranchAction(decisionId: string, branchIndex: number) {
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const location = findActionLocation(phases, decisionId);
    if (!location || location.kind !== 'phase') return;
    const decision = getActionAtLocation(phases, location);
    const branch = decision.branches?.[branchIndex];
    if (!branch) return;
    const lastAction = branch.actions[branch.actions.length - 1];
    const at = lastAction ? lastAction.at + 30 : decision.at + 30;
    const nextBranches = decision.branches!.map((b, bi) =>
      bi === branchIndex
        ? { ...b, actions: [...b.actions, { at, description: '', kind: 'build' as const }] }
        : b,
    );
    rebuildFrom(setActionAtLocation(phases, location, { ...decision, branches: nextBranches }));
  }

  function openDecisionDialog(actionId: string) {
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const location = findActionLocation(phases, actionId);
    if (!location || location.kind !== 'phase') return;
    const action = getActionAtLocation(phases, location);
    setDecisionDraft({
      actionId,
      condition: action.condition ?? '',
      branches: (action.branches ?? []).map((branch, index) => ({
        key: generateActionId(),
        originalIndex: index,
        condition: branch.condition,
        actionCount: branch.actions.length,
      })),
    });
  }

  function addDecisionDraftBranch() {
    setDecisionDraft((current) =>
      current
        ? {
            ...current,
            branches: [
              ...current.branches,
              { key: generateActionId(), originalIndex: null, condition: 'Si …', actionCount: 0 },
            ],
          }
        : current,
    );
  }

  function removeDecisionDraftBranch(key: string) {
    setDecisionDraft((current) =>
      current ? { ...current, branches: current.branches.filter((branch) => branch.key !== key) } : current,
    );
  }

  function updateDecisionDraftBranchCondition(key: string, condition: string) {
    setDecisionDraft((current) =>
      current
        ? {
            ...current,
            branches: current.branches.map((branch) =>
              branch.key === key ? { ...branch, condition } : branch,
            ),
          }
        : current,
    );
  }

  function applyDecisionEdit() {
    if (!decisionDraft) return;
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const location = findActionLocation(phases, decisionDraft.actionId);
    if (!location || location.kind !== 'phase') {
      setDecisionDraft(null);
      return;
    }
    const decision = getActionAtLocation(phases, location);
    const originalBranches = decision.branches ?? [];

    const nextBranches: ActionBranch[] = decisionDraft.branches.map((draft) => {
      const original = draft.originalIndex !== null ? originalBranches[draft.originalIndex] : undefined;
      return {
        ...(original?.id ? { id: original.id } : {}),
        condition: draft.condition.trim() || 'Si …',
        actions: original?.actions ?? [],
      };
    });

    const nextAction: Action = {
      id: decision.id,
      at: decision.at,
      description: decision.description,
      kind: decision.kind,
      ...(decision.iconId ? { iconId: decision.iconId } : {}),
      ...(decision.dependsOn?.length ? { dependsOn: decision.dependsOn } : {}),
      condition: decisionDraft.condition.trim() || undefined,
      ...(nextBranches.length ? { branches: nextBranches } : {}),
    };

    rebuildFrom(setActionAtLocation(phases, location, nextAction));
    setDecisionDraft(null);
  }

  function openBranchEditDialog(decisionId: string, branchIndex: number) {
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const location = findActionLocation(phases, decisionId);
    if (!location || location.kind !== 'phase') return;
    const decision = getActionAtLocation(phases, location);
    const branch = decision.branches?.[branchIndex];
    if (!branch) return;
    setBranchEditDraft({ decisionId, branchIndex, condition: branch.condition });
  }

  function applyBranchEdit() {
    if (!branchEditDraft) return;
    const condition = branchEditDraft.condition.trim();
    if (!condition) {
      toast.error('La condition de la branche ne peut pas être vide.');
      return;
    }
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const location = findActionLocation(phases, branchEditDraft.decisionId);
    if (!location || location.kind !== 'phase') {
      setBranchEditDraft(null);
      return;
    }
    const decision = getActionAtLocation(phases, location);
    const nextBranches = (decision.branches ?? []).map((branch, index) =>
      index === branchEditDraft.branchIndex ? { ...branch, condition } : branch,
    );
    rebuildFrom(setActionAtLocation(phases, location, { ...decision, branches: nextBranches }));
    setBranchEditDraft(null);
  }

  function requestDeleteBranch(decisionId: string, branchIndex: number) {
    setDeleteBranchTarget({ decisionId, branchIndex });
  }

  function confirmDeleteBranch() {
    if (!deleteBranchTarget) return;
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const location = findActionLocation(phases, deleteBranchTarget.decisionId);
    if (!location || location.kind !== 'phase') {
      setDeleteBranchTarget(null);
      return;
    }
    const decision = getActionAtLocation(phases, location);
    const nextBranches = (decision.branches ?? []).filter(
      (_, index) => index !== deleteBranchTarget.branchIndex,
    );
    const nextAction: Action = { ...decision };
    if (nextBranches.length) nextAction.branches = nextBranches;
    else delete nextAction.branches;
    rebuildFrom(setActionAtLocation(phases, location, nextAction));
    setDeleteBranchTarget(null);
  }

  const handlers: NodeHandlers = {
    onAddAction: handleAddAction,
    onEditAction: openEditDialog,
    onDeleteAction: requestDelete,
    onEditHeader: openHeaderEditDialog,
    onEditBranch: openBranchEditDialog,
    onDeleteBranch: requestDeleteBranch,
    onAddBranchAction: addBranchAction,
  };

  function confirmDelete() {
    if (!deleteTargetId) return;
    const remainingNodes = nodesRef.current.filter((node) => node.id !== deleteTargetId);
    rebuildFrom(nodesToPhases(remainingNodes, edgesRef.current, originalPhasesSource()));
    setDeleteTargetId(null);
  }

  function confirmDeletePhase() {
    if (deletePhaseIndex === null) return;
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const nextPhases = phases.filter((_, index) => index !== deletePhaseIndex);
    rebuildFrom(nextPhases.length ? nextPhases : DEFAULT_DRAFT_PHASES);
    setDeletePhaseIndex(null);
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
                iconId: editDraft.iconId ?? undefined,
              },
            }
          : node,
      ),
    );
    setEditDraft(null);
  }

  function addPhase() {
    const phases = nodesToPhases(nodesRef.current, edgesRef.current, originalPhasesSource());
    const lastPhase = phases[phases.length - 1];
    const timeStart = lastPhase ? lastPhase.timeStart + 60 : 0;
    const nextPhases: Phase[] = [...phases, { age: 'dark', timeStart, actions: [] }];
    rebuildFrom(nextPhases);
  }

  function resetFromSource() {
    const source = buildOrder
      ? buildOrder.phases
      : initialPhases?.length
        ? initialPhases
        : DEFAULT_DRAFT_PHASES;
    const rebuilt = buildEditorElements(source, handlers, buildOrder?.layout);
    latestPhasesRef.current = source;
    originRef.current = buildOrder
      ? JSON.stringify(nodesToPhases(rebuilt.nodes, rebuilt.edges, source))
      : null;
    setNodes(rebuilt.nodes);
    setEdges(rebuilt.edges);
    setEditDraft(null);
    setDeleteTargetId(null);
    setDeletePhaseIndex(null);
    setHeaderDraft(null);
    setDecisionDraft(null);
    setBranchEditDraft(null);
    setDeleteBranchTarget(null);
    setMenuState(null);
    cancelLinkMode();
  }

  useEffect(() => {
    resetFromSource();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buildOrder]);

  useEffect(() => {
    if (buildOrder) return;
    const phases = nodesToPhases(nodes, edges, latestPhasesRef.current);
    latestPhasesRef.current = phases;
    onPhasesChange?.(phases);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  const currentPhasesJson = useMemo(() => {
    if (!buildOrder) return null;
    return JSON.stringify(nodesToPhases(nodes, edges, originalPhasesSource()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, buildOrder]);

  const dirty = Boolean(buildOrder) && currentPhasesJson !== originRef.current;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && linkFrom) cancelLinkMode();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [linkFrom]);

  const onConnect: OnConnect = (connection) => {
    if (!connection.source || !connection.target || connection.source === connection.target) return;
    setEdges((current) => {
      const alreadyExists = current.some(
        (edge) => edge.source === connection.source && edge.target === connection.target,
      );
      if (alreadyExists) return current;
      return addEdge(
        {
          ...connection,
          id: `${connection.source}->${connection.target}`,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
        },
        current,
      );
    });
  };

  const onEdgeDoubleClick: EdgeMouseHandler = (event, edge) => {
    event.stopPropagation();
    setEdges((current) => current.filter((candidate) => candidate.id !== edge.id));
  };

  function clearAllEdges() {
    if (edgesRef.current.length === 0) return;
    setEdges([]);
    toast.success('Tous les liens de dépendance ont été supprimés.');
  }

  function autoReorder() {
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
    const headers = currentNodes
      .filter((node): node is Node<PhaseHeaderNodeData> => node.type === 'phaseHeader')
      .sort((a, b) => a.position.x - b.position.x);
    const actionNodes = currentNodes.filter(
      (node): node is Node<ActionNodeData> => node.type === 'action' && !node.data.branchOwnerId,
    );
    const actionsByHeaderId = groupActionsByHeader(headers, actionNodes);

    let cyclesFound = false;
    const positionById = new Map<string, { x: number; y: number }>();

    for (const header of headers) {
      const groupNodes = actionsByHeaderId.get(header.id) ?? [];
      const groupIds = new Set(groupNodes.map((node) => node.id));
      const items = groupNodes.map((node) => ({
        id: node.id,
        at: Number(node.data.at),
        dependsOn: currentEdges
          .filter((edge) => edge.target === node.id && groupIds.has(edge.source))
          .map((edge) => edge.source),
      }));
      const { order, cyclic } = topologicalOrder(items);
      if (cyclic.length > 0) cyclesFound = true;
      const orderedIds = [...order, ...cyclic];
      orderedIds.forEach((id, index) => {
        positionById.set(id, { x: header.position.x, y: index * ROW_HEIGHT + ROW_Y_OFFSET });
      });
    }

    setNodes((current) =>
      current.map((node) => {
        const position = positionById.get(node.id);
        return position ? { ...node, position } : node;
      }),
    );

    if (cyclesFound) {
      toast.warning('Certaines actions ont des dépendances cycliques et n’ont pas pu être triées.');
    }
  }

  function applyHeaderEdit() {
    if (!headerDraft) return;
    const timeStart = Number(headerDraft.timeStart);
    if (!Number.isFinite(timeStart) || timeStart < 0) {
      toast.error('Le temps de début doit être un nombre positif.');
      return;
    }
    let targetVillagers: number | undefined;
    if (headerDraft.targetVillagers.trim()) {
      targetVillagers = Number(headerDraft.targetVillagers);
      if (!Number.isFinite(targetVillagers) || targetVillagers < 0) {
        toast.error('Le nombre de villageois cible doit être un nombre positif.');
        return;
      }
    }

    const headerId = `phase-${headerDraft.phaseIndex}-header`;
    setNodes((current) =>
      current.map((node) =>
        node.id === headerId
          ? {
              ...node,
              data: {
                ...node.data,
                title: headerDraft.title.trim() || undefined,
                age: headerDraft.age,
                timeStart,
                targetVillagers,
              },
            }
          : node,
      ),
    );
    setHeaderDraft(null);
  }

  function nearestPhaseIndex(flowX: number): number | null {
    const headers = nodesRef.current
      .filter((node): node is Node<PhaseHeaderNodeData> => node.type === 'phaseHeader')
      .sort((a, b) => a.position.x - b.position.x);
    if (headers.length === 0) return null;
    let nearest = headers[0];
    let nearestDistance = Math.abs(nearest.position.x - flowX);
    for (const header of headers.slice(1)) {
      const distance = Math.abs(header.position.x - flowX);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = header;
      }
    }
    return nearest.data.phaseIndex;
  }

  const handleNodeContextMenu: NodeMouseHandler = (event, node) => {
    event.preventDefault();
    if (linkFrom) {
      cancelLinkMode();
      return;
    }
    if (node.type === 'action') {
      const data = node.data as ActionNodeData;
      const items = data.isDecision
        ? DECISION_ACTION_CONTEXT_ITEMS
        : data.branchOwnerId
          ? BRANCH_ACTION_CONTEXT_ITEMS
          : ACTION_CONTEXT_ITEMS;
      setMenuState({
        x: event.clientX,
        y: event.clientY,
        items,
        context: { type: 'action', id: node.id },
      });
    } else if (node.type === 'phaseHeader') {
      const data = node.data as PhaseHeaderNodeData;
      setMenuState({
        x: event.clientX,
        y: event.clientY,
        items: PHASE_CONTEXT_ITEMS,
        context: { type: 'phaseHeader', phaseIndex: data.phaseIndex },
      });
    } else if (node.type === 'branchHeader') {
      const data = node.data as BranchHeaderNodeData;
      setMenuState({
        x: event.clientX,
        y: event.clientY,
        items: BRANCH_HEADER_CONTEXT_ITEMS,
        context: { type: 'branchHeader', decisionId: data.decisionId, branchIndex: data.branchIndex },
      });
    }
  };

  function handlePaneContextMenu(event: React.MouseEvent | MouseEvent) {
    event.preventDefault();
    if (linkFrom) {
      cancelLinkMode();
      return;
    }
    const instance = reactFlowInstanceRef.current;
    const flowPos = instance?.screenToFlowPosition({ x: event.clientX, y: event.clientY }) ?? {
      x: 0,
      y: 0,
    };
    setMenuState({
      x: event.clientX,
      y: event.clientY,
      items: PANE_CONTEXT_ITEMS,
      context: { type: 'pane', flowX: flowPos.x },
    });
  }

  const handleNodeClick: NodeMouseHandler = (event, node) => {
    if (!linkFrom) return;
    event.stopPropagation();
    if (node.type !== 'action' || node.id === linkFrom) {
      cancelLinkMode();
      return;
    }
    const source = linkFrom;
    const target = node.id;
    setEdges((current) => {
      const alreadyExists = current.some((edge) => edge.source === source && edge.target === target);
      if (alreadyExists) return current;
      return addEdge(
        {
          id: `${source}->${target}`,
          source,
          target,
          type: 'smoothstep',
          markerEnd: { type: MarkerType.ArrowClosed },
        },
        current,
      );
    });
    cancelLinkMode();
  };

  function handlePaneClick() {
    if (linkFrom) cancelLinkMode();
  }

  function handlePointerMoveForLink(event: React.MouseEvent) {
    if (!linkFrom) return;
    const instance = reactFlowInstanceRef.current;
    if (!instance) return;
    setCursorFlowPos(instance.screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  }

  function handleContextMenuSelect(id: string) {
    const menu = menuState;
    setMenuState(null);
    if (!menu) return;

    if (menu.context.type === 'action') {
      const actionId = menu.context.id;
      if (id === 'edit') openEditDialog(actionId);
      else if (id === 'edit-decision') openDecisionDialog(actionId);
      else if (id === 'add-after') insertActionAfter(actionId);
      else if (id === 'delete') requestDelete(actionId);
      else if (id === 'link-from') setLinkFrom(actionId);
      else if (id === 'make-decision') makeDecision(actionId);
      else if (id === 'add-branch') addBranch(actionId);
    } else if (menu.context.type === 'phaseHeader') {
      const { phaseIndex } = menu.context;
      if (id === 'edit-phase') openHeaderEditDialog(phaseIndex);
      else if (id === 'add-action') handleAddAction(phaseIndex);
      else if (id === 'delete-phase') setDeletePhaseIndex(phaseIndex);
    } else if (menu.context.type === 'branchHeader') {
      const { decisionId, branchIndex } = menu.context;
      if (id === 'edit-branch') openBranchEditDialog(decisionId, branchIndex);
      else if (id === 'add-branch-action') addBranchAction(decisionId, branchIndex);
      else if (id === 'delete-branch') requestDeleteBranch(decisionId, branchIndex);
    } else {
      if (id === 'add-phase') addPhase();
      else if (id === 'add-action') {
        const phaseIndex = nearestPhaseIndex(menu.context.flowX);
        if (phaseIndex !== null) handleAddAction(phaseIndex);
      } else if (id === 'clear-links') clearAllEdges();
      else if (id === 'auto-reorder') autoReorder();
    }
  }

  const displayNodes = useMemo(() => {
    if (!linkFrom || !cursorFlowPos) return nodes;
    return [
      ...nodes,
      {
        id: CURSOR_NODE_ID,
        type: 'cursor',
        position: cursorFlowPos,
        data: {} satisfies CursorNodeData,
        draggable: false,
        selectable: false,
      },
    ];
  }, [nodes, linkFrom, cursorFlowPos]);

  const displayEdges = useMemo(() => {
    if (!linkFrom || !cursorFlowPos) return edges;
    return [
      ...edges,
      {
        id: '__temp-link__',
        source: linkFrom,
        target: CURSOR_NODE_ID,
        type: 'straight',
        style: { strokeDasharray: '6 4' },
      },
    ];
  }, [edges, linkFrom, cursorFlowPos]);

  const deleteTargetHasBranches = Boolean(
    deleteTargetId &&
      (nodesRef.current.find((node) => node.id === deleteTargetId)?.data as ActionNodeData | undefined)
        ?.isDecision,
  );

  async function handleSave() {
    if (!buildOrder || !getToken) return;
    const currentNodes = nodesRef.current;
    const currentEdges = edgesRef.current;
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

    const phases = nodesToPhases(currentNodes, currentEdges, originalPhasesSource());
    const allActions = phases.flatMap((phase) => flattenActionsDeep(phase.actions));
    const actionsById = new Map(allActions.map((action) => [action.id as string, action]));

    const cycle = findDependencyCycle(
      allActions.map((action) => ({ id: action.id as string, dependsOn: action.dependsOn ?? [] })),
    );
    if (cycle) {
      toast.error('Dépendances cycliques détectées.', {
        description: cycle
          .map((id) => actionsById.get(id)?.description ?? id)
          .join(' → '),
      });
      return;
    }

    for (const action of allActions) {
      for (const depId of action.dependsOn ?? []) {
        const dependency = actionsById.get(depId);
        if (dependency && dependency.at > action.at) {
          toast.error(
            `L'action "${action.description}" démarre avant "${dependency.description}" dont elle dépend.`,
          );
          return;
        }
      }
    }

    setSaving(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error('Vous devez être connecté pour enregistrer.');
        return;
      }
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
      {buildOrder && dirty && (
        <div className="mb-3 flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={resetFromSource}>
            <XIcon />
            Annuler
          </Button>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            <SaveIcon />
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </div>
      )}

      <div className="relative min-h-0 flex-1" onMouseMove={handlePointerMoveForLink}>
        {linkFrom && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center">
            <Badge className="pointer-events-auto">
              Cliquez sur une action pour créer le lien · Échap pour annuler
            </Badge>
          </div>
        )}
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onNodeContextMenu={handleNodeContextMenu}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          onInit={(instance) => {
            reactFlowInstanceRef.current = instance;
          }}
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
          className={cn(linkFrom && 'cursor-crosshair')}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {menuState && (
        <EditorContextMenu
          x={menuState.x}
          y={menuState.y}
          items={menuState.items}
          onSelect={handleContextMenuSelect}
          onClose={() => setMenuState(null)}
        />
      )}

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
              <div className="flex flex-col gap-1.5">
                <Label>Icône</Label>
                <div className="grid max-h-48 grid-cols-6 gap-1 overflow-y-auto rounded-md border p-2">
                  <button
                    type="button"
                    title="Icône par défaut"
                    className={cn(
                      'flex size-8 items-center justify-center rounded-sm border text-[10px] text-muted-foreground hover:border-primary',
                      editDraft.iconId === null && 'border-primary ring-1 ring-primary',
                    )}
                    onClick={() => setEditDraft({ ...editDraft, iconId: null })}
                  >
                    —
                  </button>
                  {GAME_ICONS.map((icon) => (
                    <button
                      type="button"
                      key={icon.id}
                      title={icon.label}
                      className={cn(
                        'flex size-8 items-center justify-center overflow-hidden rounded-sm border hover:border-primary',
                        editDraft.iconId === icon.id && 'border-primary ring-1 ring-primary',
                      )}
                      onClick={() => setEditDraft({ ...editDraft, iconId: icon.id })}
                    >
                      <img src={icon.src} alt={icon.label} className="size-8 rounded-sm object-cover" />
                    </button>
                  ))}
                </div>
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
            <DialogDescription>
              Cette action sera retirée du build order.
              {deleteTargetHasBranches && ' Ses branches seront également supprimées.'}
            </DialogDescription>
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

      <Dialog
        open={deletePhaseIndex !== null}
        onOpenChange={(open) => !open && setDeletePhaseIndex(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette phase ?</DialogTitle>
            <DialogDescription>
              La phase et toutes ses actions seront retirées du build order.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletePhaseIndex(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDeletePhase}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteBranchTarget !== null}
        onOpenChange={(open) => !open && setDeleteBranchTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Supprimer cette branche ?</DialogTitle>
            <DialogDescription>
              La branche et toutes ses actions seront retirées du build order.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteBranchTarget(null)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={confirmDeleteBranch}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={headerDraft !== null} onOpenChange={(open) => !open && setHeaderDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la phase</DialogTitle>
            <DialogDescription>Ajustez le titre, l&apos;âge et l&apos;instant de début.</DialogDescription>
          </DialogHeader>
          {headerDraft && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phase-title">Titre</Label>
                <Input
                  id="phase-title"
                  value={headerDraft.title}
                  onChange={(event) =>
                    setHeaderDraft({ ...headerDraft, title: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phase-age">Âge</Label>
                <Select
                  value={headerDraft.age}
                  onValueChange={(value) =>
                    setHeaderDraft({ ...headerDraft, age: value as Phase['age'] })
                  }
                >
                  <SelectTrigger id="phase-age" className="w-full">
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
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phase-time-start">Instant de début (secondes)</Label>
                <Input
                  id="phase-time-start"
                  type="number"
                  min={0}
                  value={headerDraft.timeStart}
                  onChange={(event) =>
                    setHeaderDraft({ ...headerDraft, timeStart: event.target.value })
                  }
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="phase-target-villagers">Villageois cible (optionnel)</Label>
                <Input
                  id="phase-target-villagers"
                  type="number"
                  min={0}
                  value={headerDraft.targetVillagers}
                  onChange={(event) =>
                    setHeaderDraft({ ...headerDraft, targetVillagers: event.target.value })
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setHeaderDraft(null)}>
              Annuler
            </Button>
            <Button onClick={applyHeaderEdit}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={decisionDraft !== null} onOpenChange={(open) => !open && setDecisionDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Éditer la décision</DialogTitle>
            <DialogDescription>
              Ajustez la condition simple de l&apos;action et gérez ses branches.
            </DialogDescription>
          </DialogHeader>
          {decisionDraft && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="decision-condition">Condition (optionnelle)</Label>
                <Input
                  id="decision-condition"
                  value={decisionDraft.condition}
                  placeholder="Si contre cavaliers précoces"
                  onChange={(event) =>
                    setDecisionDraft({ ...decisionDraft, condition: event.target.value })
                  }
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Branches</Label>
                {decisionDraft.branches.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Aucune branche — cette action redeviendra une action simple.
                  </p>
                )}
                {decisionDraft.branches.map((branch) => (
                  <div key={branch.key} className="flex items-center gap-2">
                    <Input
                      aria-label="Condition de la branche"
                      value={branch.condition}
                      onChange={(event) =>
                        updateDecisionDraftBranchCondition(branch.key, event.target.value)
                      }
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {branch.actionCount} action{branch.actionCount === 1 ? '' : 's'}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeDecisionDraftBranch(branch.key)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" onClick={addDecisionDraftBranch}>
                  <PlusIcon />
                  Ajouter une branche
                </Button>
              </div>

              {decisionDraft.branches.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDecisionDraft({ ...decisionDraft, branches: [] })}
                >
                  <SplitIcon />
                  Revenir à une action simple
                </Button>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDecisionDraft(null)}>
              Annuler
            </Button>
            <Button onClick={applyDecisionEdit}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={branchEditDraft !== null}
        onOpenChange={(open) => !open && setBranchEditDraft(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier la condition de la branche</DialogTitle>
            <DialogDescription>Cette condition s&apos;affiche en en-tête de la branche.</DialogDescription>
          </DialogHeader>
          {branchEditDraft && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="branch-condition">Condition de la branche</Label>
              <Input
                id="branch-condition"
                value={branchEditDraft.condition}
                onChange={(event) =>
                  setBranchEditDraft({ ...branchEditDraft, condition: event.target.value })
                }
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setBranchEditDraft(null)}>
              Annuler
            </Button>
            <Button onClick={applyBranchEdit}>Appliquer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
