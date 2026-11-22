import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { loadAtlasDepartement, loadAtlasSummary } from '@hexamap/api/services/atlas';
import { createDb, runMigrations } from '@hexamap/db';
import { ATLAS_VIEWBOX, type AtlasDepartementDetail } from '@hexamap/shared';
import { createAtlasHarness } from './atlas-fixture';

const databaseUrl = process.env.DATABASE_URL ?? '';
const db = createDb(databaseUrl);

// --- état du seed (préfixe unique par exécution pour ne jamais entrer en collision) ---
const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const { seeded, signUp, authFetch, insertCommuneCard, readSummary, seedReference } =
  createAtlasHarness(prefix, db, createdUserIds);

interface ErrorBody {
  code: string;
  message: string;
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
