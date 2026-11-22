import { type Database, sql } from '@hexamap/db';
import {
  ATLAS_VIEWBOX,
  type AtlasDepartementDetail,
  type AtlasSummary,
  type AtlasSummaryDepartement,
  type AtlasSummaryRegion,
} from '@hexamap/shared';
import type { Kysely } from 'kysely';

/**
 * Agrégats de l'atlas.
 *
 * Chaque fonction émet **une seule** instruction : deux CTE pour le résumé, un
 * `json_build_object` pour la charge. Le `viewBox` est ajouté en TypeScript, et
 * chaque CTE qui lit `user_cards` porte son filtre `user_id` — sans lui, un
 * voisin lirait les cartes d'autrui.
 */

type SummaryPayload = {
  regions: AtlasSummaryRegion[];
  departements: AtlasSummaryDepartement[];
};

type DepartementPayload = Omit<AtlasDepartementDetail, 'viewBox'>;

export async function loadAtlasSummary(
  database: Kysely<Database>,
  userId: string,
): Promise<AtlasSummary> {
  const result = await database
    .selectNoFrom([
      sql<SummaryPayload>`(
        with region_owned as (
          select c.code_region as code, count(distinct uc.ref_code)::int as communes_owned
          from user_cards uc
          join ref_communes c on c.code_insee = uc.ref_code
          where uc.user_id = ${userId} and uc.category = 'COMMUNE'
          group by c.code_region
        ),
        region_totals as (
          select code_region as code, count(*)::int as communes_total
          from ref_communes
          group by code_region
        ),
        region_cards as (
          select distinct ref_code as code
          from user_cards
          where user_id = ${userId} and category = 'REGION'
        ),
        departement_owned as (
          select c.code_departement as code, count(distinct uc.ref_code)::int as communes_owned
          from user_cards uc
          join ref_communes c on c.code_insee = uc.ref_code
          where uc.user_id = ${userId} and uc.category = 'COMMUNE'
          group by c.code_departement
        ),
        departement_totals as (
          select code_departement as code, count(*)::int as communes_total
          from ref_communes
          group by code_departement
        ),
        departement_cards as (
          select distinct ref_code as code
          from user_cards
          where user_id = ${userId} and category = 'DEPARTEMENT'
        )
        select json_build_object(
          'regions', coalesce((
            select json_agg(json_build_object(
              'code', r.code,
              'nom', r.nom,
              'pathD', r.path_d,
              'hasRegionCard', rc.code is not null,
              'communesOwned', coalesce(ro.communes_owned, 0),
              'communesTotal', coalesce(rt.communes_total, 0)
            ) order by r.code)
            from ref_regions r
            left join region_owned ro on ro.code = r.code
            left join region_totals rt on rt.code = r.code
            left join region_cards rc on rc.code = r.code
          ), '[]'::json),
          'departements', coalesce((
            select json_agg(json_build_object(
              'code', d.code,
              'nom', d.nom,
              'codeRegion', d.code_region,
              'pathD', d.path_d,
              'hasDepartementCard', dc.code is not null,
              'communesOwned', coalesce(dop.communes_owned, 0),
              'communesTotal', coalesce(dt.communes_total, 0)
            ) order by d.code)
            from ref_departements d
            left join departement_owned dop on dop.code = d.code
            left join departement_totals dt on dt.code = d.code
            left join departement_cards dc on dc.code = d.code
          ), '[]'::json)
        )
      )`.as('payload'),
    ])
    .executeTakeFirstOrThrow();
  return {
    viewBox: ATLAS_VIEWBOX,
    regions: result.payload.regions,
    departements: result.payload.departements,
  };
}

export async function loadAtlasDepartement(
  database: Kysely<Database>,
  code: string,
  userId: string,
): Promise<AtlasDepartementDetail | null> {
  const result = await database
    .selectNoFrom([
      sql<DepartementPayload | null>`(
        with owned as (
          select ref_code as code_insee, count(*)::int as owned_cards
          from user_cards
          where user_id = ${userId} and category = 'COMMUNE'
          group by ref_code
        )
        select json_build_object(
          'code', d.code,
          'nom', d.nom,
          'communesOwned', (
            select count(*)::int
            from owned o
            join ref_communes c on c.code_insee = o.code_insee
            where c.code_departement = d.code
          ),
          'communesTotal', (
            select count(*)::int
            from ref_communes c
            where c.code_departement = d.code
          ),
          'communes', coalesce((
            select json_agg(json_build_object(
              'codeInsee', c.code_insee,
              'nom', c.nom,
              'pathD', c.path_d,
              'ownedCards', coalesce(o.owned_cards, 0),
              'hasCommuneCard', coalesce(o.owned_cards, 0) > 0
            ) order by c.nom, c.code_insee)
            from ref_communes c
            left join owned o on o.code_insee = c.code_insee
            where c.code_departement = d.code
          ), '[]'::json)
        ) as payload
        from ref_departements d
        where d.code = ${code} and d.path_d is not null
      )`.as('payload'),
    ])
    .executeTakeFirst();

  if (!result) return null;

  const payload = result.payload;
  // La sous-requête rend une ligne nulle quand le code est inconnu ou hors carte.
  if (!payload) return null;

  return { viewBox: ATLAS_VIEWBOX, ...payload };
}
