import type { BuildOrder } from '@/lib/types';
import { AGE_LABELS, ACTION_KIND_LABELS, formatTime } from '@/lib/format';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

interface CheatsheetProps {
  buildOrder: BuildOrder;
}

export function Cheatsheet({ buildOrder }: CheatsheetProps) {
  return (
    <div className="space-y-4">
      {buildOrder.phases.map((phase) => (
        <Card key={phase.age}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {AGE_LABELS[phase.age]}
              {phase.targetVillagers !== undefined && (
                <Badge variant="secondary">
                  {phase.targetVillagers} vils
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Time</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead className="w-24">Kind</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {phase.actions.map((action) => (
                  <TableRow key={`${phase.age}-${action.at}-${action.description}`}>
                    <TableCell className="font-mono">
                      {formatTime(action.at)}
                    </TableCell>
                    <TableCell>{action.description}</TableCell>
                    <TableCell>
                      {action.kind ? ACTION_KIND_LABELS[action.kind] : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
