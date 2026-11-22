import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { loadAtlasDepartement, loadAtlasSummary } from '@hexamap/api/services/atlas';
import { createDb, runMigrations, sql } from '@hexamap/db';
import { ATLAS_VIEWBOX, type AtlasDepartementDetail, type AtlasSummary } from '@hexamap/shared';

const databaseUrl = process.env.DATABASE_URL ?? '';
const db = createDb(databaseUrl);

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';

// --- état du seed (préfixe unique par exécution pour ne jamais entrer en collision) ---
const prefix = crypto.randomUUID().slice(0, 8);
const seeded = {
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
const createdUserIds: string[] = [];

interface ErrorBody {
  code: string;
  message: string;
}

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

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

async function authFetch(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
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

beforeAll(async () => {
  await runMigrations(db);
  await seedReference();
});

afterAll(async () => {
  await db.deleteFrom('ref_communes').where('code_insee', 'like', `${prefix}%`).execute();
  await db.deleteFrom('ref_departements').where('code', 'like', `${prefix}%`).execute();
  await db.deleteFrom('ref_regions').where('code', 'like', `${prefix}%`).execute();
  if (createdUserIds.length > 0) {
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

describe('Archi §4.1 — les routes de l’atlas sont fermées par défaut', () => {
  it('rend 401 UNAUTHORIZED sur le résumé sans session', async () => {
    const res = await authFetch('/api/v1/atlas/summary');
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorBody).code).toBe('UNAUTHORIZED');
  });

  it('rend 401 UNAUTHORIZED sur le détail sans session', async () => {
    const res = await authFetch(`/api/v1/atlas/departements/${seeded.departementCode}`);
    expect(res.status).toBe(401);
    expect(((await res.json()) as ErrorBody).code).toBe('UNAUTHORIZED');
  });
});

describe('Roadmap v2 §4 — le détail d’un département', () => {
  it('rend 404 DEPARTEMENT_NOT_FOUND sur un code inconnu', async () => {
    const { cookie } = await signUp();
    const res = await authFetch('/api/v1/atlas/departements/ZZZ-404', {}, cookie);
    expect(res.status).toBe(404);
    const body = (await res.json()) as ErrorBody;
    expect(body.code).toBe('DEPARTEMENT_NOT_FOUND');
    expect(body.message).toBe('Ce département est introuvable ou hors de la carte.');
  });

  it('rend 404 DEPARTEMENT_NOT_FOUND sur un département sans path_d', async () => {
    const { cookie } = await signUp();
    const res = await authFetch(
      `/api/v1/atlas/departements/${seeded.departementOverseasCode}`,
      {},
      cookie,
    );
    expect(res.status).toBe(404);
    expect(((await res.json()) as ErrorBody).code).toBe('DEPARTEMENT_NOT_FOUND');
  });

  it('rend 200 sur un département tracé, sans aucune carte possédée', async () => {
    const { cookie } = await signUp();
    const res = await authFetch(`/api/v1/atlas/departements/${seeded.departementCode}`, {}, cookie);
    expect(res.status).toBe(200);
    const detail = (await res.json()) as AtlasDepartementDetail;

    expect(detail.viewBox).toBe(ATLAS_VIEWBOX);
    expect(detail.code).toBe(seeded.departementCode);
    expect(detail.communesOwned).toBe(0);
    expect(detail.communesTotal).toBe(seeded.communeCodes.length);
    expect(detail.communes).toHaveLength(seeded.communeCodes.length);
    for (const commune of detail.communes) {
      expect(seeded.communeCodes).toContain(commune.codeInsee);
      expect(commune.ownedCards).toBe(0);
      expect(commune.hasCommuneCard).toBe(false);
      expect(typeof commune.pathD).toBe('string');
    }
  });

  it('compte les exemplaires et les communes distinctes séparément', async () => {
    const { cookie, userId } = await signUp();
    const target = seeded.communeCodes[0] ?? '';
    await insertCommuneCard(userId, target);
    await insertCommuneCard(userId, target);
    await insertCommuneCard(userId, target);

    const res = await authFetch(`/api/v1/atlas/departements/${seeded.departementCode}`, {}, cookie);
    expect(res.status).toBe(200);
    const detail = (await res.json()) as AtlasDepartementDetail;

    expect(detail.communesOwned).toBe(1);
    expect(detail.communesTotal).toBe(seeded.communeCodes.length);
    const owned = detail.communes.filter((commune) => commune.codeInsee === target);
    expect(owned).toHaveLength(1);
    expect(owned[0]?.ownedCards).toBe(3);
    expect(owned[0]?.hasCommuneCard).toBe(true);

    const summary = await readSummary(cookie);
    const departement = summary.departements.find((entry) => entry.code === seeded.departementCode);
    expect(departement?.communesOwned).toBe(1);
    expect(departement?.communesTotal).toBe(seeded.communeCodes.length);

    const region = summary.regions.find((entry) => entry.code === seeded.regionCode);
    expect(region?.communesOwned).toBe(1);
  });
});

describe('Roadmap v2 §4 — le résumé national', () => {
  it('rend le viewBox et les deux listes plates', async () => {
    const { cookie } = await signUp();
    const summary = await readSummary(cookie);

    expect(summary.viewBox).toBe(ATLAS_VIEWBOX);
    expect(Array.isArray(summary.regions)).toBe(true);
    expect(Array.isArray(summary.departements)).toBe(true);

    const departement = summary.departements.find((entry) => entry.code === seeded.departementCode);
    expect(departement?.codeRegion).toBe(seeded.regionCode);
    expect(departement?.nom).toBe(`Département ${prefix}`);
    expect(departement?.hasDepartementCard).toBe(false);
    expect(departement?.pathD).toBe('M100 100L200 200L100 300Z');
  });

  it('rend pathD null pour une région sans tracé', async () => {
    const { cookie } = await signUp();
    const summary = await readSummary(cookie);

    const region = summary.regions.find((entry) => entry.code === seeded.regionPathCode);
    expect(region).toBeDefined();
    expect(region?.pathD).toBeNull();
  });

  it('marque la possession des cartes de région et de département pour le seul compte demandeur', async () => {
    const owner = await signUp();
    const stranger = await signUp();
    await db
      .insertInto('user_cards')
      .values([
        {
          user_id: owner.userId,
          category: 'REGION',
          ref_code: seeded.regionCode,
          rarity: 'RARE',
          score: 500,
        },
        {
          user_id: owner.userId,
          category: 'DEPARTEMENT',
          ref_code: seeded.departementCode,
          rarity: 'RARE',
          score: 500,
        },
      ])
      .execute();

    const owned = await readSummary(owner.cookie);
    expect(owned.regions.find((entry) => entry.code === seeded.regionCode)?.hasRegionCard).toBe(
      true,
    );
    expect(
      owned.departements.find((entry) => entry.code === seeded.departementCode)?.hasDepartementCard,
    ).toBe(true);

    const other = await readSummary(stranger.cookie);
    expect(
      other.departements.find((entry) => entry.code === seeded.departementCode)?.hasDepartementCard,
    ).toBe(false);
    expect(other.regions.every((entry) => entry.hasRegionCard)).toBe(false);
  });

  it('n’expose aucune donnée privée', async () => {
    const { cookie, userId } = await signUp();
    await insertCommuneCard(userId, seeded.communeCodes[0] ?? '');

    const summaryRes = await authFetch('/api/v1/atlas/summary', {}, cookie);
    expect(summaryRes.status).toBe(200);
    const summaryText = await summaryRes.text();
    for (const forbidden of ['locked', 'currency', 'email', 'session', 'password', 'RUE']) {
      expect(summaryText).not.toContain(forbidden);
    }

    const detailRes = await authFetch(
      `/api/v1/atlas/departements/${seeded.departementCode}`,
      {},
      cookie,
    );
    expect(detailRes.status).toBe(200);
    const detailText = await detailRes.text();
    for (const forbidden of ['locked', 'currency', 'email', 'session', 'password', 'RUE']) {
      expect(detailText).not.toContain(forbidden);
    }
  });
});

describe('Archi §4.2 — une instruction par service', () => {
  it('loadAtlasSummary n’émet qu’une requête', async () => {
    const { userId } = await signUp();
    const statements: string[] = [];
    const counted = createDb(databaseUrl, {
      log: (event) => {
        if (event.level === 'query') statements.push(event.query.sql);
      },
    });

    try {
      await loadAtlasSummary(counted, userId);
      expect(statements).toHaveLength(1);
    } finally {
      await counted.destroy();
    }
  });

  it('loadAtlasDepartement n’émet qu’une requête et rend null hors carte', async () => {
    const { userId } = await signUp();
    const statements: string[] = [];
    const counted = createDb(databaseUrl, {
      log: (event) => {
        if (event.level === 'query') statements.push(event.query.sql);
      },
    });

    try {
      const detail = await loadAtlasDepartement(counted, seeded.departementCode, userId);
      expect(detail).not.toBeNull();
      expect(statements).toHaveLength(1);

      const missing = await loadAtlasDepartement(counted, 'ZZZ-404', userId);
      expect(missing).toBeNull();
      expect(statements).toHaveLength(2);
    } finally {
      await counted.destroy();
    }
  });
});

describe('Roadmap v2 §4 — tenue en charge', () => {
  it('sert le résumé avec 2 000 cartes possédées sous un p95 de 200 ms', async () => {
    const { cookie, userId } = await signUp();
    await sql`
      insert into user_cards (user_id, category, ref_code, rarity, score)
      select
        ${userId},
        'COMMUNE',
        d.codes[((g.i - 1) % array_length(d.codes, 1)) + 1],
        'COMMUNE',
        100
      from generate_series(1, ${seeded.bulkCards}) as g(i)
      cross join (
        select array_agg(code_insee order by code_insee) as codes
        from ref_communes
        where code_departement = ${seeded.departementPerfCode}
      ) d
    `.execute(db);

    const samples: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now();
      const res = await authFetch('/api/v1/atlas/summary', {}, cookie);
      expect(res.status).toBe(200);
      await res.text();
      samples.push(performance.now() - started);
    }

    samples.sort((left, right) => left - right);
    const p95 = samples[Math.max(0, Math.ceil(samples.length * 0.95) - 1)] ?? 0;
    console.log(`[atlas] p95 du résumé sur 2 000 cartes = ${p95.toFixed(1)} ms`);
    expect(p95).toBeLessThanOrEqual(200);
  });

  it('sert un département de 900 communes sans dépasser le garde-fou de 512 Kio', async () => {
    const { cookie } = await signUp();
    const res = await authFetch(
      `/api/v1/atlas/departements/${seeded.departementDenseCode}`,
      {},
      cookie,
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    const detail = JSON.parse(text) as AtlasDepartementDetail;

    expect(detail.communes).toHaveLength(seeded.denseCommunes);
    expect(detail.communesTotal).toBe(seeded.denseCommunes);
    const bytes = new TextEncoder().encode(text).byteLength;
    console.log(`[atlas] charge d'un département de 900 communes = ${bytes} octets`);
    // Garde-fou anti-régression, pas le plafond de 60 Ko du brief : il supposerait
    // ~257 communes par département, or le département 62 en porte 887.
    expect(bytes).toBeLessThanOrEqual(512 * 1024);
  });
});
