import { type Category, RARITY_LABELS, type Rarity } from '@hexamap/shared';

// I-001 — le module de choix d'une carte à mettre en vente. Pur : aucune
// requête, aucun état, aucune couleur. Les cartes arrivent déjà déverrouillées.

export interface PickableCardLike {
  id: string;
  category: Category;
  rarity: Rarity;
  refCode: string;
  nom: string;
  score: number;
}

export interface PickerFilters {
  categories: Category[];
  rarities: Rarity[];
  query: string;
}

export const EMPTY_PICKER_FILTERS: PickerFilters = {
  categories: [],
  rarities: [],
  query: '',
};

const scoreFormatter = new Intl.NumberFormat('fr-FR');

/** Accents, casse et espaces : même normalisation que la recherche du Cadastre. */
export function normalizePickerText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/gu, ' ')
    .trim();
}

export function matchesPickerFilters(card: PickableCardLike, filters: PickerFilters): boolean {
  if (filters.categories.length > 0 && !filters.categories.includes(card.category)) {
    return false;
  }

  if (filters.rarities.length > 0 && !filters.rarities.includes(card.rarity)) {
    return false;
  }

  const needle = normalizePickerText(filters.query);
  if (needle.length === 0) return true;

  return (
    normalizePickerText(card.nom).includes(needle) ||
    normalizePickerText(card.refCode).includes(needle)
  );
}

/** Filtre sans muter : l'ordre de la collection est l'ordre rendu. */
export function filterPickableCards<T extends PickableCardLike>(
  cards: readonly T[],
  filters: PickerFilters,
): T[] {
  return cards.filter((card) => matchesPickerFilters(card, filters));
}

/** Le libellé d'une ligne : « Nom — Peu commune — 1 200 pts ». */
export function pickableCardLabel(card: PickableCardLike): string {
  return `${card.nom} — ${RARITY_LABELS[card.rarity]} — ${scoreFormatter.format(card.score)} pts`;
}
