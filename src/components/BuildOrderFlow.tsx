import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
  type OnNodeDrag,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useAuth } from '@clerk/clerk-react';
import { toast } from 'sonner';
import type { Action, ActionBranch, BuildOrder, Phase } from '@/lib/types';
import { updateBuildOrder } from '@/lib/api';
import { AGE_LABELS, formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActionDescription } from '@/components/ActionDescription';
import { VillagerBreakdown } from '@/components/VillagerBreakdown';
import { GitBranchIcon, Link2Icon, SplitIcon } from 'lucide-react';

const COLUMN_WIDTH = 360;
const ROW_HEIGHT = 180;
const ROW_Y_OFFSET = 100;
/** Edge color for decision -> branch links (matches the amber decision border/badge). */
const BRANCH_EDGE_COLOR = '#f59e0b';

interface ActionNodeData extends Record<string, unknown> {
  description: string;
  at: number;
  kind?: Action['kind'];
  iconId?: string;
  hasDependency?: boolean;
  condition?: string;
  isDecision?: boolean;
}

function ActionNode({ data }: NodeProps<Node<ActionNodeData, 'action'>>) {
  return (
    <div
      className={cn(
        'w-[300px] rounded-lg border bg-card text-card-foreground shadow-sm',
        data.isDecision && 'border-2 border-amber-400/60',
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-start gap-3 p-3">
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">
              {formatTime(data.at)}
            </span>
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
              action={{ description: data.description, kind: data.kind, iconId: data.iconId }}
              iconSize={16}
            />
          </span>
        </div>
        {data.hasDependency && (
          <Link2Icon className="size-4 shrink-0 text-muted-foreground" />
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

interface PhaseHeaderNodeData extends Record<string, unknown> {
  age: Phase['age'];
  timeStart: number;
  targetResources?: Phase['targetResources'];
}

function PhaseHeaderNode({ data }: NodeProps<Node<PhaseHeaderNodeData, 'phaseHeader'>>) {
  return (
    <div className="flex w-[280px] flex-col items-start gap-2">
      <Badge>{AGE_LABELS[data.age]}</Badge>
      <span className="font-mono text-xs text-muted-foreground">
        {formatTime(data.timeStart)}
      </span>
      {data.targetResources && <VillagerBreakdown resources={data.targetResources} size="sm" />}
    </div>
  );
}

interface BranchHeaderNodeData extends Record<string, unknown> {
  condition: string;
}

function BranchHeaderNode({ data }: NodeProps<Node<BranchHeaderNodeData, 'branchHeader'>>) {
  return (
    <div className="flex w-[280px] flex-col items-start gap-1">
      <Badge variant="outline" className="gap-1 border-amber-400/60 text-[10px]">
        <SplitIcon className="size-3" />
        {data.condition}
      </Badge>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  action: ActionNode,
  phaseHeader: PhaseHeaderNode,
  branchHeader: BranchHeaderNode,
};

const SAVE_DEBOUNCE_MS = 500;

function buildFlowElements(buildOrder: BuildOrder): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];
  const layout = buildOrder.layout;
  const nodeIdByActionId = new Map<string, string>();
  const allActionRefs: { action: Action; nodeId: string }[] = [];
  let previousPhaseLastActionId: string | null = null;

  function pushActionNode(
    id: string,
    action: Action,
    defaultPosition: { x: number; y: number },
  ): { x: number; y: number } {
    if (action.id) nodeIdByActionId.set(action.id, id);
    const position = layout?.[id] ?? defaultPosition;
    flowNodes.push({
      id,
      type: 'action',
      position,
      data: {
        description: action.description,
        at: action.at,
        kind: action.kind,
        iconId: action.iconId,
        hasDependency: Boolean(action.dependsOn?.length),
        condition: action.condition,
        isDecision: Boolean(action.branches?.length),
      },
      draggable: true,
    });
    allActionRefs.push({ action, nodeId: id });
    return position;
  }

  function pushSequentialEdge(sourceId: string | null, targetId: string) {
    if (!sourceId) return;
    flowEdges.push({
      id: `${sourceId}->${targetId}`,
      source: sourceId,
      target: targetId,
      type: 'smoothstep',
      animated: false,
    });
  }

  // Renders each branch as its own column to the right of the decision node.
  // Nested branches (a branch action that is itself a decision) are not
  // recursively expanded in this read-only view — kept simple per spec.
  function buildBranches(
    decisionId: string,
    decisionPosition: { x: number; y: number },
    branches: ActionBranch[],
  ) {
    branches.forEach((branch, branchIndex) => {
      const columnX = decisionPosition.x + COLUMN_WIDTH * (branchIndex + 1);
      const headerId = `${decisionId}-branch-${branchIndex}-header`;

      flowNodes.push({
        id: headerId,
        type: 'branchHeader',
        position: { x: columnX, y: decisionPosition.y },
        data: { condition: branch.condition },
        draggable: false,
        selectable: false,
      });

      flowEdges.push({
        id: `${decisionId}->${headerId}`,
        source: decisionId,
        target: headerId,
        type: 'smoothstep',
        animated: true,
        style: { stroke: BRANCH_EDGE_COLOR },
      });

      let previousBranchActionId: string | null = null;
      branch.actions.forEach((branchAction, branchActionIndex) => {
        const branchActionId = `${headerId}-action-${branchActionIndex}`;
        pushActionNode(branchActionId, branchAction, {
          x: columnX,
          y: decisionPosition.y + ROW_HEIGHT * (branchActionIndex + 1),
        });

        if (!branchAction.dependsOn?.length) {
          pushSequentialEdge(previousBranchActionId ?? headerId, branchActionId);
        }
        previousBranchActionId = branchActionId;
      });
    });
  }

  buildOrder.phases.forEach((phase, phaseIndex) => {
    const x = phaseIndex * COLUMN_WIDTH;

    flowNodes.push({
      id: `phase-${phaseIndex}-header`,
      type: 'phaseHeader',
      position: { x, y: 0 },
      data: { age: phase.age, timeStart: phase.timeStart, targetResources: phase.targetResources },
      draggable: false,
      selectable: false,
    });

    let previousActionId: string | null = null;

    phase.actions.forEach((action, actionIndex) => {
      const id = `phase-${phaseIndex}-action-${actionIndex}`;
      const defaultPosition = { x, y: actionIndex * ROW_HEIGHT + ROW_Y_OFFSET };
      const position = pushActionNode(id, action, defaultPosition);

      if (!action.dependsOn?.length) {
        pushSequentialEdge(previousActionId ?? previousPhaseLastActionId, id);
      }

      if (action.branches?.length) {
        buildBranches(id, position, action.branches);
      }

      previousActionId = id;
    });

    if (previousActionId) {
      previousPhaseLastActionId = previousActionId;
    }
  });

  for (const { action, nodeId } of allActionRefs) {
    if (!action.dependsOn?.length) continue;
    for (const depId of action.dependsOn) {
      const sourceNodeId = nodeIdByActionId.get(depId);
      if (!sourceNodeId) continue;
      flowEdges.push({
        id: `dep-${sourceNodeId}->${nodeId}`,
        source: sourceNodeId,
        target: nodeId,
        type: 'smoothstep',
        animated: false,
        style: { strokeDasharray: '4 4' },
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    }
  }

  return { nodes: flowNodes, edges: flowEdges };
}

interface BuildOrderFlowProps {
  buildOrder: BuildOrder;
}

export function BuildOrderFlow({ buildOrder }: BuildOrderFlowProps) {
  const { userId, getToken } = useAuth();
  const canPersistLayout = Boolean(userId) && buildOrder.ownerId === userId;

  const initialElements = useMemo(() => buildFlowElements(buildOrder), [buildOrder]);
  const [nodes, setNodes, onNodesChange] = useNodesState(initialElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialElements.edges);

  useEffect(() => {
    setNodes(initialElements.nodes);
    setEdges(initialElements.edges);
  }, [initialElements, setNodes, setEdges]);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, []);

  const handleNodeDragStop: OnNodeDrag = useCallback(() => {
    if (!canPersistLayout) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      const layout: Record<string, { x: number; y: number }> = {};
      for (const node of nodes) {
        if (node.type === 'action') {
          layout[node.id] = { x: node.position.x, y: node.position.y };
        }
      }

      getToken()
        .then((token) => {
          if (!token) return;
          return updateBuildOrder(buildOrder.id, { layout }, token);
        })
        .catch((error: unknown) => {
          toast.error("Impossible d'enregistrer la position", {
            description: error instanceof Error ? error.message : undefined,
          });
        });
    }, SAVE_DEBOUNCE_MS);
  }, [canPersistLayout, nodes, getToken, buildOrder.id]);

  const hasActions = buildOrder.phases.some((phase) => phase.actions.length > 0);

  if (!hasActions) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Aucune action dans ce build order</CardTitle>
          <CardDescription>Ce build order ne contient pas encore d&apos;actions.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDragStop={handleNodeDragStop}
      nodeTypes={nodeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      selectionOnDrag
      panOnScroll={false}
      nodesDraggable={true}
      nodesConnectable={false}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
