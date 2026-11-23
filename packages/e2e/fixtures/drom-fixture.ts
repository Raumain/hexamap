/**
 * Fixture du banc E2E : un département d'outre-mer complet.
 *
 * Le référentiel du banc ne semait aucun DROM, donc L'Atlas n'avait aucun encart
 * à montrer. Ce script sème un groupe — une région, son département et deux
 * communes — autour de La Réunion, calcule le **cadre du groupe** et dérive les
 * quatre `path_d` avec la projection existante. Il ne calcule rien lui-même : il
 * appelle `viewBoxOfGeometries` et `geometryToPathD`, comme le backfill de
 * production (`scripts/import/src/atlas-overseas.ts`).
 *
 * Idempotent : les lignes `E2E-OM-*` sont supprimées avant d'être réinsérées, et
 * deux exécutions produisent la même géométrie, donc le même `path_d`.
 *
 * Il vit hors de `scripts/import` pour la même raison que `market-fixture.ts` :
 * c'est une fixture de banc, pas une étape d'import.
 */

import {
  type AtlasLevel,
  geometryToPathD,
  viewBoxOfGeometries,
} from '../../../scripts/import/src/atlas-projection';
import { createDb } from '../../db/src/index';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[e2e] DATABASE_URL manquant pour la fixture d’outre-mer');
  process.exit(1);
}

const db = createDb(databaseUrl);

const PREFIX = 'E2E-OM';
const REGION_CODE = `${PREFIX}-R1`;
const DEPARTEMENT_CODE = `${PREFIX}-D1`;

interface SeedPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

/** Quadrilatère déterministe, en GeoJSON `[lon, lat]`, autour de La Réunion. */
function overseasSquare(lon: number, lat: number, half: number): SeedPolygon {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lon - half, lat - half],
        [lon + half, lat - half],
        [lon + half, lat + half],
        [lon - half, lat + half],
        [lon - half, lat - half],
      ],
    ],
  };
}

const regionGeometry = overseasSquare(55.45, -20.88, 0.18);
const departementGeometry = overseasSquare(55.45, -20.88, 0.14);
const communeGeometries = [
  {
    code: `${PREFIX}-C1`,
    nom: 'Commune E2E Outre-mer Un',
    geometry: overseasSquare(55.38, -20.94, 0.03),
  },
  {
    code: `${PREFIX}-C2`,
    nom: 'Commune E2E Outre-mer Deux',
    geometry: overseasSquare(55.52, -20.82, 0.03),
  },
];

/**
 * Le cadre du **groupe**, calculé une seule fois sur l'ensemble des géométries :
 * c'est ce qui garantit que les communes s'assemblent au lieu de se superposer.
 */
const groupViewBox = viewBoxOfGeometries([
  regionGeometry,
  departementGeometry,
  ...communeGeometries.map((commune) => commune.geometry),
]);

if (groupViewBox === null) {
  console.error('[e2e] géométrie d’outre-mer non projetable');
  process.exit(1);
}

/** Le cadre, figé non nul : une fonction imbriquée ne voit pas le garde ci-dessus. */
const groupFrame: string = groupViewBox;

/** `path_d` dans le cadre du groupe, jamais dans celui de la métropole. */
function pathDOf(geometry: SeedPolygon, level: AtlasLevel): string {
  const pathD = geometryToPathD(geometry, level, groupFrame);

  if (pathD === null) {
    throw new Error(`[e2e] tracé d’outre-mer impossible (${level})`);
  }

  return pathD;
}

try {
  // Idempotent : le groupe repart de zéro à chaque exécution du banc.
  await db.deleteFrom('ref_communes').where('code_insee', 'like', `${PREFIX}-%`).execute();
  await db.deleteFrom('ref_departements').where('code', 'like', `${PREFIX}-%`).execute();
  await db.deleteFrom('ref_regions').where('code', 'like', `${PREFIX}-%`).execute();

  await db
    .insertInto('ref_regions')
    .values({
      code: REGION_CODE,
      nom: 'Région E2E Outre-mer',
      geom: regionGeometry,
      view_box: groupViewBox,
      path_d: pathDOf(regionGeometry, 'REGION'),
    })
    .execute();

  await db
    .insertInto('ref_departements')
    .values({
      code: DEPARTEMENT_CODE,
      nom: 'Département E2E Outre-mer',
      code_region: REGION_CODE,
      population: 900_000,
      geom: departementGeometry,
      view_box: groupViewBox,
      path_d: pathDOf(departementGeometry, 'DEPARTEMENT'),
    })
    .execute();

  await db
    .insertInto('ref_communes')
    .values(
      communeGeometries.map((commune) => ({
        code_insee: commune.code,
        nom: commune.nom,
        code_departement: DEPARTEMENT_CODE,
        code_region: REGION_CODE,
        population: 200_000,
        rarete: 'COMMUNE' as const,
        score_base: 2500,
        geom: commune.geometry,
        view_box: groupViewBox,
        path_d: pathDOf(commune.geometry, 'COMMUNE'),
      })),
    )
    .execute();

  console.log(
    `[e2e] Outre-mer prêt : cadre ${groupViewBox} · 1 région, 1 département, ${communeGeometries.length} communes.`,
  );
} finally {
  await db.destroy();
}
