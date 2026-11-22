import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createDb, runMigrations, sql } from '@hexamap/db';
import { computeAtlasPaths } from '@hexamap/import/src/atlas';
import {
  ATLAS_COMMUNE_MAX_POINTS,
  ATLAS_METROPOLE_BOUNDS,
  ATLAS_VIEWBOX,
  type AtlasLevel,
  classifyGeometry,
  geometryToPathD,
  pathPointCount,
  projectLonLat,
} from '@hexamap/import/src/atlas-projection';

/**
 * Atlas §33 — la projection partagée.
 *
 * Ces cas ne touchent aucune base : ils verrouillent le module pur de
 * `scripts/import/src/atlas-projection.ts`, celui qui décide du `path_d` de
 * chaque entité au moment de l'import. Les cas d'intégration (lecture de `geom`,
 * écriture de `path_d`) vivent dans le second `describe` de ce fichier.
 */

interface PolygonGeometry {
  type: 'Polygon';
  coordinates: number[][][];
}

/** Un carré géodésique fermé autour d'un point, en degrés. */
function square(lon: number, lat: number, half: number): PolygonGeometry {
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

/**
 * Un carré dont un côté porte un léger renflement. L'écart du renflement vaut
 * ≈ 0,4 unité de `viewBox` : au-dessus de l'epsilon communal (0,2), en dessous
 * du régional (0,6). C'est la géométrie qui distingue réellement les niveaux —
 * un carré nu est rendu à l'identique quel que soit l'epsilon.
 */
function bulgedSquare(lon: number, lat: number, half: number): PolygonGeometry {
  return {
    type: 'Polygon',
    coordinates: [
      [
        [lon - half, lat - half],
        [lon, lat - half - 0.004],
        [lon + half, lat - half],
        [lon + half, lat + half],
        [lon - half, lat + half],
        [lon - half, lat - half],
      ],
    ],
  };
}

/**
 * Un anneau de `count` points sur un cercle, dont un point sur deux est décalé
 * vers l'extérieur. Le décalage est déterministe et d'environ deux unités de
 * `viewBox` : il empêche Douglas-Peucker de réduire un cercle lisse à une
 * vingtaine de sommets, ce qui est le seul moyen d'éprouver réellement le
 * plafond communal.
 */
function jaggedCircle(
  count: number,
  lon: number,
  lat: number,
  radius: number,
  jitter: number,
): number[][] {
  const ring: number[][] = [];
  for (let i = 0; i < count; i++) {
    const angle = (2 * Math.PI * i) / count;
    const r = radius + (i % 2 === 0 ? 0 : jitter);
    ring.push([lon + r * Math.cos(angle), lat + r * Math.sin(angle)]);
  }
  const first = ring[0] ?? [lon, lat];
  ring.push([...first]);
  return ring;
}

function numbersOf(pathD: string): number[] {
  return (pathD.match(/-?\d+(?:\.\d+)?/g) ?? []).map((token) => Number(token));
}

function tokensOf(pathD: string): string[] {
  return pathD.match(/-?\d+(?:\.\d+)?/g) ?? [];
}

function bboxOf(pathD: string): { minX: number; maxX: number; minY: number; maxY: number } {
  const numbers = numbersOf(pathD);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    xs.push(numbers[i] ?? 0);
    ys.push(numbers[i + 1] ?? 0);
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

describe('Atlas §33 — la projection partagée', () => {
  it('métropole dans le viewBox', () => {
    const villes: Array<[string, number, number]> = [
      ['Brest', -4.49, 48.39],
      ['Lille', 3.06, 50.63],
      ['Menton', 7.5, 43.78],
      ['Ajaccio', 8.74, 41.92],
      ['Perpignan', 2.9, 42.7],
    ];

    for (const [nom, lon, lat] of villes) {
      const point = projectLonLat(lon, lat);
      expect(`${nom}:${Number.isFinite(point.x) && Number.isFinite(point.y)}`).toBe(`${nom}:true`);
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(ATLAS_VIEWBOX);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(ATLAS_VIEWBOX);
    }

    // Le cadre est centré sur l'axe le plus court : la latitude médiane tombe au
    // milieu de la hauteur, et l'emprise documentée reste celle du contrat.
    const centre = projectLonLat(
      (ATLAS_METROPOLE_BOUNDS.lonMin + ATLAS_METROPOLE_BOUNDS.lonMax) / 2,
      (ATLAS_METROPOLE_BOUNDS.latMin + ATLAS_METROPOLE_BOUNDS.latMax) / 2,
    );
    expect(centre.x).toBeGreaterThan(400);
    expect(centre.x).toBeLessThan(600);
  });

  it('outre-mer hors viewBox', () => {
    const territoires: Array<[string, number, number]> = [
      ['Saint-Denis de La Réunion', 55.45, -20.88],
      ['Pointe-à-Pitre', -61.53, 16.24],
      ['Fort-de-France', -61.07, 14.6],
      ['Cayenne', -52.33, 4.92],
      ['Mamoudzou', 45.23, -12.78],
    ];

    for (const [nom, lon, lat] of territoires) {
      const geometrie = square(lon, lat, 0.05);
      const verdict = classifyGeometry(geometrie, 'COMMUNE');
      expect(`${nom}:${verdict}`).toBe(`${nom}:out_of_viewbox`);
      expect(geometryToPathD(geometrie, 'COMMUNE')).toBeNull();
    }
  });

  it('arrondi à deux décimales, jamais moins zéro', () => {
    const pathD = geometryToPathD(square(2.0, 47.0, 0.01), 'COMMUNE');
    expect(pathD).not.toBeNull();

    const tokens = tokensOf(pathD ?? '');
    expect(tokens.length).toBeGreaterThan(0);
    for (const token of tokens) {
      expect(token).toMatch(/^-?\d+(\.\d{1,2})?$/);
      expect(token).not.toBe('-0');
    }

    expect(pathD?.startsWith('M')).toBe(true);
    expect(pathD?.endsWith('Z')).toBe(true);
  });

  it('déterminisme', () => {
    const geometrie = square(2.4, 47.5, 0.3);
    const premier = geometryToPathD(geometrie, 'COMMUNE');
    const second = geometryToPathD(geometrie, 'COMMUNE');
    expect(premier).not.toBeNull();
    expect(premier).toBe(second);

    const troisieme = geometryToPathD(geometrie, 'DEPARTEMENT');
    expect(troisieme).not.toBeNull();
  });

  it('anneau dégénéré : la version projetée non simplifiée est conservée', () => {
    // Trois points strictement alignés : Douglas-Peucker les réduit à deux, donc
    // le module doit rendre l'anneau projeté d'origine plutôt qu'un trait.
    const aligne: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [2.0, 47.0],
          [2.1, 47.0],
          [2.2, 47.0],
          [2.0, 47.0],
        ],
      ],
    };

    const pathD = geometryToPathD(aligne, 'COMMUNE');
    expect(pathD).not.toBeNull();
    expect(pathPointCount(pathD ?? '')).toBeGreaterThanOrEqual(3);
  });

  it('plafond communal : un anneau dense tient sous 700 sommets', () => {
    const geometrie: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [jaggedCircle(5000, 2.4, 47.5, 0.4, 0.04)],
    };

    const commune = geometryToPathD(geometrie, 'COMMUNE');
    expect(commune).not.toBeNull();
    expect(pathPointCount(commune ?? '')).toBeLessThanOrEqual(ATLAS_COMMUNE_MAX_POINTS);
    expect(pathPointCount(commune ?? '')).toBeGreaterThan(0);
  });

  it('géométrie invalide : null, jamais une exception', () => {
    const invalides: unknown[] = [
      null,
      undefined,
      {},
      { type: 'Polygon', coordinates: [] },
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [Number.NaN, 1],
            [1, 2],
            [0, 0],
          ],
        ],
      },
      { type: 'Polygon', coordinates: [[[0, 0], [1, 1], [1]]] },
      { type: 'Point', coordinates: [2, 47] },
      { type: 'Feature', geometry: null },
      {
        type: 'Polygon',
        coordinates: [
          [
            [0, 91],
            [1, 92],
            [2, 93],
            [0, 91],
          ],
        ],
      },
    ];

    for (const geometrie of invalides) {
      const niveau: AtlasLevel = 'COMMUNE';
      expect(() => geometryToPathD(geometrie, niveau)).not.toThrow();
      expect(() => classifyGeometry(geometrie, niveau)).not.toThrow();
      expect(geometryToPathD(geometrie, niveau)).toBeNull();
      expect(classifyGeometry(geometrie, niveau)).toBe('invalid');
    }
  });

  it('viewBox respecté : le tracé d’une région métropolitaine reste dans le cadre', () => {
    const region = geometryToPathD(square(2.5, 47.0, 2.5), 'REGION');
    expect(region).not.toBeNull();

    const bbox = bboxOf(region ?? '');
    expect(bbox.minX).toBeGreaterThanOrEqual(0);
    expect(bbox.maxX).toBeLessThanOrEqual(ATLAS_VIEWBOX);
    expect(bbox.minY).toBeGreaterThanOrEqual(0);
    expect(bbox.maxY).toBeLessThanOrEqual(ATLAS_VIEWBOX);
  });

  it('le nord est en haut', () => {
    // Un `y` SVG croît vers le bas : la latitude la plus haute doit porter le plus
    // petit `y`. Une inversion de l'axe passerait tous les autres cas du fichier.
    expect(projectLonLat(2, 51).y).toBeLessThan(projectLonLat(2, 42).y);
  });

  it('l’est est à droite', () => {
    expect(projectLonLat(9, 48).x).toBeGreaterThan(projectLonLat(-4, 48).x);
  });

  it('un tracé gelé', () => {
    // Valeur mesurée, collée en littéral : c'est cette assertion qui empêche une
    // dérive silencieuse du rendu sur des données valides (arrondi, epsilon,
    // format des commandes).
    const paris = square(2.3522, 48.8566, 0.05);
    expect(geometryToPathD(paris, 'COMMUNE')).toBe(
      'M506.64 276.06L513.13 276.06L513.13 266.19L506.64 266.19Z',
    );
  });

  it('les niveaux ne rendent pas le même tracé', () => {
    const geometrie = bulgedSquare(2.3522, 48.8566, 0.05);
    const region = geometryToPathD(geometrie, 'REGION');
    const commune = geometryToPathD(geometrie, 'COMMUNE');

    expect(region).not.toBeNull();
    expect(commune).not.toBeNull();
    expect(region).not.toBe(commune);
    expect((region ?? '').length).not.toBe((commune ?? '').length);
  });

  it('un sommet au pôle est invalide, jamais hors viewBox', () => {
    // À `lat = ±90`, Mercator rend `±Infinity` : sans la garde, l'entité serait
    // classée `out_of_viewbox` (« outre-mer »), ce qui est faux — elle est invalide.
    const polaire: PolygonGeometry = {
      type: 'Polygon',
      coordinates: [
        [
          [2, 90],
          [3, 48],
          [2, 47],
          [2, 90],
        ],
      ],
    };

    expect(geometryToPathD(polaire, 'COMMUNE')).toBeNull();
    expect(classifyGeometry(polaire, 'COMMUNE')).toBe('invalid');
  });
});

