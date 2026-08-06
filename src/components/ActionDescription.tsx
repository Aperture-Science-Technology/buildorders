import type { Action } from '@/lib/types';
import { GameIcon } from '@/components/GameIcon';
import { cn } from '@/lib/utils';

interface ActionDescriptionProps {
  action: Pick<Action, 'description' | 'kind' | 'iconId'>;
  iconSize?: number;
  className?: string;
}

const ICON_SIZE_MAP: Record<number, 'sm' | 'md' | 'lg' | 'xl'> = {
  16: 'sm',
  18: 'sm',
  20: 'md',
  24: 'md',
  32: 'lg',
  44: 'xl',
};

export function ActionDescription({ action, iconSize = 16, className }: ActionDescriptionProps) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <GameIcon
        iconId={action.iconId}
        kind={action.kind}
        description={action.description}
        size={ICON_SIZE_MAP[iconSize] ?? 'sm'}
      />
      <span>{action.description}</span>
    </span>
  );
}
