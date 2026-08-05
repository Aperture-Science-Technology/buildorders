import type { Action } from '@/lib/types';
import { iconForAction } from '@/lib/gameIcons';
import { cn } from '@/lib/utils';

interface ActionDescriptionProps {
  action: Pick<Action, 'description' | 'kind' | 'iconId'>;
  iconSize?: number;
  className?: string;
}

const ICON_SIZE_CLASSES: Record<number, string> = {
  16: 'size-4',
  18: 'size-[18px]',
  20: 'size-5',
  24: 'size-6',
};

export function ActionDescription({ action, iconSize = 16, className }: ActionDescriptionProps) {
  const iconSrc = iconForAction({ ...action, at: 0 });
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {iconSrc && (
        <img
          src={iconSrc}
          alt=""
          className={cn(ICON_SIZE_CLASSES[iconSize] ?? 'size-4', 'shrink-0 rounded-sm object-cover')}
        />
      )}
      <span>{action.description}</span>
    </span>
  );
}
