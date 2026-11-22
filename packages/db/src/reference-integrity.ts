import { type Kysely, sql } from 'kysely';
import type { Database } from './schema';

/**
 * Élagage sûr du référentiel (BUG-002).
 *
 * L'import reconstruisait son référentiel par `TRUNCATE … RESTART IDENTITY
 * CASCADE`. C'était le chemin destructeur : une carte déjà possédée perdait sa
 * ligne de référence et s'affichait sans nom. Le mode `--merge` de l'import
 * remplace cette remise à zéro par un upsert suivi de cet élagage, qui **ne
 * supprime jamais une ligne citée** par `user_cards`.
 *
 * La garde `TRUNCATE` de la migration `0014_ref_integrity` reste la ceinture :
 * même un opérateur qui lancerait le `TRUNCATE` à la main est arrêté.
 */
export type ReferenceScope = 'REGION' | 'DEPARTEMENT' | 'COMMUNE' | 'RUE';

interface ReferenceSpec {
  readonly table: string;
  /** Clé naturelle : celle que l'import connaît et compare à `keep`. */
  readonly keepKey: string;
  /** Clé que `user_cards.ref_code` cite. */
  readonly citeKey: string;
  /** Les deux clés sont numériques côté SQL (`ref_odonymes.id`), texte côté `ref_code`. */
  readonly castToText: boolean;
}

const REFERENCE_SPECS: Record<ReferenceScope, ReferenceSpec> = {
  REGION: { table: 'ref_regions', keepKey: 'code', citeKey: 'code', castToText: false },
  DEPARTEMENT: {
    table: 'ref_departements',
    keepKey: 'code',
    citeKey: 'code',
    castToText: false,
  },
  COMMUNE: {
    table: 'ref_communes',
    keepKey: 'code_insee',
    citeKey: 'code_insee',
    castToText: false,
  },
  RUE: {
    table: 'ref_odonymes',
    keepKey: 'nom_normalise',
    citeKey: 'id',
    castToText: true,
  },
};

export interface PruneResult {
  /** Lignes réellement supprimées : celles qu'aucune carte ne citait. */
  deleted: number;
  /** Lignes conservées **parce qu'une carte les cite**, alors qu'elles sont périmées. */
  preserved: number;
}

function column(name: string, castToText: boolean) {
  return castToText ? sql`${sql.id(name)}::text` : sql.id(name);
}

/**
 * Supprime les lignes de `scope` dont la clé naturelle n'appartient pas à `keep`,
 * sauf celles qu'une carte possédée cite encore.
 *
 * `keep` est la liste des clés vues pendant l'import courant ; une clé absente
 * est une ligne qui a disparu du référentiel source.
 */
export async function pruneUnreferencedReferenceRows(
  db: Kysely<Database>,
  scope: ReferenceScope,
  keep: readonly string[],
): Promise<PruneResult> {
  const spec = REFERENCE_SPECS[scope];
  const keepKey = column(spec.keepKey, spec.castToText);
  const citeKey = column(spec.citeKey, spec.castToText);
  const kept = [...keep];

  const stale = await sql<{ total: string }>`
    select count(*)::text as total
    from ${sql.id(spec.table)} as t
    where not (${keepKey} = any(${kept}::text[]))
  `.execute(db);

  const removed = await sql<{ deleted: string }>`
    with removed as (
      delete from ${sql.id(spec.table)} as t
      where not (${keepKey} = any(${kept}::text[]))
        and not exists (
          select 1
          from user_cards uc
          where uc.category = ${scope}
            and uc.ref_code = ${citeKey}
        )
      returning 1
    )
    select count(*)::text as deleted from removed
  `.execute(db);

  const deleted = Number(removed.rows[0]?.deleted ?? 0);
  const preserved = Number(stale.rows[0]?.total ?? 0) - deleted;

  return { deleted, preserved };
}

export interface OrphanCard {
  id: string;
  user_id: string;
  category: ReferenceScope;
  ref_code: string;
}

/**
 * Cartes dont le `ref_code` ne correspond à aucune ligne de sa catégorie.
 *
 * La fonction SQL est livrée par `0014_ref_integrity` : elle rend visible ce que
 * `routes/cards.ts` affichait silencieusement sans nom.
 */
export async function orphanUserCards(db: Kysely<Database>): Promise<OrphanCard[]> {
  const result = await sql<OrphanCard>`select * from orphan_user_cards()`.execute(db);
  return result.rows;
}
