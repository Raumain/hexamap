import type { Rarity } from '@hexamap/shared';
import type { CSSProperties } from 'react';
import { RARITY_THEME } from '../../../lib/rarity-theme';

const populationFormatter = new Intl.NumberFormat('fr-FR');

export interface CardShellOptions {
  rarity: Rarity;
  locked?: boolean;
  decorative?: boolean;
  className?: string;
  background?: string;
  padding?: string;
  style?: CSSProperties;
}

/** Coque commune aux quatre gabarits de carte (DESIGN_SYSTEM.md §5). */
export function cardShellProps({
  rarity,
  locked = false,
  decorative = false,
  className = '',
  background = 'bg-surface',
  padding = 'p-2.5',
  style,
}: CardShellOptions): { className: string; style?: CSSProperties; 'aria-hidden'?: true } {
  const classes = [
    'aspect-[3/4] w-full rounded-md border-2 flex flex-col justify-between relative overflow-hidden select-none',
    background,
    padding,
    'shadow-tactile-sm',
    RARITY_THEME[rarity].borderClass,
    locked ? 'opacity-60 saturate-50' : '',
    decorative ? 'pointer-events-none' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    className: classes,
    ...(style ? { style } : {}),
    ...(decorative ? { 'aria-hidden': true as const } : {}),
  };
}

export function formatPopulation(population: number | null | undefined): string {
  if (population === null || population === undefined) return '—';
  return populationFormatter.format(population);
}
