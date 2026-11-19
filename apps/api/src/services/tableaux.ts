import type { CardCategory, Rarity } from '@hexamap/db';
import {
  type CommuneOdonymeRef,
  evaluateTableau,
  rueExistsInCommune,
  type TableauGeography,
} from '@hexamap/shared';
import type { Executor } from './draw';

export type CardRow = {
  id: string;
  category: CardCategory;
  ref_code: string;
  score: number;
  rarity: Rarity;
  locked: boolean;
};

export type SelectedCards = {
  region: CardRow | null;
  departement: CardRow | null;
  commune: CardRow | null;
  rue: CardRow | null;
};

/** Lignes de référence déjà résolues, nécessaires à la construction d'une
 *  géographie. `null` quand la ligne manque en base. */
export interface GeographyReferenceRows {
  region: { code: string } | null;
  departement: { code: string; code_region: string | null } | null;
  commune: { code_insee: string; code_departement: string | null } | null;
  odonymes: ReadonlyArray<CommuneOdonymeRef>;
}

/** Construit la géographie d'une sélection (partielle ou complète) à partir des
 *  lignes de référence déjà résolues. Pur : aucune requête, ne lève jamais.
 *  Repli sur `ref_code` quand la ligne de référence manque ; lien invalide. */
export function buildTableauGeography(
  cards: SelectedCards,
  refs: GeographyReferenceRows,
): TableauGeography {
  const regionCode = cards.region ? (refs.region?.code ?? cards.region.ref_code) : null;

  const departementCode = cards.departement
    ? (refs.departement?.code ?? cards.departement.ref_code)
    : null;
  const departementRegionCode = cards.departement ? (refs.departement?.code_region ?? null) : null;

  const communeInsee = cards.commune ? (refs.commune?.code_insee ?? cards.commune.ref_code) : null;
  const communeDepartementCode = cards.commune ? (refs.commune?.code_departement ?? null) : null;

  const rueOdonymeId = cards.rue ? cards.rue.ref_code : null;
  const rueInCommune = rueExistsInCommune(refs.odonymes, communeInsee, rueOdonymeId);

  return {
    regionCode,
    departementCode,
    departementRegionCode,
    communeInsee,
    communeDepartementCode,
    rueOdonymeId,
    rueInCommune,
  };
}

/** Résout la géographie d'une sélection (partielle ou complète) sans jamais
 *  lever si une donnée de référence est absente : champ null, lien invalide. */
export async function resolveGeography(
  exec: Executor,
  cards: SelectedCards,
): Promise<TableauGeography> {
  const region = cards.region
    ? await exec
        .selectFrom('ref_regions')
        .select('code')
        .where('code', '=', cards.region.ref_code)
        .executeTakeFirst()
    : null;

  const departement = cards.departement
    ? await exec
        .selectFrom('ref_departements')
        .select(['code', 'code_region'])
        .where('code', '=', cards.departement.ref_code)
        .executeTakeFirst()
    : null;

  const commune = cards.commune
    ? await exec
        .selectFrom('ref_communes')
        .select(['code_insee', 'code_departement'])
        .where('code_insee', '=', cards.commune.ref_code)
        .executeTakeFirst()
    : null;

  const communeInsee = commune?.code_insee ?? cards.commune?.ref_code ?? null;
  const odonymes: CommuneOdonymeRef[] =
    cards.rue && communeInsee !== null
      ? (
          await exec
            .selectFrom('commune_odonymes')
            .select(['code_insee', 'odonyme_id'])
            .where('code_insee', '=', communeInsee)
            .where('odonyme_id', '=', cards.rue.ref_code)
            .execute()
        ).map((row) => ({ codeInsee: row.code_insee, odonymeId: row.odonyme_id }))
      : [];

  return buildTableauGeography(cards, {
    region: region ?? null,
    departement: departement ?? null,
    commune: commune ?? null,
    odonymes,
  });
}

/** Évaluation d'un tableau, réduite à ce que les médailles consomment. */
export interface TableauScore {
  multiplier: number;
  total: number;
}

/**
 * Recalcule les scores des tableaux d'un joueur avec la même évaluation que la
 * salle de La Planche. Les référentiels sont résolus en quatre requêtes, puis
 * indexés en `Map` : aucun aller-retour par tableau.
 */
