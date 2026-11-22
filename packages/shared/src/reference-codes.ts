/**
 * Codes officiels des régions françaises (BUG-003).
 *
 * La table `ref_regions` n'a aucune protection structurelle : BUG-001 est resté
 * invisible des mois parce qu'une région inventée (`<préfixe>-R2`) était
 * « structurellement acceptable ». La liste ci-dessous est la seule autorité :
 * elle vit ici, dans le domaine partagé, pour que le pipeline d'import et la spec
 * regardent la même vérité.
 *
 * Métropole : 11 Île-de-France, 24 Centre-Val de Loire, 27 Bourgogne-Franche-Comté,
 * 28 Normandie, 32 Hauts-de-France, 44 Grand Est, 52 Pays de la Loire,
 * 53 Bretagne, 75 Nouvelle-Aquitaine, 76 Occitanie, 84 Auvergne-Rhône-Alpes,
 * 93 Provence-Alpes-Côte d'Azur, 94 Corse.
 * Outre-mer : 01 Guadeloupe, 02 Martinique, 03 Guyane, 04 La Réunion, 06 Mayotte.
 */
export const FRENCH_REGION_CODES = [
  '01',
  '02',
  '03',
  '04',
  '06',
  '11',
  '24',
  '27',
  '28',
  '32',
  '44',
  '52',
  '53',
  '75',
  '76',
  '84',
  '93',
  '94',
] as const;

export type FrenchRegionCode = (typeof FRENCH_REGION_CODES)[number];

const FRENCH_REGION_CODE_SET: ReadonlySet<string> = new Set(FRENCH_REGION_CODES);

/** Vrai si `code` est un code de région français officiel, à l'octet près. */
export function isFrenchRegionCode(code: string): code is FrenchRegionCode {
  return FRENCH_REGION_CODE_SET.has(code);
}
