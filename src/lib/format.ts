export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export const AGE_LABELS: Record<'dark' | 'feudal' | 'castle' | 'imperial', string> = {
  dark: 'Dark Age',
  feudal: 'Feudal Age',
  castle: 'Castle Age',
  imperial: 'Imperial Age',
};

export const ACTION_KIND_LABELS: Record<
  NonNullable<import('./types').Action['kind']>,
  string
> = {
  build: 'Build',
  research: 'Research',
  train: 'Train',
  gather: 'Gather',
  tech: 'Tech',
  'age-up': 'Age Up',
};
