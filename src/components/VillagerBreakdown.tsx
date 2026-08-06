import { GameIcon } from '@/components/GameIcon';
import { cn } from '@/lib/utils';

type ResourceName = 'food' | 'wood' | 'gold' | 'stone';

interface VillagerBreakdownProps {
  resources: Partial<Record<ResourceName, number>>;
  size?: 'sm' | 'md';
  active?: ResourceName | null;
  className?: string;
}

const RESOURCE_ORDER: ResourceName[] = ['food', 'wood', 'gold', 'stone'];

const RESOURCE_COLOR_CLASSES: Record<ResourceName, string> = {
  food: 'bg-red-950',
  wood: 'bg-emerald-950',
  gold: 'bg-yellow-950',
  stone: 'bg-slate-700',
};

export function VillagerBreakdown({ resources, size = 'md', active, className }: VillagerBreakdownProps) {
  const hasAnyValue = RESOURCE_ORDER.some((name) => resources[name] !== undefined);
  if (!hasAnyValue) return null;

  return (
    <div className={cn('grid grid-cols-4 gap-2 sm:gap-3', className)}>
      {RESOURCE_ORDER.map((name) => (
        <div key={name} className="flex flex-col items-center gap-1.5">
          <GameIcon iconId={`resources_${name}`} size={size === 'md' ? 'md' : 'sm'} />
          <span
            className={cn(
              'rounded-md px-3 py-1.5 font-mono text-xl font-bold text-white',
              RESOURCE_COLOR_CLASSES[name],
              active === name && 'border-t-2 border-amber-400',
            )}
          >
            {resources[name] ?? '–'}
          </span>
        </div>
      ))}
    </div>
  );
}
