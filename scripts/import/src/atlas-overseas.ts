/**
 * Cadres d'outre-mer — le seul écrivain de `ref_*.view_box` pour les DROM.
 *
 * Un groupe est une région dont la géométrie, classée contre le cadre
 * métropolitain, est `out_of_viewbox` : aucune liste de codes `971`/`974` à
 * maintenir, la règle reste géométrique. Le cadre du groupe est calculé sur la
 * bbox de l'ensemble région + départements + communes, puis recopié à
 * l'identique sur toutes ses lignes ; `path_d` est dérivé dans ce cadre avec la
 * projection existante.
 *
 * **Borné aux groupes d'outre-mer** : aucune ligne métropolitaine n'est lue
 * pour être écrite, aucun `path_d` métropolitain n'est recalculé. Un second
 * passage ne réécrit aucun tracé.
 */

import type { Database } from '@hexamap/db';
import { type Kysely, sql } from 'kysely';
import { readGeometry } from './atlas';
import {
  ATLAS_METROPOLE_VIEW_BOX,
  type AtlasLevel,
  classifyGeometry,
  geometryToPathD,
  viewBoxOfGeometries,
} from './atlas-projection';

export interface OverseasGroupReport {
  regionCode: string;
  regionNom: string;
  viewBox: string;
  departements: number;
  communes: number;
  rows: number;
  pathWritten: number;
  alreadySet: number;
  framesWritten: number;
}

export interface OverseasReport {
  groups: OverseasGroupReport[];
  rows: number;
  pathWritten: number;
  alreadySet: number;
  framesWritten: number;
  missingGeom: number;
  invalidGeom: number;
}

/** Taille d'un lot d'écriture de `path_d` : la même que `atlas.ts`. */
const WRITE_BATCH_SIZE = 500;

interface PathUpdate {
  readonly code: string;
  readonly path_d: string;
}

interface PathPlan {
  readonly updates: PathUpdate[];
  readonly pathWritten: number;
  readonly alreadySet: number;
  readonly missingGeom: number;
  readonly invalidGeom: number;
}

interface PathRow {
  readonly code: string;
  readonly geom: unknown;
  readonly path_d: string | null;
}

function planPaths(
  rows: readonly PathRow[],
  level: AtlasLevel,
  viewBox: string,
  force: boolean,
): PathPlan {
  const updates: PathUpdate[] = [];
  let pathWritten = 0;
  let alreadySet = 0;
  let missingGeom = 0;
  let invalidGeom = 0;

  for (const row of rows) {
    if (row.path_d !== null && row.path_d.length > 0 && !force) {
      alreadySet += 1;
      continue;
    }

    if (row.geom === null) {
      missingGeom += 1;
      continue;
    }

    const pathD = geometryToPathD(readGeometry(row.geom), level, viewBox);
    if (pathD === null || pathD.length === 0) {
      invalidGeom += 1;
      continue;
    }

    updates.push({ code: row.code, path_d: pathD });
    pathWritten += 1;
  }

  return { updates, pathWritten, alreadySet, missingGeom, invalidGeom };
}

async function writePaths(
  database: Kysely<Database>,
  table: 'ref_regions' | 'ref_departements' | 'ref_communes',
  codeColumn: 'code' | 'code_insee',
  updates: readonly PathUpdate[],
): Promise<void> {
  for (let start = 0; start < updates.length; start += WRITE_BATCH_SIZE) {
    const chunk = updates.slice(start, start + WRITE_BATCH_SIZE);
    if (chunk.length === 0) {
      continue;
    }

    const values = sql.join(
      chunk.map((update) => sql`(${update.code}, ${update.path_d})`),
      sql`, `,
    );

    await sql`
      update ${sql.id(table)} as t
      set path_d = v.path_d
      from (values ${values}) as v(code, path_d)
      where ${sql.id('t', codeColumn)} = v.code
    `.execute(database);
  }
}

/**
 * Calcule le cadre de chaque groupe d'outre-mer et dérive son `path_d`.
 * Idempotent : un second passage rend `pathWritten === 0` et laisse les tracés
 * identiques à l'octet.
 */
