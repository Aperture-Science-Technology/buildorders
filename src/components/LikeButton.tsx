import { useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@clerk/clerk-react';
import { likeBuild, unlikeBuild } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { HeartIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LikeButtonProps {
  buildId: string;
  liked: boolean;
  likeCount: number;
  size?: 'sm' | 'lg';
  onChange?: (liked: boolean, likeCount: number) => void;
}

export function LikeButton({ buildId, liked, likeCount, size = 'sm', onChange }: LikeButtonProps) {
  const { isSignedIn, getToken } = useAuth();
  const [pending, setPending] = useState(false);

  async function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!isSignedIn) {
      toast.error('Connectez-vous pour aimer ce build');
      return;
    }
    if (pending) return;

    setPending(true);
    const nextLiked = !liked;
    const nextCount = likeCount + (nextLiked ? 1 : -1);
    onChange?.(nextLiked, nextCount);

    try {
      const token = await getToken();
      if (!token) throw new Error('Session expirée, reconnectez-vous.');
      const result = nextLiked ? await likeBuild(token, buildId) : await unlikeBuild(token, buildId);
      onChange?.(result.liked, result.like_count);
    } catch (error) {
      onChange?.(liked, likeCount);
      toast.error("Impossible d'enregistrer le like", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size={size === 'lg' ? 'sm' : 'xs'}
      onClick={handleClick}
      disabled={pending}
      aria-pressed={liked}
    >
      <HeartIcon className={cn(liked && 'fill-destructive text-destructive')} />
      {likeCount}
    </Button>
  );
}
