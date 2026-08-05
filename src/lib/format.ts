import type { BuildOwner } from './types';

export function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
}

export function ownerDisplayName(owner?: BuildOwner): string {
  return owner?.display_name?.trim() ? owner.display_name : 'Utilisateur inconnu';
}

export function ownerInitial(owner?: BuildOwner): string {
  const name = ownerDisplayName(owner);
  return name === 'Utilisateur inconnu' ? '?' : name.charAt(0).toUpperCase();
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