export async function backfillOverseasFrames(
  database: Kysely<Database>,
  options: { force?: boolean } = {},
): Promise<OverseasReport> {
  const force = options.force === true;
  const report: OverseasReport = {
    groups: [],
    rows: 0,
    pathWritten: 0,
    alreadySet: 0,
    framesWritten: 0,
    missingGeom: 0,
    invalidGeom: 0,
  };

  const regions = await database
    .selectFrom('ref_regions')
    .select(['code', 'nom', 'geom', 'path_d'])
    .where('geom', 'is not', null)
    .orderBy('code')
    .execute();

  for (const region of regions) {
    const verdict = classifyGeometry(readGeometry(region.geom), 'REGION', ATLAS_METROPOLE_VIEW_BOX);

    if (verdict === 'invalid') {
      report.invalidGeom += 1;
      continue;
    }

    if (verdict !== 'out_of_viewbox') {
      continue;
    }

    const departements = await database
      .selectFrom('ref_departements')
      .select(['code', 'geom', 'path_d'])
      .where('code_region', '=', region.code)
      .orderBy('code')
      .execute();

    const departementCodes = departements.map((departement) => departement.code);

    const communes =
      departementCodes.length === 0
        ? []
        : await database
            .selectFrom('ref_communes')
            .select(['code_insee', 'geom', 'path_d'])
            .where('code_departement', 'in', departementCodes)
            .orderBy('code_insee')
            .execute();

    const viewBox = viewBoxOfGeometries([
      region.geom,
      ...departements.map((departement) => departement.geom),
      ...communes.map((commune) => commune.geom),
    ]);

    if (viewBox === null) {
      report.invalidGeom += 1;
      continue;
    }

    const group: OverseasGroupReport = {
      regionCode: region.code,
      regionNom: region.nom,
      viewBox,
      departements: departements.length,
      communes: communes.length,
      rows: 1 + departements.length + communes.length,
      pathWritten: 0,
      alreadySet: 0,
      framesWritten: 0,
    };

    group.framesWritten += await writeFrame(
      database,
      'ref_regions',
      'code',
      [region.code],
      viewBox,
    );

    if (departementCodes.length > 0) {
      group.framesWritten += await writeFrame(
        database,
        'ref_departements',
        'code',
        departementCodes,
        viewBox,
      );
    }

    if (communes.length > 0) {
      group.framesWritten += await writeFrame(
        database,
        'ref_communes',
        'code_insee',
        communes.map((commune) => commune.code_insee),
        viewBox,
      );
    }

    const regionPlan = planPaths(
      [{ code: region.code, geom: region.geom, path_d: region.path_d }],
      'REGION',
      viewBox,
      force,
    );
    const departementPlan = planPaths(
      departements.map((departement) => ({
        code: departement.code,
        geom: departement.geom,
        path_d: departement.path_d,
      })),
      'DEPARTEMENT',
      viewBox,
      force,
    );
    const communePlan = planPaths(
      communes.map((commune) => ({
        code: commune.code_insee,
        geom: commune.geom,
        path_d: commune.path_d,
      })),
      'COMMUNE',
      viewBox,
      force,
    );

    await writePaths(database, 'ref_regions', 'code', regionPlan.updates);
    await writePaths(database, 'ref_departements', 'code', departementPlan.updates);
    await writePaths(database, 'ref_communes', 'code_insee', communePlan.updates);

    group.pathWritten =
      regionPlan.pathWritten + departementPlan.pathWritten + communePlan.pathWritten;
    group.alreadySet = regionPlan.alreadySet + departementPlan.alreadySet + communePlan.alreadySet;

    report.groups.push(group);
    report.rows += group.rows;
    report.pathWritten += group.pathWritten;
    report.alreadySet += group.alreadySet;
    report.framesWritten += group.framesWritten;
    report.missingGeom +=
      regionPlan.missingGeom + departementPlan.missingGeom + communePlan.missingGeom;
    report.invalidGeom +=
      regionPlan.invalidGeom + departementPlan.invalidGeom + communePlan.invalidGeom;
  }

  return report;
}

/** Met à jour le cadre d'un lot de lignes ; rend le nombre de lignes réécrites. */
async function writeFrame(
  database: Kysely<Database>,
  table: 'ref_regions' | 'ref_departements' | 'ref_communes',
  codeColumn: 'code' | 'code_insee',
  codes: readonly string[],
  viewBox: string,
): Promise<number> {
  if (codes.length === 0) {
    return 0;
  }

  const result = await database
    .updateTable(table)
    .set({ view_box: viewBox })
    .where(codeColumn, 'in', codes)
    .where(sql<boolean>`view_box is distinct from ${viewBox}`)
    .executeTakeFirst();

  return Number(result.numUpdatedRows ?? 0);
}
