import type { Rarity } from './rarity';

/**
 * Exemples normatifs de `.docs/01-architecture.md` §2.4, figés pour la salle
 * « Les Raretés ». `packages/spec/src/rarity-examples.spec.ts` assert que
 * chaque score reste celui de `communeScore` / `rueScore` : le jour où une
 * formule change, la page ne peut pas continuer à annoncer l'ancienne.
 */
export interface CommuneScoreExample {
  readonly population: number;
  readonly score: number;
}

export interface RueScoreExample {
  readonly nbCommunes: number;
  readonly score: number;
}

export const COMMUNE_SCORE_EXAMPLES: readonly CommuneScoreExample[] = [
  { population: 100, score: 400 },
  { population: 1_000, score: 900 },
  { population: 10_000, score: 1_600 },
  { population: 100_000, score: 2_500 },
  { population: 1_000_000, score: 3_600 },
];

export const RUE_SCORE_EXAMPLES: readonly RueScoreExample[] = [
  { nbCommunes: 10_000, score: 600 },
  { nbCommunes: 1_000, score: 750 },
  { nbCommunes: 100, score: 1_000 },
  { nbCommunes: 10, score: 1_500 },
  { nbCommunes: 1, score: 3_000 },
];

/**
 * Une bande de rareté, bornes **incluses**. `null` vaut « pas de borne » : une
 * commune de moins de 1 000 habitants n'a pas de plancher, une rue présente
 * dans plus de 500 communes n'a pas de plafond.
 *
 * Les bornes sont une donnée d'affichage, jamais une seconde formule :
 * `packages/spec/src/rarity-examples.spec.ts` vérifie chaque borne contre
 * `communeRarity` et `rueRarity`, y compris la valeur qui la franchit.
 */
export interface RarityBand {
  readonly rarity: Rarity;
  readonly min: number | null;
  readonly max: number | null;
}

export const COMMUNE_RARITY_BOUNDS: readonly RarityBand[] = [
  { rarity: 'COMMUNE', min: null, max: 999 },
  { rarity: 'INHABITUELLE', min: 1_000, max: 4_999 },
  { rarity: 'RARE', min: 5_000, max: 19_999 },
  { rarity: 'EPIQUE', min: 20_000, max: 99_999 },
  { rarity: 'LEGENDAIRE', min: 100_000, max: 249_999 },
  { rarity: 'MYTHIQUE', min: 250_000, max: null },
];

export const RUE_RARITY_BOUNDS: readonly RarityBand[] = [
  { rarity: 'COMMUNE', min: 501, max: null },
  { rarity: 'INHABITUELLE', min: 100, max: 500 },
  { rarity: 'RARE', min: 20, max: 99 },
  { rarity: 'EPIQUE', min: 5, max: 19 },
  { rarity: 'LEGENDAIRE', min: 2, max: 4 },
  { rarity: 'MYTHIQUE', min: 1, max: 1 },
];
