import { CATEGORY, type Category, RARITY, type Rarity } from '@hexamap/shared';

export interface CollectionFilters {
  categorie: Category[];
  rarete: Rarity[];
  q: string;
}

export type CollectionSearchWire = {
  categorie?: string;
  rarete?: string;
  q?: string;
  commune?: string;
};

export interface CollectionCardLike {
  category: Category | string;
  rarity: Rarity | string;
  refCode: string;
  nom: string;
}

export const EMPTY_COLLECTION_FILTERS: CollectionFilters = {
  categorie: [],
  rarete: [],
  q: '',
};

function firstString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === 'string') return entry;
    }
  }
  return undefined;
}

// Une valeur déjà tabulaire (`string[]`, paramètre forgé répété) se replie sur la liste.
function searchTokens(value: unknown): string[] {
  if (typeof value === 'string') return value.split(',');
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => (typeof entry === 'string' ? entry.split(',') : []));
}

// Le tri suit l'ordre du domaine (`CATEGORY` / `RARITY`), jamais l'ordre alphabétique.
function domainValues<T extends string>(value: unknown, domain: readonly T[]): T[] {
  const wanted = new Set(searchTokens(value).map((token) => token.trim().toUpperCase()));
  return domain.filter((entry) => wanted.has(entry));
}

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function parseCollectionSearch(search: Record<string, unknown>): CollectionFilters {
  return {
    categorie: domainValues(search.categorie, CATEGORY),
    rarete: domainValues(search.rarete, RARITY),
    q: firstString(search.q)?.trim() ?? '',
  };
}

export function serializeCollectionSearch(filters: CollectionFilters): CollectionSearchWire {
  const wire: CollectionSearchWire = {};
  if (filters.categorie.length > 0) wire.categorie = filters.categorie.join(',');
  if (filters.rarete.length > 0) wire.rarete = filters.rarete.join(',');
  const q = filters.q.trim();
  if (q.length > 0) wire.q = q;
  return wire;
}

export function parseCollectionWire(search: Record<string, unknown>): CollectionSearchWire {
  const wire = serializeCollectionSearch(parseCollectionSearch(search));
  const commune = firstString(search.commune);
  if (commune !== undefined && commune.trim().length > 0) wire.commune = commune;
  return wire;
}

// `refCode` n'est un code public que pour une région, un département ou une commune (code
// INSEE). Pour une `RUE`, c'est l'identifiant interne de `ref_odonymes` : aucun écran ne
// l'affiche, et le chercher retiendrait des rues au hasard sur une aiguille courte (`2`,
// `75`). Une rue ne se cherche donc que par son nom.
const CODE_SEARCHABLE_CATEGORIES: ReadonlySet<string> = new Set([
  'REGION',
  'DEPARTEMENT',
  'COMMUNE',
]);

export function collectionCardMatches(
  card: CollectionCardLike,
  filters: CollectionFilters,
): boolean {
  if (filters.categorie.length > 0 && !filters.categorie.includes(card.category as Category)) {
    return false;
  }

  if (filters.rarete.length > 0 && !filters.rarete.includes(card.rarity as Rarity)) return false;

  const needle = normalizeSearchText(filters.q);
  if (needle.length > 0) {
    const inName = normalizeSearchText(card.nom).includes(needle);
    const inCode =
      CODE_SEARCHABLE_CATEGORIES.has(card.category) &&
      normalizeSearchText(card.refCode).includes(needle);
    if (!inName && !inCode) return false;
  }

  return true;
}

export function filterCollectionCards<T extends CollectionCardLike>(
  cards: readonly T[],
  filters: CollectionFilters,
): T[] {
  return cards.filter((card) => collectionCardMatches(card, filters));
}
