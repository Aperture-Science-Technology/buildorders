import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Handle,
  Position,
  type Node,
  type Edge,
  type NodeProps,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Action, BuildOrder, Phase } from '@/lib/types';
import { AGE_LABELS, formatTime } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  HammerIcon,
  FlaskConicalIcon,
  SwordsIcon,
  WheatIcon,
  CogIcon,
  TrendingUpIcon,
  DotIcon,
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

const COLUMN_WIDTH = 320;
const ROW_HEIGHT = 140;
const ROW_Y_OFFSET = 80;

interface ActionNodeData extends Record<string, unknown> {
  description: string;
  at: number;
  kind?: Action['kind'];
}

function ActionNode({ data }: NodeProps<Node<ActionNodeData, 'action'>>) {
  const Icon = data.kind ? ACTION_KIND_ICONS[data.kind] : DotIcon;
  return (
    <div className="w-[280px] rounded-lg border bg-card text-card-foreground shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-start gap-3 p-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-1">
          <span className="font-mono text-xs text-muted-foreground">
            {formatTime(data.at)}
          </span>
          <span className="text-sm font-medium leading-snug">{data.description}</span>
        </div>
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

interface BuildOrderFlowProps {
  buildOrder: BuildOrder;
}

export function BuildOrderFlow({ buildOrder }: BuildOrderFlowProps) {
  const { nodes, edges } = useMemo(() => {
    const flowNodes: Node[] = [];
    const flowEdges: Edge[] = [];
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
        flowNodes.push({
          id,
          type: 'action',
          position: { x, y: actionIndex * ROW_HEIGHT + ROW_Y_OFFSET },
          data: { description: action.description, at: action.at, kind: action.kind },
          draggable: false,
        });

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

        previousActionId = id;
      });

      if (previousActionId) {
        previousPhaseLastActionId = previousActionId;
      }
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [buildOrder]);

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
      nodeTypes={nodeTypes}
      fitView
      proOptions={{ hideAttribution: true }}
      panOnDrag
      zoomOnScroll
      zoomOnPinch
      selectionOnDrag
      panOnScroll={false}
      nodesDraggable={false}
      nodesConnectable={false}
    >
      <Background />
      <Controls />
      <MiniMap />
    </ReactFlow>
  );
}