export async function loadTableauScores(exec: Executor, userId: string): Promise<TableauScore[]> {
  const tableaux = await exec
    .selectFrom('tableaux')
    .select(['id', 'region_card_id', 'departement_card_id', 'commune_card_id', 'rue_card_id'])
    .where('user_id', '=', userId)
    .execute();

  if (tableaux.length === 0) {
    return [];
  }

  const cardIds = tableaux
    .flatMap((tableau) => [
      tableau.region_card_id,
      tableau.departement_card_id,
      tableau.commune_card_id,
      tableau.rue_card_id,
    ])
    .filter((id): id is string => id !== null);

  const cardRows: CardRow[] =
    cardIds.length === 0
      ? []
      : await exec
          .selectFrom('user_cards')
          .select(['id', 'category', 'ref_code', 'score', 'rarity', 'locked'])
          .where('id', 'in', cardIds)
          .where('user_id', '=', userId)
          .execute();
  const cardsById = new Map(cardRows.map((row) => [row.id, row]));

  const regionCodes = cardRows
    .filter((row) => row.category === 'REGION')
    .map((row) => row.ref_code);
  const departementCodes = cardRows
    .filter((row) => row.category === 'DEPARTEMENT')
    .map((row) => row.ref_code);
  const communeCodes = cardRows
    .filter((row) => row.category === 'COMMUNE')
    .map((row) => row.ref_code);
  const rueCodes = cardRows.filter((row) => row.category === 'RUE').map((row) => row.ref_code);

  const [regionRefs, departementRefs, communeRefs, odonymeRefs] = await Promise.all([
    regionCodes.length === 0
      ? Promise.resolve([] as { code: string }[])
      : exec.selectFrom('ref_regions').select('code').where('code', 'in', regionCodes).execute(),
    departementCodes.length === 0
      ? Promise.resolve([] as { code: string; code_region: string | null }[])
      : exec
          .selectFrom('ref_departements')
          .select(['code', 'code_region'])
          .where('code', 'in', departementCodes)
          .execute(),
    communeCodes.length === 0
      ? Promise.resolve([] as { code_insee: string; code_departement: string | null }[])
      : exec
          .selectFrom('ref_communes')
          .select(['code_insee', 'code_departement'])
          .where('code_insee', 'in', communeCodes)
          .execute(),
    communeCodes.length === 0 || rueCodes.length === 0
      ? Promise.resolve([] as { code_insee: string; odonyme_id: string }[])
      : exec
          .selectFrom('commune_odonymes')
          .select(['code_insee', 'odonyme_id'])
          .where('code_insee', 'in', communeCodes)
          .where('odonyme_id', 'in', rueCodes)
          .execute(),
  ]);

  const regionByCode = new Map(regionRefs.map((row) => [row.code, row]));
  const departementByCode = new Map(departementRefs.map((row) => [row.code, row]));
  const communeByInsee = new Map(communeRefs.map((row) => [row.code_insee, row]));
  const odonymeByCommune = new Map<string, CommuneOdonymeRef[]>();
  for (const row of odonymeRefs) {
    const list = odonymeByCommune.get(row.code_insee) ?? [];
    list.push({ codeInsee: row.code_insee, odonymeId: row.odonyme_id });
    odonymeByCommune.set(row.code_insee, list);
  }

  return tableaux.map((tableau) => {
    const cards: SelectedCards = {
      region: tableau.region_card_id ? (cardsById.get(tableau.region_card_id) ?? null) : null,
      departement: tableau.departement_card_id
        ? (cardsById.get(tableau.departement_card_id) ?? null)
        : null,
      commune: tableau.commune_card_id ? (cardsById.get(tableau.commune_card_id) ?? null) : null,
      rue: tableau.rue_card_id ? (cardsById.get(tableau.rue_card_id) ?? null) : null,
    };

    const geography = buildTableauGeography(cards, {
      region: cards.region ? (regionByCode.get(cards.region.ref_code) ?? null) : null,
      departement: cards.departement
        ? (departementByCode.get(cards.departement.ref_code) ?? null)
        : null,
      commune: cards.commune ? (communeByInsee.get(cards.commune.ref_code) ?? null) : null,
      odonymes: cards.commune ? (odonymeByCommune.get(cards.commune.ref_code) ?? []) : [],
    });

    const scores = {
      region: cards.region?.score ?? 0,
      departement: cards.departement?.score ?? 0,
      commune: cards.commune?.score ?? 0,
      rue: cards.rue?.score ?? 0,
    };
    const evaluation = evaluateTableau(scores, geography);

    return { multiplier: evaluation.alignment.multiplier, total: evaluation.total };
  });
}
