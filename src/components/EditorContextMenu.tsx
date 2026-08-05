import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface ContextMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  danger?: boolean;
}

interface EditorContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect: (id: string) => void;
  onClose: () => void;
}

const RADIAL_THRESHOLD = 5;
const RADIAL_RADIUS = 88;

export function EditorContextMenu({ x, y, items, onSelect, onClose }: EditorContextMenuProps) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') closeRef.current();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (items.length === 0) return null;
  const isRadial = items.length <= RADIAL_THRESHOLD;

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/20"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      {isRadial ? (
        <div className="absolute" style={{ left: x, top: y }}>
          {items.map((item, index) => {
            const angle = (index / items.length) * 2 * Math.PI - Math.PI / 2;
            const itemX = Math.cos(angle) * RADIAL_RADIUS;
            const itemY = Math.sin(angle) * RADIAL_RADIUS;
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className="group absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: itemX, top: itemY }}
              >
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    'size-14 rounded-full bg-popover text-popover-foreground shadow-lg',
                    item.danger && 'text-destructive hover:bg-destructive/10',
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(item.id);
                  }}
                >
                  <Icon className="size-5" />
                </Button>
                <span className="pointer-events-none absolute top-full left-1/2 mt-1.5 -translate-x-1/2 rounded-md bg-foreground px-2 py-1 text-xs whitespace-nowrap text-background opacity-0 transition-opacity group-hover:opacity-100">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          className="absolute grid grid-cols-2 gap-2 rounded-lg border bg-popover p-2 text-popover-foreground shadow-lg"
          style={{ left: x, top: y }}
          onClick={(event) => event.stopPropagation()}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Button
                key={item.id}
                type="button"
                variant="outline"
                className={cn(
                  'aspect-square h-auto w-20 flex-col gap-1.5 text-xs font-medium',
                  item.danger && 'text-destructive hover:bg-destructive/10',
                )}
                onClick={() => onSelect(item.id)}
              >
                <Icon className="size-5" />
                {item.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
