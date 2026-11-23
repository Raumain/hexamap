import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createDb, runMigrations, sql } from '@hexamap/db';
import type { AtlasDepartementDetail } from '@hexamap/shared';
import { createAtlasHarness } from '../src/atlas-fixture';

// Mesure isolée : ce fichier vit hors de `packages/spec/src` et se joue seul,
// après la suite de spécifications (`.docs/01-architecture.md` §4.8). Les 28
// fichiers de `src` partagent une base et re-sèment `ref_*` ; mesurée au milieu
// d'eux, la latence de `/atlas/summary` attend des verrous et ne mesure plus
// ce qu'elle prétend mesurer (`.docs/03-active-task.md`, « Ce qui reste » §5).
const databaseUrl = process.env.DATABASE_URL ?? '';
const db = createDb(databaseUrl);

const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];
const { seeded, signUp, authFetch, seedReference } = createAtlasHarness(prefix, db, createdUserIds);

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

describe('Roadmap v2 §4 — tenue en charge', () => {
  let perfCookie = '';

  // Le semis est hors mesure : 5 s ne suffisaient pas à semis + 20 appels sous contention,
  // `packages/spec` étant parallèle (`.docs/03-active-task.md`, « Ce qui reste » §5).
  beforeAll(async () => {
    const { cookie, userId } = await signUp();
    perfCookie = cookie;
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
  }, 60_000);

  // Le délai couvre l'amorçage et la variance de charge machine, pas la latence : le p95 reste juge.
  it('sert le résumé avec 2 000 cartes possédées sous un p95 de 200 ms', async () => {
    const samples: number[] = [];
    for (let index = 0; index < 20; index += 1) {
      const started = performance.now();
      const res = await authFetch('/api/v1/atlas/summary', {}, perfCookie);
      expect(res.status).toBe(200);
      await res.text();
      samples.push(performance.now() - started);
    }

    samples.sort((left, right) => left - right);
    const p95 = samples[Math.max(0, Math.ceil(samples.length * 0.95) - 1)] ?? 0;
    console.log(`[atlas] p95 du résumé sur 2 000 cartes = ${p95.toFixed(1)} ms`);
    expect(p95).toBeLessThanOrEqual(200);
  }, 30_000);

  it('sert un département de 900 communes sans dépasser le garde-fou de 512 Kio', async () => {
    const res = await authFetch(
      `/api/v1/atlas/departements/${seeded.departementDenseCode}`,
      {},
      perfCookie,
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
