import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createDb, runMigrations, sql } from '@hexamap/db';
import { backfillOverseasFrames, type OverseasReport } from '@hexamap/import/src/atlas-overseas';
import {
  ATLAS_METROPOLE_VIEW_BOX,
  formatViewBox,
  geometryToPathD,
  parseViewBox,
  projectLonLat,
  viewBoxOfGeometries,
} from '@hexamap/import/src/atlas-projection';
import { ATLAS_VIEWBOX } from '@hexamap/shared';

/**
 * Atlas §50 — le cadre d'un groupe.
 *
 * Le premier `describe` verrouille le module pur : le cadre métropolitain, la
 * lecture et l'écriture d'un `viewBox`, et la bbox rembourrée d'un groupe. Le
 * second éprouve le backfill sur une base réelle, avec un groupe synthétique et
 * une région métropolitaine laissée intacte.
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

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** Bbox des nombres d'un `path_d`, lus par paires `x y`. */
function bboxOf(pathD: string): Bounds {
  const numbers = (pathD.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let index = 0; index + 1 < numbers.length; index += 2) {
    const x = numbers[index];
    const y = numbers[index + 1];
    if (x === undefined || y === undefined) {
      continue;
    }
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  return { minX, maxX, minY, maxY };
}

describe('Atlas §50 — le cadre d’un groupe', () => {
  const LA_REUNION: readonly [number, number] = [55.45, -20.88];
  const GUADELOUPE: readonly [number, number] = [-61.5, 16.2];

  it('le cadre métropolitain est déclaré une seule fois', () => {
    expect(ATLAS_METROPOLE_VIEW_BOX).toBe(ATLAS_VIEWBOX);
    expect(ATLAS_METROPOLE_VIEW_BOX).toBe('0 0 1000 1000');
  });

  it('parseViewBox lit un cadre SVG', () => {
    const expected = { x: 0, y: 0, width: 1000, height: 1000 };
    expect(parseViewBox('0 0 1000 1000')).toEqual(expected);
    expect(parseViewBox('0,0,1000,1000')).toEqual(expected);
  });

  it('parseViewBox refuse un cadre inexploitable', () => {
    for (const value of ['', '0 0 1000', '0 0 0 1000', 'a b c d', '0 0 1000 1000 5']) {
      expect(parseViewBox(value)).toBeNull();
    }
  });

  it('formatViewBox rend au plus deux décimales', () => {
    const box = { x: 1.005, y: 2, width: 3, height: 4 };
    const text = formatViewBox(box);
    expect(text).not.toMatch(/\.\d{3,}/);

    const reparsed = parseViewBox(text);
    expect(reparsed).not.toBeNull();
    if (reparsed === null) return;
    expect(Math.abs(reparsed.x - box.x)).toBeLessThanOrEqual(0.011);
    expect(Math.abs(reparsed.y - box.y)).toBeLessThanOrEqual(0.011);
    expect(Math.abs(reparsed.width - box.width)).toBeLessThanOrEqual(0.011);
    expect(Math.abs(reparsed.height - box.height)).toBeLessThanOrEqual(0.011);
  });

  it('deux géométries disjointes donnent un cadre qui contient les deux', () => {
    const reunion = square(LA_REUNION[0], LA_REUNION[1], 0.2);
    const guadeloupe = square(GUADELOUPE[0], GUADELOUPE[1], 0.2);

    const frame = viewBoxOfGeometries([reunion, guadeloupe]);
    expect(frame).not.toBeNull();
    if (frame === null) return;

    const box = parseViewBox(frame);
    expect(box).not.toBeNull();
    if (box === null) return;

    for (const geometry of [reunion, guadeloupe]) {
      const ring = geometry.coordinates[0] ?? [];
      for (const position of ring) {
        const lon = position[0];
        const lat = position[1];
        if (lon === undefined || lat === undefined) {
          continue;
        }
        const point = projectLonLat(lon, lat);
        expect(point.x).toBeGreaterThanOrEqual(box.x);
        expect(point.x).toBeLessThanOrEqual(box.x + box.width);
        expect(point.y).toBeGreaterThanOrEqual(box.y);
        expect(point.y).toBeLessThanOrEqual(box.y + box.height);
      }
    }
  });

  it('le cadre d’un groupe ouvre ce que le cadre métropolitain fermait', () => {
    const reunion = square(LA_REUNION[0], LA_REUNION[1], 0.2);

    expect(geometryToPathD(reunion, 'COMMUNE')).toBeNull();

    const frame = viewBoxOfGeometries([reunion]);
    expect(frame).not.toBeNull();
    if (frame === null) return;

    const pathD = geometryToPathD(reunion, 'COMMUNE', frame);
    expect(pathD).not.toBeNull();
    if (pathD === null) return;

    const box = parseViewBox(frame);
    expect(box).not.toBeNull();
    if (box === null) return;

    const bbox = bboxOf(pathD);
    expect(bbox.minX).toBeGreaterThanOrEqual(box.x);
    expect(bbox.maxX).toBeLessThanOrEqual(box.x + box.width);
    expect(bbox.minY).toBeGreaterThanOrEqual(box.y);
    expect(bbox.maxY).toBeLessThanOrEqual(box.y + box.height);
  });

  it('le cadre est déterministe', () => {
    const reunion = square(LA_REUNION[0], LA_REUNION[1], 0.2);
    const guadeloupe = square(GUADELOUPE[0], GUADELOUPE[1], 0.2);
    expect(viewBoxOfGeometries([reunion, guadeloupe])).toBe(
      viewBoxOfGeometries([reunion, guadeloupe]),
    );
  });
});

describe('Atlas §50 — le backfill d’outre-mer', () => {
  const prefix = crypto.randomUUID().slice(0, 8);
  const dromRegionCode = `${prefix}-OMR`;
  const dromDepartementCode = `${prefix}-OMD`;
  const dromCommune1Code = `${prefix}-OMC1`;
  const dromCommune2Code = `${prefix}-OMC2`;
  const metroRegionCode = `${prefix}-MET`;

  let db: ReturnType<typeof createDb>;
  let firstReport: OverseasReport;
  let firstPaths: {
    region: string | null;
    departement: string | null;
    commune1: string | null;
    commune2: string | null;
  };
  let firstFrames: {
    region: string;
    departement: string;
    commune1: string;
    commune2: string;
  };

  async function seedRegion(code: string, geom: unknown): Promise<void> {
    await sql`
      insert into ref_regions (code, nom, geom)
      values (${code}, ${`Région ${code}`}, ${JSON.stringify(geom)}::text::jsonb)
    `.execute(db);
  }

  async function seedDepartement(code: string, codeRegion: string, geom: unknown): Promise<void> {
    await sql`
      insert into ref_departements (code, nom, code_region, population, geom)
      values
        (${code}, ${`Département ${code}`}, ${codeRegion}, 1000,
         ${JSON.stringify(geom)}::text::jsonb)
    `.execute(db);
  }

  async function seedCommune(
    code: string,
    codeDepartement: string,
    codeRegion: string,
    geom: unknown,
  ): Promise<void> {
    await sql`
      insert into ref_communes
        (code_insee, nom, code_departement, code_region, population, rarete, score_base, geom)
      values
        (${code}, ${`Commune ${code}`}, ${codeDepartement}, ${codeRegion},
         1000, 'COMMUNE', 100, ${JSON.stringify(geom)}::text::jsonb)
    `.execute(db);
  }

  async function readRegion(code: string): Promise<{ path_d: string | null; view_box: string }> {
    const result = await sql<{ path_d: string | null; view_box: string }>`
      select path_d, view_box from ref_regions where code = ${code}
    `.execute(db);
    const row = result.rows[0];
    return { path_d: row?.path_d ?? null, view_box: row?.view_box ?? '' };
  }

  async function readDepartement(
    code: string,
  ): Promise<{ path_d: string | null; view_box: string }> {
    const result = await sql<{ path_d: string | null; view_box: string }>`
      select path_d, view_box from ref_departements where code = ${code}
    `.execute(db);
    const row = result.rows[0];
    return { path_d: row?.path_d ?? null, view_box: row?.view_box ?? '' };
  }

  async function readCommune(code: string): Promise<{ path_d: string | null; view_box: string }> {
    const result = await sql<{ path_d: string | null; view_box: string }>`
      select path_d, view_box from ref_communes where code_insee = ${code}
    `.execute(db);
    const row = result.rows[0];
    return { path_d: row?.path_d ?? null, view_box: row?.view_box ?? '' };
  }

  beforeAll(async () => {
    db = createDb(process.env.DATABASE_URL ?? '');
    await runMigrations(db);

    await seedRegion(dromRegionCode, square(-61.5, 16.2, 0.3));
    await seedDepartement(dromDepartementCode, dromRegionCode, square(-61.5, 16.2, 0.2));
    await seedCommune(
      dromCommune1Code,
      dromDepartementCode,
      dromRegionCode,
      square(-61.6, 16.1, 0.1),
    );
    await seedCommune(
      dromCommune2Code,
      dromDepartementCode,
      dromRegionCode,
      square(-61.4, 16.3, 0.1),
    );

    await seedRegion(metroRegionCode, square(2.0, 47.0, 0.5));

    firstReport = await backfillOverseasFrames(db);

    const region = await readRegion(dromRegionCode);
    const departement = await readDepartement(dromDepartementCode);
    const commune1 = await readCommune(dromCommune1Code);
    const commune2 = await readCommune(dromCommune2Code);

    firstPaths = {
      region: region.path_d,
      departement: departement.path_d,
      commune1: commune1.path_d,
      commune2: commune2.path_d,
    };
    firstFrames = {
      region: region.view_box,
      departement: departement.view_box,
      commune1: commune1.view_box,
      commune2: commune2.view_box,
    };
  });

  afterAll(async () => {
    await db.deleteFrom('ref_communes').where('code_insee', 'like', `${prefix}-%`).execute();
    await db.deleteFrom('ref_departements').where('code', 'like', `${prefix}-%`).execute();
    await db.deleteFrom('ref_regions').where('code', 'like', `${prefix}-%`).execute();
    await db.destroy();
  });

  it('le groupe d’outre-mer partage un seul cadre et reçoit ses tracés', async () => {
    const group = firstReport.groups.find((candidate) => candidate.regionCode === dromRegionCode);
    expect(group).toBeDefined();
    if (group === undefined) return;

    expect(group.viewBox).not.toBe('0 0 1000 1000');
    expect(firstFrames.region).toBe(group.viewBox);
    expect(firstFrames.departement).toBe(group.viewBox);
    expect(firstFrames.commune1).toBe(group.viewBox);
    expect(firstFrames.commune2).toBe(group.viewBox);

    expect(firstPaths.region).not.toBeNull();
    expect(firstPaths.departement).not.toBeNull();
    expect(firstPaths.commune1).not.toBeNull();
    expect(firstPaths.commune2).not.toBeNull();

    expect(group.pathWritten).toBeGreaterThanOrEqual(3);
    expect(group.framesWritten).toBeGreaterThanOrEqual(3);
  });

  it('la région métropolitaine reste intacte', async () => {
    const metro = await readRegion(metroRegionCode);
    expect(metro.path_d).toBeNull();
    expect(metro.view_box).toBe('0 0 1000 1000');
  });

  it('un second passage ne réécrit ni tracé ni cadre', async () => {
    const second = await backfillOverseasFrames(db);
    const group = second.groups.find((candidate) => candidate.regionCode === dromRegionCode);
    expect(group).toBeDefined();
    if (group === undefined) return;

    expect(group.pathWritten).toBe(0);
    expect(group.alreadySet).toBe(group.rows);

    const region = await readRegion(dromRegionCode);
    const departement = await readDepartement(dromDepartementCode);
    const commune1 = await readCommune(dromCommune1Code);
    const commune2 = await readCommune(dromCommune2Code);

    expect(region.path_d).toBe(firstPaths.region);
    expect(departement.path_d).toBe(firstPaths.departement);
    expect(commune1.path_d).toBe(firstPaths.commune1);
    expect(commune2.path_d).toBe(firstPaths.commune2);

    expect(region.view_box).toBe(firstFrames.region);
    expect(departement.view_box).toBe(firstFrames.departement);
    expect(commune1.view_box).toBe(firstFrames.commune1);
    expect(commune2.view_box).toBe(firstFrames.commune2);
  });
});
