import { civFlag } from '@/lib/civs';
import { cn } from '@/lib/utils';

interface CivFlagProps {
  civ: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_CLASSES: Record<NonNullable<CivFlagProps['size']>, string> = {
  sm: 'size-4',
  md: 'size-6',
  lg: 'size-9',
};

export function CivFlag({ civ, className, size = 'md' }: CivFlagProps) {
  const src = civFlag(civ);
  if (!src) return null;

  return (
    <img
      src={src}
      alt={civ}
      className={cn('rounded-sm object-cover', SIZE_CLASSES[size], className)}
    />
  );
}
