import type { CardCategory } from '@hexamap/db';
import type { Executor } from './draw';

/** Fiche détaillée d'une carte : tout ce que la page de détail affiche en plus de la carte. */
export interface CardDetail {
  population: number | null;
  nbCommunes: number | null;
  latitude: number | null;
  longitude: number | null;
  codeDepartement: string | null;
  nomDepartement: string | null;
  codeRegion: string | null;
  nomRegion: string | null;
}

export const EMPTY_CARD_DETAIL: CardDetail = {
  population: null,
  nbCommunes: null,
  latitude: null,
  longitude: null,
  codeDepartement: null,
  nomDepartement: null,
  codeRegion: null,
  nomRegion: null,
};

/**
 * Résout la fiche d'une carte depuis son référentiel. Ne lève jamais : une
 * référence absente rend une fiche vide (les colonnes sont nullables côté API).
 */
export async function resolveCardDetail(
  exec: Executor,
  category: CardCategory,
  refCode: string,
): Promise<CardDetail> {
  try {
    switch (category) {
      case 'REGION':
        // Une région n'a aucun parent géographique.
        return { ...EMPTY_CARD_DETAIL };
      case 'DEPARTEMENT': {
        const row = await exec
          .selectFrom('ref_departements')
          .select(['code', 'nom', 'population', 'code_region'])
          .where('code', '=', refCode)
          .executeTakeFirst();
        if (!row) {
          return { ...EMPTY_CARD_DETAIL };
        }
        const region = await exec
          .selectFrom('ref_regions')
          .select(['nom'])
          .where('code', '=', row.code_region)
          .executeTakeFirst();
        return {
          ...EMPTY_CARD_DETAIL,
          population: row.population,
          codeDepartement: row.code,
          nomDepartement: row.nom,
          codeRegion: row.code_region,
          nomRegion: region?.nom ?? null,
        };
      }
      case 'COMMUNE': {
        const row = await exec
          .selectFrom('ref_communes')
          .select(['population', 'latitude', 'longitude', 'code_departement', 'code_region'])
          .where('code_insee', '=', refCode)
          .executeTakeFirst();
        if (!row) {
          return { ...EMPTY_CARD_DETAIL };
        }
        const [departement, region] = await Promise.all([
          exec
            .selectFrom('ref_departements')
            .select(['nom'])
            .where('code', '=', row.code_departement)
            .executeTakeFirst(),
          exec
            .selectFrom('ref_regions')
            .select(['nom'])
            .where('code', '=', row.code_region)
            .executeTakeFirst(),
        ]);
        return {
          ...EMPTY_CARD_DETAIL,
          population: row.population,
          latitude: row.latitude,
          longitude: row.longitude,
          codeDepartement: row.code_departement,
          nomDepartement: departement?.nom ?? null,
          codeRegion: row.code_region,
          nomRegion: region?.nom ?? null,
        };
      }
      case 'RUE': {
        const row = await exec
          .selectFrom('ref_odonymes')
          .select(['nb_communes'])
          .where('id', '=', refCode)
          .executeTakeFirst();
        if (!row) {
          return { ...EMPTY_CARD_DETAIL };
        }
        return { ...EMPTY_CARD_DETAIL, nbCommunes: row.nb_communes };
      }
    }
  } catch {
    return { ...EMPTY_CARD_DETAIL };
  }
}
