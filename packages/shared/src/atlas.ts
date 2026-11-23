/**
 * Contrat de lecture de l'atlas (salle L'Atlas).
 *
 * Module pur : aucune dépendance, aucun accès à `process.env`, aucun accès
 * réseau. Le `viewBox` est une chaîne SVG, partagée par l'API et la salle pour
 * qu'aucun des deux ne redéclare la projection décrite par `.docs/02-database.md`
 * §5.
 */
export const ATLAS_VIEWBOX = '0 0 1000 1000';

export interface AtlasSummaryRegion {
  code: string;
  nom: string;
  pathD: string | null;
  viewBox: string;
  hasRegionCard: boolean;
  communesOwned: number;
  communesTotal: number;
}

export interface AtlasSummaryDepartement {
  code: string;
  nom: string;
  codeRegion: string;
  pathD: string | null;
  viewBox: string;
  hasDepartementCard: boolean;
  communesOwned: number;
  communesTotal: number;
}

export interface AtlasSummary {
  viewBox: string;
  regions: AtlasSummaryRegion[];
  departements: AtlasSummaryDepartement[];
}

export interface AtlasCommune {
  codeInsee: string;
  nom: string;
  pathD: string | null;
  viewBox: string;
  ownedCards: number;
  hasCommuneCard: boolean;
}

export interface AtlasDepartementDetail {
  viewBox: string;
  code: string;
  nom: string;
  communesOwned: number;
  communesTotal: number;
  communes: AtlasCommune[];
}
