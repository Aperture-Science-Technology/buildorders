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
import type { Action, BuildOrder, Phase } from '@/lib/types';
import { updateBuildOrder } from '@/lib/api';
import { AGE_LABELS, formatTime } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActionDescription } from '@/components/ActionDescription';
import { Link2Icon } from 'lucide-react';

const COLUMN_WIDTH = 360;
const ROW_HEIGHT = 180;
const ROW_Y_OFFSET = 100;

interface ActionNodeData extends Record<string, unknown> {
  description: string;
  at: number;
  kind?: Action['kind'];
  iconId?: string;
  hasDependency?: boolean;
}

function ActionNode({ data }: NodeProps<Node<ActionNodeData, 'action'>>) {
  return (
    <div className="w-[300px] rounded-lg border bg-card text-card-foreground shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-start gap-3 p-3">
        <div className="flex flex-1 flex-col gap-1">
          <span className="font-mono text-xs text-muted-foreground">
            {formatTime(data.at)}
          </span>
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
}

function PhaseHeaderNode({ data }: NodeProps<Node<PhaseHeaderNodeData, 'phaseHeader'>>) {
  return (
    <div className="flex w-[280px] flex-col items-start gap-1">
      <Badge>{AGE_LABELS[data.age]}</Badge>
      <span className="font-mono text-xs text-muted-foreground">
        {formatTime(data.timeStart)}
      </span>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  action: ActionNode,
  phaseHeader: PhaseHeaderNode,
};

const SAVE_DEBOUNCE_MS = 500;

function buildFlowElements(buildOrder: BuildOrder): { nodes: Node[]; edges: Edge[] } {
  const flowNodes: Node[] = [];
  const flowEdges: Edge[] = [];
  const layout = buildOrder.layout;
  const nodeIdByActionId = new Map<string, string>();
  let previousPhaseLastActionId: string | null = null;

  buildOrder.phases.forEach((phase, phaseIndex) => {
    const x = phaseIndex * COLUMN_WIDTH;

    flowNodes.push({
      id: `phase-${phaseIndex}-header`,
      type: 'phaseHeader',
      position: { x, y: 0 },
      data: { age: phase.age, timeStart: phase.timeStart },
      draggable: false,
      selectable: false,
    });

    let previousActionId: string | null = null;

    phase.actions.forEach((action, actionIndex) => {
      const id = `phase-${phaseIndex}-action-${actionIndex}`;
      if (action.id) nodeIdByActionId.set(action.id, id);
      const defaultPosition = { x, y: actionIndex * ROW_HEIGHT + ROW_Y_OFFSET };
      flowNodes.push({
        id,
        type: 'action',
        position: layout?.[id] ?? defaultPosition,
        data: {
          description: action.description,
          at: action.at,
          kind: action.kind,
          iconId: action.iconId,
          hasDependency: Boolean(action.dependsOn?.length),
        },
        draggable: true,
      });

      if (!action.dependsOn?.length) {
        if (previousActionId) {
          flowEdges.push({
            id: `${previousActionId}->${id}`,
            source: previousActionId,
            target: id,
            type: 'smoothstep',
            animated: false,
          });
        } else if (previousPhaseLastActionId) {
          flowEdges.push({
            id: `${previousPhaseLastActionId}->${id}`,
            source: previousPhaseLastActionId,
            target: id,
            type: 'smoothstep',
            animated: false,
          });
        }
      }

      previousActionId = id;
    });

    if (previousActionId) {
      previousPhaseLastActionId = previousActionId;
    }
  });

  buildOrder.phases.forEach((phase) => {
    phase.actions.forEach((action) => {
      if (!action.id || !action.dependsOn?.length) return;
      const targetNodeId = nodeIdByActionId.get(action.id);
      if (!targetNodeId) return;
      for (const depId of action.dependsOn) {
        const sourceNodeId = nodeIdByActionId.get(depId);
        if (!sourceNodeId) continue;
        flowEdges.push({
          id: `dep-${sourceNodeId}->${targetNodeId}`,
          source: sourceNodeId,
          target: targetNodeId,
          type: 'smoothstep',
          animated: false,
          style: { strokeDasharray: '4 4' },
          markerEnd: { type: MarkerType.ArrowClosed },
        });
      }
    });
  });

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
