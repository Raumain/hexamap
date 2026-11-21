import type { Rarity } from '@hexamap/shared';
import type { CSSProperties } from 'react';
import { RARITY_THEME } from '../../../lib/rarity-theme';

const numberFormatter = new Intl.NumberFormat('fr-FR');

export interface CardShellOptions {
  rarity: Rarity;
  locked?: boolean;
  decorative?: boolean;
  /** `plate` désigne la planche de musée : sa hauteur vient de son contenu, jamais d'un ratio. */
  ratio?: 'card' | 'plate';
  className?: string;
}

export interface CardShellProps {
  className: string;
  style: CSSProperties;
  'aria-hidden'?: true;
}

/**
 * Le carton de montage commun aux quatre planches (DESIGN_SYSTEM.md §7.1).
 * La rareté est portée par l'épaisseur et la couleur du filet, jamais par un fond.
 */
export function cardShellProps({
  rarity,
  locked = false,
  decorative = false,
  ratio = 'card',
  className = '',
}: CardShellOptions): CardShellProps {
  const theme = RARITY_THEME[rarity];

  // Double cadre : les paliers hauts ajoutent un halo de métal statique (aucun filtre).
  const halo =
    theme.treatment === 'electrum'
      ? `0 0 0 2px ${theme.metal}66`
      : theme.treatment === 'or'
        ? `0 0 0 2px ${theme.metal}40`
        : theme.borderWidth === 2
          ? `0 0 0 2px ${theme.metal}24`
          : undefined;

  const frame = decorative ? 'aspect-[4/5]' : ratio === 'plate' ? 'min-h-[19rem]' : 'aspect-[5/7]';

  const classes = [
    'exhibit group/card relative flex select-none flex-col overflow-hidden rounded-[2px] p-[3px]',
    frame,
    locked ? 'opacity-60 saturate-[0.35]' : '',
    theme.treatment === 'electrum' ? 'sheen' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return {
    className: classes,
    style: {
      borderStyle: 'solid',
      borderWidth: theme.borderWidth,
      borderColor: theme.metal,
      ...(halo ? { boxShadow: `${halo}, var(--shadow-lifted)` } : {}),
    },
    ...(decorative ? { 'aria-hidden': true as const } : {}),
  };
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return numberFormatter.format(value);
}

export function formatPopulation(population: number | null | undefined): string {
  return formatNumber(population);
}

/** Finition de la gravure : encre brune, jamais noire. */
export const ENGRAVING = 'text-ink';
