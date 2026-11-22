import { expect } from 'bun:test';
import { app } from '@hexamap/api/app';
import { type createDb, sql } from '@hexamap/db';
import type { AtlasSummary } from '@hexamap/shared';

export const baseUrl = 'http://localhost:3000';
export const origin = 'http://localhost:5174';

export type SpecDb = ReturnType<typeof createDb>;

export interface AtlasSeeded {
  regionCode: string;
  regionPathCode: string;
  departementCode: string;
  departementPerfCode: string;
  departementDenseCode: string;
  departementOverseasCode: string;
  communeCodes: string[];
  overseasCommuneCode: string;
  density: number;
  bulkCards: number;
  denseCommunes: number;
}

export interface AtlasHarness {
  seeded: AtlasSeeded;
  signUp: () => Promise<{ cookie: string; userId: string }>;
  authFetch: (path: string, init?: RequestInit, cookie?: string) => Promise<Response>;
  insertCommuneCard: (userId: string, codeInsee: string) => Promise<void>;
  readSummary: (cookie: string) => Promise<AtlasSummary>;
  seedReference: () => Promise<void>;
}

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

/**
 * Harnais partagé par `atlas-api.spec.ts` et `perf/atlas-load.spec.ts` : même semis
 * de référentiel, même inscription, même requête authentifiée. Le préfixe rend
 * chaque exécution isolée dans la base partagée.
 */
export function createAtlasHarness(
  prefix: string,
  db: SpecDb,
  createdUserIds: string[],
): AtlasHarness {
  const seeded: AtlasSeeded = {
    regionCode: `${prefix}-84`,
    regionPathCode: `${prefix}-11`,
    departementCode: `${prefix}-69`,
    departementPerfCode: `${prefix}-42`,
    departementDenseCode: `${prefix}-62`,
    departementOverseasCode: `${prefix}-971`,
    communeCodes: [`${prefix}-c1`, `${prefix}-c2`, `${prefix}-c3`],
    overseasCommuneCode: `${prefix}-o1`,
    density: 200,
    bulkCards: 2000,
    denseCommunes: 900,
  };

  async function signUp(): Promise<{ cookie: string; userId: string }> {
    const email = `spec-atlas-${prefix}-${crypto.randomUUID()}@hexamap.test`;
    const res = await app.handle(
      new Request(`${baseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({
          email,
          password: 'motdepasse-123',
          name: 'Spec',
          pseudo: `${prefix}-atlas-${crypto.randomUUID().slice(0, 6)}`,
        }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);
    const body = (await res.json()) as { user: { id: string } };
    createdUserIds.push(body.user.id);
    return { cookie: extractSessionCookie(res), userId: body.user.id };
  }

  async function authFetch(
    path: string,
    init: RequestInit = {},
    cookie?: string,
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    if (!headers.has('origin')) headers.set('origin', origin);
    if (cookie) headers.set('cookie', cookie);
    return app.handle(new Request(`${baseUrl}${path}`, { ...init, headers }));
  }

  async function insertCommuneCard(userId: string, codeInsee: string): Promise<void> {
    await db
      .insertInto('user_cards')
      .values({
        user_id: userId,
        category: 'COMMUNE',
        ref_code: codeInsee,
        rarity: 'COMMUNE',
        score: 100,
      })
      .execute();
  }

  async function readSummary(cookie: string): Promise<AtlasSummary> {
    const res = await authFetch('/api/v1/atlas/summary', {}, cookie);
    expect(res.status).toBe(200);
    return (await res.json()) as AtlasSummary;
  }

  /** Référentiel : deux régions (une seule avec `path_d`), quatre départements
   *  (un sans géométrie, deux denses). Aucune donnée de jeu n'est écrite ici. */
  async function seedReference(): Promise<void> {
    await db
      .insertInto('ref_regions')
      .values([
        { code: seeded.regionCode, nom: `Région ${prefix}`, path_d: 'M10 10L20 20L10 30Z' },
        { code: seeded.regionPathCode, nom: `Région sans tracé ${prefix}` },
      ])
      .execute();

    await db
      .insertInto('ref_departements')
      .values([
        {
          code: seeded.departementCode,
          nom: `Département ${prefix}`,
          code_region: seeded.regionCode,
          population: 1_000_000,
          path_d: 'M100 100L200 200L100 300Z',
        },
        {
          code: seeded.departementPerfCode,
          nom: `Département perf ${prefix}`,
          code_region: seeded.regionCode,
          population: 500_000,
          path_d: 'M110 110L210 210L110 310Z',
        },
        {
          code: seeded.departementDenseCode,
          nom: `Département dense ${prefix}`,
          code_region: seeded.regionCode,
          population: 600_000,
          path_d: 'M120 120L220 220L120 320Z',
        },
        {
          code: seeded.departementOverseasCode,
          nom: `Département hors carte ${prefix}`,
          code_region: seeded.regionPathCode,
          population: 400_000,
        },
      ])
      .execute();

    await db
      .insertInto('ref_communes')
      .values(
        seeded.communeCodes.map((codeInsee, index) => ({
          code_insee: codeInsee,
          nom: `Commune ${prefix} ${index + 1}`,
          code_departement: seeded.departementCode,
          code_region: seeded.regionCode,
          population: 1_000 * (index + 1),
          rarete: 'COMMUNE' as const,
          score_base: 100,
          path_d: `M${200 + index} 200L250 250Z`,
        })),
      )
      .execute();

    await db
      .insertInto('ref_communes')
      .values({
        code_insee: seeded.overseasCommuneCode,
        nom: `Commune hors carte ${prefix}`,
        code_departement: seeded.departementOverseasCode,
        code_region: seeded.regionPathCode,
        population: 5_000,
        rarete: 'COMMUNE',
        score_base: 100,
      })
      .execute();

    // Département de mesure : communes sans intérêt propre, seul le volume compte.
    await sql`
      insert into ref_communes (
        code_insee, nom, code_departement, code_region, population, rarete, score_base, path_d
      )
      select
        ${`${prefix}-perf-`} || lpad(g.i::text, 4, '0'),
        'Commune perf ' || g.i,
        ${seeded.departementPerfCode},
        ${seeded.regionCode},
        100,
        'COMMUNE',
        100,
        'M150 150L160 160Z'
      from generate_series(1, ${seeded.density}) as g(i)
    `.execute(db);

    // Département dense : `path_d` de longueur réaliste (moyenne nationale 233 octets).
    await sql`
      insert into ref_communes (
        code_insee, nom, code_departement, code_region, population, rarete, score_base, path_d
      )
      select
        ${`${prefix}-dense-`} || lpad(g.i::text, 4, '0'),
        'Commune dense ' || g.i,
        ${seeded.departementDenseCode},
        ${seeded.regionCode},
        100,
        'COMMUNE',
        100,
        repeat('M120.5 340.25L121 341Z', 12)
      from generate_series(1, ${seeded.denseCommunes}) as g(i)
    `.execute(db);
  }

  return { seeded, signUp, authFetch, insertCommuneCard, readSummary, seedReference };
}
