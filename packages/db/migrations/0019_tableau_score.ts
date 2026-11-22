import { type Kysely, sql } from 'kysely';

/**
 * Le Palmarès — `tableaux.score`, figé à la soumission.
 *
 * La colonne naît **nullable**, sinon les lignes existantes recevraient le
 * défaut au lieu d'être rétro-remplies. Le remplissage recopie en SQL la
 * formule de `evaluateTableau` : `packages/db` ne dépend pas de `@hexamap/shared`
 * et aucune migration n'importe un paquet du monorepo. Les bornes et le défaut
 * `0` viennent ensuite — `0` sert aux six insertions directes de test qui ne
 * fournissent pas de score, aucun chemin de production ne l'écrit.
 *
 * Rejouable : `add column if not exists`, remplissage borné par `score is null`,
 * `set not null` et `set default` sont idempotents.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`alter table tableaux add column if not exists score integer`.execute(db);

  await sql`
    with computed as (
      select
        t.id,
        coalesce(r.score, 0) + coalesce(d.score, 0) + coalesce(c.score, 0) + coalesce(u.score, 0) as points,
        (case when rr.code = rd.code_region then 1 else 0 end)
        + (case when d.ref_code = cc.code_departement then 1 else 0 end)
        + (case when exists (
            select 1 from commune_odonymes co
            where co.code_insee = cc.code_insee and co.odonyme_id = od.id
          ) then 1 else 0 end) as links
      from tableaux t
      left join user_cards r on r.id = t.region_card_id
      left join user_cards d on d.id = t.departement_card_id
      left join user_cards c on c.id = t.commune_card_id
      left join user_cards u on u.id = t.rue_card_id
      left join ref_regions rr on rr.code = r.ref_code
      left join ref_departements rd on rd.code = d.ref_code
      left join ref_communes cc on cc.code_insee = c.ref_code
      left join ref_odonymes od on od.id::text = u.ref_code
    )
    update tableaux t
    set score = round(
      computed.points
      * (case computed.links when 1 then 1.5 when 2 then 2.5 when 3 then 5.0 else 1.0 end)
    )::integer
    from computed
    where t.id = computed.id and t.score is null
  `.execute(db);

  await sql`alter table tableaux alter column score set not null`.execute(db);
  await sql`alter table tableaux alter column score set default 0`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`alter table tableaux drop column if exists score`.execute(db);
}
