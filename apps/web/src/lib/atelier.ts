import {
  type Category,
  CRAFT_THRESHOLD,
  craftedScore,
  craftGroupKey,
  nextCraftRarity,
  type Rarity,
} from '@hexamap/shared';
import { api } from './api';
import type { CollectionCard } from './collection';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class AtelierApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'AtelierApiError';
    this.code = code;
  }
}

function toApiErrorInfo(value: unknown): { code: string | null; message: string } {
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const body = value.value;
    if (isApiErrorValue(body)) {
      return { code: body.code, message: body.message };
    }
  }
  if (isApiErrorValue(value)) {
    return { code: value.code, message: value.message };
  }
  return { code: null, message: FALLBACK_MESSAGE };
}

function throwAtelierError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new AtelierApiError(info.message, info.code);
}

export interface CraftInput {
  category: Category;
  refCode: string;
  rarity: Rarity;
}

export async function craftCards(input: CraftInput) {
  const { data, error } = await api.api.v1.cards.craft.post(input);
  if (error) throwAtelierError(error);
  if (data && typeof data === 'object' && 'craftedCard' in data) {
    return data;
  }
  throwAtelierError(data);
}

export type CraftResult = NonNullable<Awaited<ReturnType<typeof craftCards>>>;

export interface CraftGroup {
  key: string;
  category: Category;
  refCode: string;
  nom: string;
  rarity: Rarity;
  targetRarity: Rarity;
  targetScore: number;
  count: number;
}

/**
 * Groupes fusibles de la collection : même catégorie, même `ref_code`, même
 * rareté, au moins `CRAFT_THRESHOLD` exemplaires, et un palier supérieur.
 * L'Atelier ne décide rien : il lit la règle de `@hexamap/shared` pour afficher
 * ce que le serveur produira.
 */
export function craftableGroups(cards: CollectionCard[]): CraftGroup[] {
  const groups = new Map<string, CraftGroup>();

  for (const card of cards) {
    const target = nextCraftRarity(card.rarity);
    if (target === null) continue;

    const key = craftGroupKey(card);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }

    groups.set(key, {
      key,
      category: card.category,
      refCode: card.refCode,
      nom: card.nom,
      rarity: card.rarity,
      targetRarity: target,
      targetScore: craftedScore(target),
      count: 1,
    });
  }

  return [...groups.values()]
    .filter((group) => group.count >= CRAFT_THRESHOLD)
    .sort((a, b) => b.count - a.count || a.nom.localeCompare(b.nom, 'fr'));
}

export function atelierErrorMessage(error: unknown): string {
  if (error instanceof AtelierApiError) {
    switch (error.code) {
      case 'CRAFT_NOT_ENOUGH':
        return `Il faut ${CRAFT_THRESHOLD} exemplaires identiques pour fondre une carte.`;
      case 'CRAFT_CEILING':
        return 'Ce palier est le plus haut : aucune rareté supérieure ne peut être produite.';
      case 'CARD_ENGAGED':
        return error.message;
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
