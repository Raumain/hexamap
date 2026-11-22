import { EDITION_SCORE, type Rarity } from './rarity';

/**
 * L'Atelier — la fusion de doublons.
 *
 * Une fusion est **déterministe** : même groupe d'entrée, même carte produite.
 * Aucun tirage, aucun RNG. Le palier visé est toujours le suivant dans
 * `RARITY`, et `MYTHIQUE` n'est jamais produit : `LEGENDAIRE` est le plafond.
 */

/** Nombre de copies d'un même groupe nécessaires pour fondre. */
export const CRAFT_THRESHOLD = 3;

/**
 * Les cinq transitions autorisées. `null` signifie « pas de palier supérieur » :
 * la fusion répond alors `CRAFT_CEILING`.
 */
export const CRAFT_TRANSITIONS: Readonly<Record<Rarity, Rarity | null>> = {
  COMMUNE: 'INHABITUELLE',
  INHABITUELLE: 'RARE',
  RARE: 'EPIQUE',
  EPIQUE: 'LEGENDAIRE',
  LEGENDAIRE: null,
  MYTHIQUE: null,
};

/** Palier produit par la fusion, ou `null` au plafond. */
export function nextCraftRarity(rarity: Rarity): Rarity | null {
  return CRAFT_TRANSITIONS[rarity];
}

/** Vrai si ce palier peut être fondu (donc s'il a un successeur). */
export function isCraftableRarity(rarity: Rarity): boolean {
  return CRAFT_TRANSITIONS[rarity] !== null;
}

/**
 * Score de la carte produite : le score d'édition de son palier.
 * Les cartes consommées, elles, ne changent jamais de score.
 */
export function craftedScore(target: Rarity): number {
  return EDITION_SCORE[target];
}

/** Clé de groupe : même catégorie, même référence, même rareté. */
export function craftGroupKey(card: { category: string; refCode: string; rarity: Rarity }): string {
  return `${card.category}:${card.refCode}:${card.rarity}`;
}
