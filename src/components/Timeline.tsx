import type { BuildOrder } from '@/lib/types';
import { AGE_LABELS, ACTION_KIND_LABELS, formatTime } from '@/lib/format';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface TimelineProps {
  buildOrder: BuildOrder;
}

export function Timeline({ buildOrder }: TimelineProps) {
  return (
    <Tabs defaultValue={buildOrder.phases[0]?.age} className="w-full">
      <TabsList>
        {buildOrder.phases.map((phase) => (
          <TabsTrigger key={phase.age} value={phase.age}>
            {AGE_LABELS[phase.age]}
          </TabsTrigger>
        ))}
      </TabsList>

      {buildOrder.phases.map((phase) => (
        <TabsContent key={phase.age} value={phase.age} className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{AGE_LABELS[phase.age]}</CardTitle>
              <CardDescription>
                Starts at {formatTime(phase.timeStart)}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              {phase.targetVillagers !== undefined && (
                <Badge variant="secondary">
                  {phase.targetVillagers} villagers
                </Badge>
              )}
              {phase.targetResources && (
                <>
                  <Badge variant="outline">
                    {phase.targetResources.food} food
                  </Badge>
                  <Badge variant="outline">
                    {phase.targetResources.wood} wood
                  </Badge>
                  <Badge variant="outline">
                    {phase.targetResources.gold} gold
                  </Badge>
                  <Badge variant="outline">
                    {phase.targetResources.stone} stone
                  </Badge>
                </>
              )}
            </CardContent>
          </Card>

          <Separator />

          <div className="grid gap-2 sm:grid-cols-2">
            {phase.actions.map((action) => (
              <Card key={`${phase.age}-${action.at}-${action.description}`}>
                <CardContent className="flex items-start justify-between gap-3 py-4">
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-medium">
                      {action.description}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(action.at)}
                    </span>
                  </div>
                  {action.kind && (
                    <Badge variant="secondary">
                      {ACTION_KIND_LABELS[action.kind]}
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
