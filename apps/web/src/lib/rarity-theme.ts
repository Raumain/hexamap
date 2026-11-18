import { RARITY_ACCENT_HEX, RARITY_LABELS, type Rarity } from '@hexamap/shared';

export interface RarityTheme {
  label: string;
  borderClass: string;
  badgeBgClass: string;
  badgeTextClass: string;
  accentHex: string;
}

/**
 * Thème unique de rareté (DESIGN_SYSTEM.md §3.2).
 * Les libellés viennent de `RARITY_LABELS` et les accents de `RARITY_ACCENT_HEX` :
 * aucune valeur hexadécimale n'est réécrite ici.
 */
export const RARITY_THEME: Record<Rarity, RarityTheme> = {
  COMMUNE: {
    label: RARITY_LABELS.COMMUNE,
    borderClass: 'border-slate-400',
    badgeBgClass: 'bg-slate-200',
    badgeTextClass: 'text-slate-800',
    accentHex: RARITY_ACCENT_HEX.COMMUNE,
  },
  INHABITUELLE: {
    label: RARITY_LABELS.INHABITUELLE,
    borderClass: 'border-emerald-700',
    badgeBgClass: 'bg-emerald-100',
    badgeTextClass: 'text-emerald-900',
    accentHex: RARITY_ACCENT_HEX.INHABITUELLE,
  },
  RARE: {
    label: RARITY_LABELS.RARE,
    borderClass: 'border-blue-700',
    badgeBgClass: 'bg-blue-100',
    badgeTextClass: 'text-blue-900',
    accentHex: RARITY_ACCENT_HEX.RARE,
  },
  EPIQUE: {
    label: RARITY_LABELS.EPIQUE,
    borderClass: 'border-purple-800',
    badgeBgClass: 'bg-purple-100',
    badgeTextClass: 'text-purple-900',
    accentHex: RARITY_ACCENT_HEX.EPIQUE,
  },
  LEGENDAIRE: {
    label: RARITY_LABELS.LEGENDAIRE,
    borderClass: 'border-amber-600 border-r-4 border-b-4',
    badgeBgClass: 'bg-amber-100',
    badgeTextClass: 'text-amber-950',
    accentHex: RARITY_ACCENT_HEX.LEGENDAIRE,
  },
  MYTHIQUE: {
    label: RARITY_LABELS.MYTHIQUE,
    borderClass: 'border-sign-gold ring-1 ring-sign-gold',
    badgeBgClass: 'bg-amber-50',
    badgeTextClass: 'text-amber-950',
    accentHex: RARITY_ACCENT_HEX.MYTHIQUE,
  },
};
