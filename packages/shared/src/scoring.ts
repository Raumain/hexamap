import { ALIGNMENT_MULTIPLIER, EDITION_SCORE, type Rarity } from './rarity';

export function communeScore(population: number): number {
  return Math.round(100 * Math.log10(Math.max(population, 10)) ** 2);
}

export function rueScore(nbCommunes: number): number {
  return Math.round(3000 / (1 + Math.log10(Math.max(nbCommunes, 1))));
}

export function editionScore(rarity: Rarity): number {
  return EDITION_SCORE[rarity];
}

export function departementPopulationBonus(population: number): number {
  return Math.round(20 * Math.log10(Math.max(population, 10)));
}

export function alignmentMultiplier(links: number): number {
  const index = Math.max(0, Math.min(links, 3));
  return ALIGNMENT_MULTIPLIER[index] ?? 1;
}

export interface TableauScores {
  region: number;
  departement: number;
  commune: number;
  rue: number;
}

export function tableauScore(scores: TableauScores, links: number): number {
  const total = scores.region + scores.departement + scores.commune + scores.rue;
  return Math.round(total * alignmentMultiplier(links));
}
