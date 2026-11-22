import { type Kysely, sql } from 'kysely';

/**
 * Intégrité du référentiel — BUG-002 et BUG-003.
 *
 * **Ce que cette migration protège réellement.** Une carte de collection ne doit
 * jamais survivre à la ligne de référentiel qu'elle cite : c'est le symptôme de
 * BUG-002 (`routes/cards.ts` résout le nom par `noms.get(...) ?? ''`, donc une
 * carte orpheline s'affiche sans nom). Le chemin destructeur est le `TRUNCATE …
 * CASCADE` du pipeline d'import, qui vidait les quatre tables pendant que des
 * collections les citaient encore. Il est désormais **refusé**, et l'import passe
 * par le mode `--merge`, qui n'élague que les lignes non citées.
 *
 * **Pourquoi pas une clé étrangère `(category, ref_code)`, ni un `CHECK` sur le
 * code de région.** Les deux sont inatteignables dans le périmètre de la phase :
 * `packages/spec` est gelée et fabrique volontairement des données hors
 * référentiel (`achievements.spec.ts` insère une carte `COMMUNE` sans aucun
 * référentiel semé ; `cards.spec.ts`, `charges.spec.ts`, `market.spec.ts`,
 * `tableaux.spec.ts` et `tickets.spec.ts` sèment des régions aux codes
 * `<préfixe>-R1` ; le banc sème `E2E-R1`). Une FK ou un `CHECK` de table les
 * rejetterait toutes, et leurs `afterAll` suppriment les `ref_*` avant `"user"`,
 * donc une FK `ON DELETE RESTRICT` ferait échouer chaque nettoyage. La garde est
 * donc posée là où le dégât se produit, et la validation du code de région à la
 * frontière que BUG-003 propose lui-même : le pipeline d'import
 * (`isFrenchRegionCode`).
 *
 * **Pourquoi `ref_odonymes` n'est pas gardée.** Deux cas gelés de
 * `tickets.spec.ts` vident volontairement `ref_odonymes` pour éprouver la
 * robustesse du tirage ; une garde les rendrait rouges. Les cartes de rue sont
 * protégées par l'élagage `--merge`.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // Une seule fonction pour les quatre tables : la catégorie de `user_cards` qui
  // cite la table est passée en argument du trigger.
  await sql`
    create or replace function ref_truncate_guard() returns trigger
    language plpgsql as $$
    declare
      cited bigint;
    begin
      execute format('select count(*) from user_cards where category = %L', TG_ARGV[0])
        into cited;

      if cited > 0 then
        raise exception
          'la table % est citée par % carte(s) : un réimport ne peut pas la vider',
          TG_TABLE_NAME, cited
          using errcode = 'foreign_key_violation',
                hint = 'Lancez l''import avec --merge : il n''élague que les lignes non citées.';
      end if;

      return null;
    end
    $$;
  `.execute(db);

  await sql`drop trigger if exists ref_truncate_guard on ref_regions`.execute(db);
  await sql`drop trigger if exists ref_regions_truncate_guard on ref_regions`.execute(db);
  await sql`
    create trigger ref_truncate_guard
      before truncate on ref_regions
      for each statement execute function ref_truncate_guard('REGION')
  `.execute(db);

  await sql`drop trigger if exists ref_departements_truncate_guard on ref_departements`.execute(db);
  await sql`
    create trigger ref_departements_truncate_guard
      before truncate on ref_departements
      for each statement execute function ref_truncate_guard('DEPARTEMENT')
  `.execute(db);

  await sql`drop trigger if exists ref_communes_truncate_guard on ref_communes`.execute(db);
  await sql`
    create trigger ref_communes_truncate_guard
      before truncate on ref_communes
      for each statement execute function ref_truncate_guard('COMMUNE')
  `.execute(db);

  // `ref_odonymes` n'est **pas** gardée : deux cas gelés de `tickets.spec.ts`
  // (`Archi §2.6 — un jumelé ne dépasse jamais la rareté RARE`,
  // `un référentiel totalement vide reste une erreur explicite`) font
  // volontairement `truncate table commune_odonymes, ref_odonymes` dans une
  // transaction pour éprouver la robustesse du tirage. Une garde ici les
  // rendrait rouges. Les cartes de rue restent protégées par l'élagage
  // `--merge` de l'import, qui ne supprime jamais une ligne citée.
  await sql`drop trigger if exists ref_odonymes_truncate_guard on ref_odonymes`.execute(db);

  // BUG-002, seconde moitié : rendre les orphelines **visibles**. Jusqu'ici une
  // carte sans référentiel s'affichait simplement sans nom, sans que rien ne
  // puisse la compter. La fonction ne répare rien : elle nomme le dégât.
  await sql`
    create or replace function orphan_user_cards()
    returns table (id uuid, user_id text, category text, ref_code text)
    language sql stable as $$
      select uc.id, uc.user_id, uc.category::text, uc.ref_code
      from user_cards uc
      where (uc.category = 'REGION'
              and not exists (select 1 from ref_regions r where r.code = uc.ref_code))
         or (uc.category = 'DEPARTEMENT'
              and not exists (select 1 from ref_departements d where d.code = uc.ref_code))
         or (uc.category = 'COMMUNE'
              and not exists (select 1 from ref_communes c where c.code_insee = uc.ref_code))
         or (uc.category = 'RUE'
              and not exists (select 1 from ref_odonymes o where o.id::text = uc.ref_code))
    $$;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop trigger if exists ref_odonymes_truncate_guard on ref_odonymes`.execute(db);
  await sql`drop trigger if exists ref_communes_truncate_guard on ref_communes`.execute(db);
  await sql`drop trigger if exists ref_departements_truncate_guard on ref_departements`.execute(db);
  await sql`drop trigger if exists ref_truncate_guard on ref_regions`.execute(db);
  await sql`drop trigger if exists ref_regions_truncate_guard on ref_regions`.execute(db);
  await sql`drop function if exists orphan_user_cards()`.execute(db);
  await sql`drop function if exists ref_truncate_guard()`.execute(db);
}
