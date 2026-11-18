export const RARITY = [
  'COMMUNE',
  'INHABITUELLE',
  'RARE',
  'EPIQUE',
  'LEGENDAIRE',
  'MYTHIQUE',
] as const;

export type Rarity = (typeof RARITY)[number];

// Single presentation source for rarity, consumed by `apps/web/src/lib/rarity-theme.ts`.
// Labels and accent hex values are part of the design system (DESIGN_SYSTEM.md §3.2).
export const RARITY_LABELS: Record<Rarity, string> = {
  COMMUNE: 'Commune',
  INHABITUELLE: 'Peu commune',
  RARE: 'Rare',
  EPIQUE: 'Épique',
  LEGENDAIRE: 'Légendaire',
  MYTHIQUE: 'Mythique',
};

export const RARITY_ACCENT_HEX: Record<Rarity, string> = {
  COMMUNE: '#64748B',
  INHABITUELLE: '#047857',
  RARE: '#1D4ED8',
  EPIQUE: '#6B21A8',
  LEGENDAIRE: '#C25E00',
  MYTHIQUE: '#D97706',
};

export const RARITY_WEIGHTS: Record<Rarity, number> = {
  COMMUNE: 55.0,
  INHABITUELLE: 25.0,
  RARE: 13.0,
  EPIQUE: 5.0,
  LEGENDAIRE: 1.8,
  MYTHIQUE: 0.2,
};

export const EDITION_SCORE: Record<Rarity, number> = {
  COMMUNE: 200,
  INHABITUELLE: 400,
  RARE: 750,
  EPIQUE: 1250,
  LEGENDAIRE: 2000,
  MYTHIQUE: 3500,
};

export const ALIGNMENT_MULTIPLIER = [1.0, 1.5, 2.5, 5.0] as const;

export const CATEGORY = ['REGION', 'DEPARTEMENT', 'COMMUNE', 'RUE'] as const;

export type Category = (typeof CATEGORY)[number];

export const CATEGORY_WEIGHTS: Record<Category, number> = {
  RUE: 40,
  COMMUNE: 35,
  DEPARTEMENT: 17,
  REGION: 8,
};

export function communeRarity(population: number): Rarity {
  if (population < 1000) return 'COMMUNE';
  if (population < 5000) return 'INHABITUELLE';
  if (population < 20000) return 'RARE';
  if (population < 100000) return 'EPIQUE';
  if (population < 250000) return 'LEGENDAIRE';
  return 'MYTHIQUE';
}

export function rueRarity(nbCommunes: number): Rarity {
  if (nbCommunes > 500) return 'COMMUNE';
  if (nbCommunes >= 100) return 'INHABITUELLE';
  if (nbCommunes >= 20) return 'RARE';
  if (nbCommunes >= 5) return 'EPIQUE';
  if (nbCommunes >= 2) return 'LEGENDAIRE';
  return 'MYTHIQUE';
}
