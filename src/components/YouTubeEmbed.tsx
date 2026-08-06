import { cn } from '@/lib/utils';

const YOUTUBE_ID_REGEX =
  /(?:youtube(?:-nocookie)?\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function getYouTubeVideoId(url: string): string | null {
  const match = url.match(YOUTUBE_ID_REGEX);
  return match ? match[1] : null;
}

export function YouTubeEmbed({ url, className }: { url: string; className?: string }) {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;

  return (
    <div className={cn('aspect-video w-full overflow-hidden rounded-lg border', className)}>
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${videoId}`}
        title="Vidéo source"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}
