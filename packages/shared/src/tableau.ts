import type { Category } from './rarity';
import { alignmentMultiplier, type TableauScores, tableauScore } from './scoring';

export const TABLEAU_SLOTS = ['REGION', 'DEPARTEMENT', 'COMMUNE', 'RUE'] as const;

export type TableauSlot = (typeof TABLEAU_SLOTS)[number];

export const TABLEAU_SLOT_LABELS: Record<TableauSlot, string> = {
  REGION: 'Région',
  DEPARTEMENT: 'Département',
  COMMUNE: 'Commune',
  RUE: 'Rue',
};

export const TABLEAU_LINK_KEYS = [
  'region-departement',
  'departement-commune',
  'commune-rue',
] as const;

export type TableauLinkKey = (typeof TABLEAU_LINK_KEYS)[number];

export const TABLEAU_LINK_LABELS: Record<TableauLinkKey, string> = {
  'region-departement': 'La région contient le département',
  'departement-commune': 'Le département contient la commune',
  'commune-rue': 'La rue existe dans la commune',
};

/** Un slot n'accepte que la catégorie de carte homonyme (GDD §3.C). */
export function slotMatchesCategory(slot: TableauSlot, category: Category): boolean {
  return slot === category;
}

/** Faits de référence nécessaires aux 3 liens ; null si la carte ou la donnée manque. */
export interface TableauGeography {
  regionCode: string | null;
  departementCode: string | null;
  departementRegionCode: string | null;
  communeInsee: string | null;
  communeDepartementCode: string | null;
  rueOdonymeId: string | null;
  rueInCommune: boolean;
}

export interface TableauLinkResult {
  key: TableauLinkKey;
  valid: boolean;
  label: string;
}

export interface TableauAlignment {
  links: number;
  multiplier: number;
  breakdown: TableauLinkResult[];
}

/** Ligne de `commune_odonymes` telle que fournie par l'appelant. */
export interface CommuneOdonymeRef {
  codeInsee: string;
  odonymeId: string;
}

/** Règle « la rue existe dans la commune » (GDD §3.C / architecture §2.5). */
export function rueExistsInCommune(
  rows: readonly CommuneOdonymeRef[],
  communeInsee: string | null,
  odonymeId: string | null,
): boolean {
  if (communeInsee === null || odonymeId === null) {
    return false;
  }
  return rows.some((row) => row.codeInsee === communeInsee && row.odonymeId === odonymeId);
}

/** 3 liens : région===dept.code_region ; dept===commune.code_departement ; rueInCommune.
 *  Un lien n'est valide que si les deux extrémités sont présentes. */
export function evaluateTableauAlignment(geography: TableauGeography): TableauAlignment {
  const regionDepartement =
    geography.regionCode !== null &&
    geography.departementRegionCode !== null &&
    geography.regionCode === geography.departementRegionCode;

  const departementCommune =
    geography.departementCode !== null &&
    geography.communeDepartementCode !== null &&
    geography.departementCode === geography.communeDepartementCode;

  const communeRue =
    geography.communeInsee !== null && geography.rueOdonymeId !== null && geography.rueInCommune;

  const breakdown: TableauLinkResult[] = [
    {
      key: 'region-departement',
      valid: regionDepartement,
      label: TABLEAU_LINK_LABELS['region-departement'],
    },
    {
      key: 'departement-commune',
      valid: departementCommune,
      label: TABLEAU_LINK_LABELS['departement-commune'],
    },
    { key: 'commune-rue', valid: communeRue, label: TABLEAU_LINK_LABELS['commune-rue'] },
  ];

  const links = breakdown.filter((link) => link.valid).length;

  return { links, multiplier: alignmentMultiplier(links), breakdown };
}

export interface TableauEvaluation {
  alignment: TableauAlignment;
  total: number;
}

/** total = round((region+departement+commune+rue) * multiplier) via tableauScore. */
export function evaluateTableau(
  scores: TableauScores,
  geography: TableauGeography,
): TableauEvaluation {
  const alignment = evaluateTableauAlignment(geography);
  return { alignment, total: tableauScore(scores, alignment.links) };
}
