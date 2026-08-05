import type { ComponentType } from 'react';
import { GlobeIcon, LockIcon, Share2Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Visibility } from '@/lib/types';

export const VISIBILITY_OPTIONS: {
  value: Visibility;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { value: 'public', label: 'Public', icon: GlobeIcon },
  { value: 'private', label: 'Privé', icon: LockIcon },
  { value: 'shared', label: 'Partagé', icon: Share2Icon },
];

const VISIBILITY_VARIANTS: Record<Visibility, 'secondary' | 'outline' | 'default'> = {
  public: 'secondary',
  private: 'outline',
  shared: 'default',
};

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const option = VISIBILITY_OPTIONS.find((item) => item.value === visibility) ?? VISIBILITY_OPTIONS[0];
  const Icon = option.icon;

  return (
    <Badge variant={VISIBILITY_VARIANTS[visibility]}>
      <Icon />
      {option.label}
    </Badge>
  );
}
