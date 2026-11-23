import { craftGroupKey } from './atelier';
import type { Rarity } from './rarity';

/** Carte minimale nécessaire au regroupement : ce que GET /cards rend déjà. */
export interface ExemplaireEntry {
  id: string;
  category: string;
  refCode: string;
  rarity: Rarity;
  acquiredAt?: string;
}

/** Groupe d'exemplaires identiques : clé de fusion, représentant, nombre, rang d'apparition. */
export interface ExemplaireGroup<T extends ExemplaireEntry> {
  key: string;
  representative: T;
  count: number;
  rank: number;
}

/** Regroupe des cartes par `craftGroupKey` ; l'entrée n'est jamais mutée. */
export function groupExemplaires<T extends ExemplaireEntry>(
  cards: readonly T[],
): ExemplaireGroup<T>[] {
  const byKey = new Map<string, ExemplaireGroup<T>>();
  for (const card of cards) {
    const key = craftGroupKey({
      category: card.category,
      refCode: card.refCode,
      rarity: card.rarity,
    });
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { key, representative: card, count: 1, rank: byKey.size });
      continue;
    }
    existing.count += 1;
    if (isMoreRecent(card, existing.representative)) existing.representative = card;
  }
  return [...byKey.values()];
}

function isMoreRecent(candidate: ExemplaireEntry, current: ExemplaireEntry): boolean {
  if (candidate.acquiredAt === undefined || current.acquiredAt === undefined) return false;
  return candidate.acquiredAt > current.acquiredAt;
}
