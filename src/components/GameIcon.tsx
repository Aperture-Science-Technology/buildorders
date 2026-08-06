import type { Action } from '@/lib/types';
import { iconDef, resolveIconId, type GameIconCategory } from '@/lib/gameIcons';
import { cn } from '@/lib/utils';

interface GameIconProps {
  iconId?: string;
  kind?: Action['kind'];
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<GameIconProps['size']>, string> = {
  sm: 'size-6 rounded-md p-1',
  md: 'size-8 rounded-lg p-1.5',
  lg: 'size-12 rounded-xl p-2',
  xl: 'size-16 rounded-2xl p-2.5',
};

const CATEGORY_COLOR_CLASSES: Record<GameIconCategory, string> = {
  resource: 'bg-slate-700',
  building: 'bg-blue-950',
  unit: 'bg-blue-950',
  tech: 'bg-teal-900',
  other: 'bg-muted',
};

export function GameIcon({ iconId, kind, description, size = 'md', className }: GameIconProps) {
  const resolvedId = resolveIconId({ iconId, description: description ?? '', kind });
  const def = resolvedId ? iconDef(resolvedId) : undefined;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-gradient-to-b from-white/10 to-transparent ring-1 ring-black/20',
        CATEGORY_COLOR_CLASSES[def?.category ?? 'other'],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {def?.src && <img src={def.src} alt="" className="h-full w-full object-contain" />}
    </span>
  );
}