/**
 * Cas d'intégration — le harnais maison du dépôt : vrai PostgreSQL, préfixe
 * unique par exécution, nettoyage par préfixe. Ils vérifient la **couche
 * d'entrée-sortie** (`scripts/import/src/atlas.ts`), pas la projection : lire
 * `geom`, classer, écrire `path_d` par lots, et ne rien réécrire au second
 * passage.
 */
describe('Atlas §33 — l’écriture idempotente', () => {
  const prefix = crypto.randomUUID().slice(0, 8);
  const baseRegionCode = `${prefix}-R0`;
  const departementCode = `${prefix}-D1`;
  const metroRegionCode = `${prefix}-R1`;
  const idempotentRegionCode = `${prefix}-R2`;

  let db: ReturnType<typeof createDb>;

  async function seedRegion(code: string, geom: unknown): Promise<void> {
    const json = geom === null ? null : JSON.stringify(geom);
    await sql`
      insert into ref_regions (code, nom, geom)
      values (${code}, ${`Région ${code}`}, ${json}::text::jsonb)
    `.execute(db);
  }

  async function seedCommune(code: string, geom: unknown): Promise<void> {
    const json = geom === null ? null : JSON.stringify(geom);
    await sql`
      insert into ref_communes
        (code_insee, nom, code_departement, code_region, population, rarete, score_base, geom)
      values
        (${code}, ${`Commune ${code}`}, ${departementCode}, ${baseRegionCode},
         1000, 'COMMUNE', 100, ${json}::text::jsonb)
    `.execute(db);
  }

  async function regionPathD(code: string): Promise<string | null> {
    const result = await sql<{ path_d: string | null }>`
      select path_d from ref_regions where code = ${code}
    `.execute(db);
    return result.rows[0]?.path_d ?? null;
  }

  async function communePathD(code: string): Promise<string | null> {
    const result = await sql<{ path_d: string | null }>`
      select path_d from ref_communes where code_insee = ${code}
    `.execute(db);
    return result.rows[0]?.path_d ?? null;
  }

  beforeAll(async () => {
    db = createDb(process.env.DATABASE_URL ?? '');
    await runMigrations(db);

    await sql`
      insert into ref_regions (code, nom) values (${baseRegionCode}, ${`Région ${baseRegionCode}`})
    `.execute(db);
    await sql`
      insert into ref_departements (code, nom, code_region, population)
      values (${departementCode}, ${`Département ${departementCode}`}, ${baseRegionCode}, 1000)
    `.execute(db);
  });

  afterAll(async () => {
    await db.deleteFrom('ref_communes').where('code_insee', 'like', `${prefix}-%`).execute();
    await db.deleteFrom('ref_departements').where('code', 'like', `${prefix}-%`).execute();
    await db.deleteFrom('ref_regions').where('code', 'like', `${prefix}-%`).execute();
    await db.destroy();
  });

  it('un polygone métropolitain produit un tracé dans le viewBox', async () => {
    await seedRegion(metroRegionCode, square(2.0, 47.0, 0.5));

    await computeAtlasPaths(db, 'REGION');

    const pathD = await regionPathD(metroRegionCode);
    expect(pathD).not.toBeNull();
    expect((pathD ?? '').startsWith('M')).toBe(true);

    const bbox = bboxOf(pathD ?? '');
    expect(bbox.minX).toBeGreaterThanOrEqual(0);
    expect(bbox.maxX).toBeLessThanOrEqual(ATLAS_VIEWBOX);
    expect(bbox.minY).toBeGreaterThanOrEqual(0);
    expect(bbox.maxY).toBeLessThanOrEqual(ATLAS_VIEWBOX);
  });

  it('un second passage ne réécrit rien et rend le tracé identique à l’octet', async () => {
    await seedRegion(idempotentRegionCode, square(3.0, 46.0, 0.4));

    const first = await computeAtlasPaths(db, 'REGION');
    const before = await regionPathD(idempotentRegionCode);
    expect(before).not.toBeNull();
    expect(first.written).toBeGreaterThanOrEqual(1);

    const second = await computeAtlasPaths(db, 'REGION');
    const after = await regionPathD(idempotentRegionCode);

    // Assertions **locales** : `computeAtlasPaths` parcourt toute la table, donc un
    // `second.written === 0` global ne tiendrait que si aucun autre fichier de spec
    // ne sème de région entre les deux passages. On ne mesure que notre ligne.
    expect(second.written).toBeLessThanOrEqual(first.written);
    expect(second.alreadySet).toBeGreaterThanOrEqual(1);
    expect(after).toBe(before);
  });

  it('une géométrie absente ne lève pas et laisse le tracé NULL', async () => {
    const code = `${prefix}-CNULL`;
    await seedCommune(code, null);

    const counters = await computeAtlasPaths(db, 'COMMUNE');

    expect(counters.missingGeom).toBeGreaterThanOrEqual(1);
    expect(await communePathD(code)).toBeNull();
  });

  it('une géométrie invalide ne lève pas et laisse le tracé NULL', async () => {
    const code = `${prefix}-CINV`;
    await seedCommune(code, { type: 'Polygon', coordinates: [] });

    const counters = await computeAtlasPaths(db, 'COMMUNE');

    expect(counters.invalidGeom).toBeGreaterThanOrEqual(1);
    expect(await communePathD(code)).toBeNull();
  });

  it('l’outre-mer reste hors du viewBox et ne produit aucun tracé', async () => {
    const code = `${prefix}-CDOM`;
    await seedCommune(code, square(55.45, -20.88, 0.2));

    const counters = await computeAtlasPaths(db, 'COMMUNE');

    expect(counters.outOfViewbox).toBeGreaterThanOrEqual(1);
    expect(await communePathD(code)).toBeNull();
  });
});
