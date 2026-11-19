import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { consumeCharge, readCharges } from '@hexamap/api/services/charges';
import { createDb, runMigrations } from '@hexamap/db';
import { chargesAt, regenerateCharges } from '@hexamap/shared';

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';
const prefix = crypto.randomUUID().slice(0, 8);

const REGEN = 1_800_000;
const T0 = 1_700_000_000_000;
const RULES = { cap: 6, regenMs: REGEN };

interface ChargeBody {
  charges: number;
  cap: number;
  nextChargeAt: string | null;
  regenMs: number;
}

interface ErrorBody {
  code: string;
  message: string;
}

interface LedgerRow {
  charges: number;
  last_regen_at: Date;
}

const createdUserIds: string[] = [];
const seeded = {
  regionCodes: [] as string[],
  deptCodes: [] as string[],
  communeCodes: [] as string[],
  odonymeIds: [] as string[],
};

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUp(): Promise<{ cookie: string; userId: string }> {
  const email = `spec-${prefix}-${crypto.randomUUID()}@hexamap.test`;
  const res = await app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email,
        password: 'motdepasse-123',
        name: 'Spec',
        pseudo: `${prefix}-spec`,
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

async function createTicket(cookie: string): Promise<{ id: string }> {
  const res = await authFetch('/api/v1/tickets', { method: 'POST' }, cookie);
  expect(res.status).toBe(201);
  const body = (await res.json()) as { ticket: { id: string } };
  return body.ticket;
}

async function chargeBody(cookie: string): Promise<ChargeBody> {
  const res = await authFetch('/api/v1/charges', {}, cookie);
  expect(res.status).toBe(200);
  return (await res.json()) as ChargeBody;
}

async function ledgerRow(userId: string): Promise<LedgerRow> {
  return db
    .selectFrom('user_scratch_charges')
    .select(['charges', 'last_regen_at'])
    .where('user_id', '=', userId)
    .executeTakeFirstOrThrow();
}

/** Pose un carnet deterministe, que la ligne existe déjà ou non. */
async function seedLedger(userId: string, charges: number, lastRegenAt: Date): Promise<void> {
  await db
    .insertInto('user_scratch_charges')
    .values({ user_id: userId, charges, last_regen_at: lastRegenAt })
    .onConflict((oc) => oc.column('user_id').doUpdateSet({ charges, last_regen_at: lastRegenAt }))
    .execute();
}

/** Règle une clé de `game_config`, en la recréant si un cas l'a supprimée. */
async function setConfig(key: string, value: number | boolean): Promise<void> {
  await db
    .insertInto('game_config')
    .values({ key, value })
    .onConflict((oc) => oc.column('key').doUpdateSet({ value }))
    .execute();
}

/**
 * Jeu de référence minimal mais suffisant pour un tirage complet : une région,
 * un département, deux communes (une par palier bas) et deux odonymes reliés
 * aux deux communes, de sorte que les jumeaux se trouvent toujours.
 */
async function seedReference(): Promise<void> {
  const region = `${prefix}-R1`;
  const dept = `${prefix}-D1`;
  seeded.regionCodes = [region];
  seeded.deptCodes = [dept];

  await db
    .insertInto('ref_regions')
    .values({ code: region, nom: `Région ${prefix}` })
    .execute();

  await db
    .insertInto('ref_departements')
    .values({
      code: dept,
      nom: `Département ${prefix}`,
      code_region: region,
      population: 50_000,
    })
    .execute();

  const communeRare = `${prefix}-C-RARE`;
  const communeStandard = `${prefix}-C-COMMUNE`;
  seeded.communeCodes = [communeRare, communeStandard];

  await db
    .insertInto('ref_communes')
    .values([
      {
        code_insee: communeRare,
        nom: `Commune rare ${prefix}`,
        code_departement: dept,
        code_region: region,
        population: 12_000,
        rarete: 'RARE',
        score_base: 1_400,
      },
      {
        code_insee: communeStandard,
        nom: `Commune ${prefix}`,
        code_departement: dept,
        code_region: region,
        population: 800,
        rarete: 'COMMUNE',
        score_base: 400,
      },
    ])
    .execute();

  const odonymes = await db
    .insertInto('ref_odonymes')
    .values([
      {
        nom_normalise: `rue rare ${prefix}`,
        nom_affichage: `Rue Rare ${prefix}`,
        nb_communes: 30,
        rarete: 'RARE',
        score_base: 1_200,
      },
      {
        nom_normalise: `rue commune ${prefix}`,
        nom_affichage: `Rue Commune ${prefix}`,
        nb_communes: 700,
        rarete: 'COMMUNE',
        score_base: 500,
      },
    ])
    .returning('id')
    .execute();

  seeded.odonymeIds = odonymes.map((row) => row.id);

  await db
    .insertInto('commune_odonymes')
    .values(
      seeded.communeCodes.flatMap((codeInsee) =>
        seeded.odonymeIds.map((odonymeId) => ({ code_insee: codeInsee, odonyme_id: odonymeId })),
      ),
    )
    .execute();
}

beforeAll(async () => {
  await runMigrations(db);
  await seedReference();
});

afterAll(async () => {
  if (seeded.odonymeIds.length > 0) {
    await db.deleteFrom('commune_odonymes').where('odonyme_id', 'in', seeded.odonymeIds).execute();
    await db.deleteFrom('ref_odonymes').where('id', 'in', seeded.odonymeIds).execute();
  }
  if (seeded.communeCodes.length > 0) {
    await db.deleteFrom('ref_communes').where('code_insee', 'in', seeded.communeCodes).execute();
  }
  if (seeded.deptCodes.length > 0) {
    await db.deleteFrom('ref_departements').where('code', 'in', seeded.deptCodes).execute();
  }
  if (seeded.regionCodes.length > 0) {
    await db.deleteFrom('ref_regions').where('code', 'in', seeded.regionCodes).execute();
  }
  if (createdUserIds.length > 0) {
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  await db.destroy();
});

describe('Carnet de charges — formule', () => {
  it('Archi §2.6 — le solde se dérive de lastRegenAt sur une durée de plusieurs charges', () => {
    const result = regenerateCharges(
      { charges: 0, lastRegenAt: T0 },
      RULES,
      T0 + 3 * REGEN + 1_000,
    );

    expect(result.charges).toBe(3);
    expect(result.lastRegenAt).toBe(T0 + 3 * REGEN);
    expect(result.nextChargeAt).toBe(T0 + 4 * REGEN);
  });

  it('Archi §2.6 — deux lectures successives ne volent pas le reste fractionnaire', () => {
    const first = regenerateCharges({ charges: 0, lastRegenAt: T0 }, RULES, T0 + REGEN / 2);

    expect(first.charges).toBe(0);
    expect(first.lastRegenAt).toBe(T0);
    expect(first.nextChargeAt).toBe(T0 + REGEN);

    const second = regenerateCharges(first, RULES, T0 + REGEN - 1);

    expect(second.charges).toBe(0);
    expect(second.lastRegenAt).toBe(T0);
    expect(second.nextChargeAt).toBe(T0 + REGEN);

    const third = regenerateCharges(second, RULES, T0 + REGEN + 1);

    expect(third.charges).toBe(1);
    expect(third.lastRegenAt).toBe(T0 + REGEN);
    expect(third.nextChargeAt).toBe(T0 + 2 * REGEN);
  });

  it('Archi §2.6 — la régénération se fige au plafond', () => {
    const now = T0 + 100 * REGEN;
    const result = regenerateCharges({ charges: 6, lastRegenAt: T0 }, RULES, now);

    expect(result.charges).toBe(6);
    expect(result.lastRegenAt).toBe(now);
    expect(result.nextChargeAt).toBeNull();
  });

  it('Archi §2.6 — nextChargeAt vaut null au plafond', () => {
    const result = regenerateCharges({ charges: 5, lastRegenAt: T0 }, RULES, T0 + 2 * REGEN);

    expect(result.charges).toBe(6);
    expect(result.nextChargeAt).toBeNull();
  });

  it('Archi §2.6 — un plafond à 8 fonctionne sans changement de formule', () => {
    const result = regenerateCharges(
      { charges: 7, lastRegenAt: T0 },
      { cap: 8, regenMs: REGEN },
      T0 + REGEN,
    );

    expect(result.charges).toBe(8);
    expect(result.nextChargeAt).toBeNull();
  });

  it('Archi §2.6 — le crédit est plafonné', () => {
    const result = regenerateCharges({ charges: 5, lastRegenAt: T0 }, RULES, T0 + 3 * REGEN);

    expect(result.charges).toBe(6);
  });

  it('Archi §2.6 — une horloge qui recule ne crédite rien', () => {
    const result = regenerateCharges({ charges: 2, lastRegenAt: T0 }, RULES, T0 - 5_000);

    expect(result.charges).toBe(2);
    expect(result.lastRegenAt).toBe(T0);
    expect(result.nextChargeAt).toBe(T0 + REGEN);
  });

  it('Archi §2.6 — un délai de régénération nul ou négatif ne produit aucun NaN', () => {
    const result = regenerateCharges(
      { charges: 2, lastRegenAt: T0 },
      { cap: 6, regenMs: 0 },
      T0 + 10 * REGEN,
    );

    expect(result.charges).toBe(2);
    expect(result.lastRegenAt).toBe(T0);
    expect(result.nextChargeAt).toBeNull();
    expect(Number.isNaN(result.charges)).toBe(false);
    expect(Number.isNaN(result.lastRegenAt)).toBe(false);
  });

  it('Archi §2.6 — chargesAt ne crédite rien avant l’échéance', () => {
    const result = chargesAt(3, T0 + REGEN, RULES, T0 + REGEN - 1);

    expect(result.charges).toBe(3);
    expect(result.nextChargeAt).toBe(T0 + REGEN);
  });

  it('Archi §2.6 — chargesAt crédite une charge après l’échéance', () => {
    const result = chargesAt(3, T0 + REGEN, RULES, T0 + REGEN + 1);

    expect(result.charges).toBe(4);
    expect(result.nextChargeAt).toBe(T0 + 2 * REGEN);
  });

  it('Archi §2.6 — chargesAt rend nextChargeAt null au plafond', () => {
    const result = chargesAt(6, T0 + REGEN, RULES, T0 + 3 * REGEN);

    expect(result.charges).toBe(6);
    expect(result.nextChargeAt).toBeNull();
  });

  it('Archi §2.6 — chargesAt laisse un compte à rebours absent inchangé', () => {
    const result = chargesAt(2, null, RULES, T0 + 10 * REGEN);

    expect(result.charges).toBe(2);
    expect(result.nextChargeAt).toBeNull();
  });
});

describe('Carnet de charges — service', () => {
  it('Archi §2.6 — un compte neuf démarre au plafond', async () => {
    const { userId } = await signUp();

    const snapshot = await readCharges(db, userId);

    expect(snapshot.charges).toBe(6);
    expect(snapshot.cap).toBe(6);
    expect(snapshot.nextChargeAt).toBeNull();
    expect(snapshot.regenMs).toBe(REGEN);
  });

  it('Archi §2.6 — une charge créditée avance last_regen_at d’exactement un délai', async () => {
    const { userId } = await signUp();
    const stored = new Date(Date.now() - 1.5 * REGEN);
    await seedLedger(userId, 2, stored);

    const snapshot = await readCharges(db, userId);

    expect(snapshot.charges).toBe(3);

    const row = await ledgerRow(userId);
    expect(row.last_regen_at.getTime()).toBe(stored.getTime() + REGEN);
  });

  it('Archi §2.6 — le plafond est lu dans game_config', async () => {
    await setConfig('SCRATCH_CHARGE_CAP', 8);
    try {
      const { userId } = await signUp();

      const snapshot = await readCharges(db, userId);

      expect(snapshot.cap).toBe(8);
      expect(snapshot.charges).toBe(6);
    } finally {
      await setConfig('SCRATCH_CHARGE_CAP', 6);
    }
  });

  it('Archi §2.6 — dépenser depuis le plafond arme le compte à rebours', async () => {
    const { userId } = await signUp();
    const before = Date.now();

    const snapshot = await consumeCharge(db, userId);
    const after = Date.now();

    expect(snapshot.charges).toBe(5);
    if (snapshot.nextChargeAt === null) throw new Error('compte à rebours non armé');
    expect(snapshot.nextChargeAt.getTime()).toBeGreaterThanOrEqual(before + REGEN);
    expect(snapshot.nextChargeAt.getTime()).toBeLessThanOrEqual(after + REGEN);
  });

  it('Archi §2.6 — deux dépenses concurrentes avec une charge : une seule passe', async () => {
    const { userId } = await signUp();
    await seedLedger(userId, 1, new Date());

    const results = await Promise.allSettled([
      db.transaction().execute((trx) => consumeCharge(trx, userId)),
      db.transaction().execute((trx) => consumeCharge(trx, userId)),
    ]);

    const successes = results.filter((result) => result.status === 'fulfilled');
    const failures = results.filter((result) => result.status === 'rejected');

    expect(successes.length).toBe(1);
    expect(failures.length).toBe(1);

    const reason = failures[0]?.status === 'rejected' ? failures[0].reason : undefined;
    const httpError = reason as { status?: number; code?: string } | undefined;
    expect(httpError?.status).toBe(409);
    expect(httpError?.code).toBe('NO_CHARGE_LEFT');

    const row = await ledgerRow(userId);
    expect(row.charges).toBe(0);
  });

  it('Archi §2.6 — une clé de configuration absente lève 503 GAME_CONFIG_MISSING', async () => {
    const { userId } = await signUp();
    await db.deleteFrom('game_config').where('key', '=', 'SCRATCH_CHARGE_CAP').execute();

    try {
      const failure = await readCharges(db, userId).then(
        () => null,
        (error: unknown) => error,
      );

      const httpError = failure as { status?: number; code?: string } | null;
      expect(httpError?.status).toBe(503);
      expect(httpError?.code).toBe('GAME_CONFIG_MISSING');
    } finally {
      await setConfig('SCRATCH_CHARGE_CAP', 6);
    }
  });

  it('Archi §2.6 — les charges de départ sont plafonnées', async () => {
    await setConfig('SCRATCH_START_CHARGES', 9);
    try {
      const { userId } = await signUp();

      const snapshot = await readCharges(db, userId);

      expect(snapshot.charges).toBe(6);
    } finally {
      await setConfig('SCRATCH_START_CHARGES', 6);
    }
  });
});

describe('Carnet de charges — API', () => {
  it('Archi §2.6 — GET /api/v1/charges rend le carnet complet', async () => {
    const { cookie } = await signUp();

    const body = await chargeBody(cookie);

    expect(body).toEqual({ charges: 6, cap: 6, nextChargeAt: null, regenMs: 1_800_000 });
  });

  it('Archi §2.6 — GET /api/v1/charges refuse une requête sans session', async () => {
    const res = await authFetch('/api/v1/charges');

    expect(res.status).toBe(401);
    const body = (await res.json()) as ErrorBody;
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('Archi §2.6 — générer un ticket décrémente le carnet', async () => {
    const { cookie } = await signUp();

    await createTicket(cookie);
    const body = await chargeBody(cookie);

    expect(body.charges).toBe(5);
    expect(body.nextChargeAt).not.toBeNull();
    expect(body.regenMs).toBe(1_800_000);
  });

  it('Archi §2.6 — un carnet vide refuse la génération sans créer de carte', async () => {
    const { cookie, userId } = await signUp();
    await seedLedger(userId, 0, new Date());

    const res = await authFetch('/api/v1/tickets', { method: 'POST' }, cookie);

    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorBody;
    expect(body.code).toBe('NO_CHARGE_LEFT');
    expect(body.message).toBe('Aucune charge disponible : votre prochaine charge arrive bientôt.');

    const cards = await db
      .selectFrom('user_cards')
      .select('id')
      .where('user_id', '=', userId)
      .execute();
    expect(cards.length).toBe(0);
  });

  it('Archi §2.6 — un ticket déjà actif laisse le solde intact', async () => {
    const { cookie, userId } = await signUp();
    await createTicket(cookie);
    const before = await ledgerRow(userId);

    const res = await authFetch('/api/v1/tickets', { method: 'POST' }, cookie);

    expect(res.status).toBe(409);
    const body = (await res.json()) as ErrorBody;
    expect(body.code).toBe('TICKET_ALREADY_ACTIVE');

    const after = await ledgerRow(userId);
    expect(after.charges).toBe(before.charges);
    expect(after.charges).toBe(5);
  });
});
