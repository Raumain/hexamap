import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import { createDb, runMigrations } from '@hexamap/db';

const db = createDb(process.env.DATABASE_URL ?? '');

beforeAll(async () => {
  await runMigrations(db);
});

afterAll(async () => {
  await db.destroy();
});

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';

type MeUser = {
  id: string;
  name: string;
  email: string;
  pseudo: string;
  currency: number;
};

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

function signUpBody(email: string, pseudo?: string): string {
  const payload: Record<string, unknown> = {
    email,
    password: 'motdepasse-123',
    name: 'Spec',
  };
  if (pseudo !== undefined) {
    payload.pseudo = pseudo;
  }
  return JSON.stringify(payload);
}

describe('Phase 4 — authentification (archi §4.4)', () => {
  it('GET /api/v1/me sans cookie renvoie 401', async () => {
    const res = await app.handle(new Request(`${baseUrl}/api/v1/me`, { headers: { origin } }));
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/health sans cookie renvoie 200', async () => {
    const res = await app.handle(new Request(`${baseUrl}/api/v1/health`));
    expect(res.status).toBe(200);
  });

  it('inscription avec pseudo crée le compte avec currency = 0', async () => {
    const email = `spec-${crypto.randomUUID()}@hexamap.test`;
    const pseudo = 'spec-pseudo';

    const res = await app.handle(
      new Request(`${baseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: signUpBody(email, pseudo),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    const body = (await res.json()) as { user: MeUser };
    expect(body.user.pseudo).toBe(pseudo);
    expect(body.user.currency).toBe(0);

    const row = await db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirstOrThrow();
    expect(row.pseudo).toBe(pseudo);
    expect(row.currency).toBe(0);
  });

  it('inscription sans pseudo renvoie une erreur 4xx', async () => {
    const res = await app.handle(
      new Request(`${baseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: signUpBody(`spec-${crypto.randomUUID()}@hexamap.test`),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });

  it('currency fourni par le client reste 0 en base', async () => {
    const email = `spec-${crypto.randomUUID()}@hexamap.test`;

    const res = await app.handle(
      new Request(`${baseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({
          email,
          password: 'motdepasse-123',
          name: 'Spec',
          pseudo: 'spec-pseudo',
          currency: 9999,
        }),
      }),
    );
    expect(res.status).toBeGreaterThanOrEqual(200);
    expect(res.status).toBeLessThan(300);

    const row = await db
      .selectFrom('user')
      .selectAll()
      .where('email', '=', email)
      .executeTakeFirstOrThrow();
    expect(row.currency).toBe(0);
  });

  it('GET /api/v1/me avec le cookie de session renvoie 200 et les infos du user', async () => {
    const email = `spec-${crypto.randomUUID()}@hexamap.test`;
    const pseudo = 'spec-pseudo';

    const signUp = await app.handle(
      new Request(`${baseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: signUpBody(email, pseudo),
      }),
    );
    expect(signUp.status).toBeGreaterThanOrEqual(200);
    expect(signUp.status).toBeLessThan(300);

    const cookie = extractSessionCookie(signUp);
    expect(cookie.length).toBeGreaterThan(0);

    const res = await app.handle(
      new Request(`${baseUrl}/api/v1/me`, {
        headers: { cookie, origin },
      }),
    );
    expect(res.status).toBe(200);

    const body = (await res.json()) as { user: MeUser };
    expect(body.user.id).toBeTypeOf('string');
    expect(body.user.email).toBe(email);
    expect(body.user.pseudo).toBe(pseudo);
    expect(body.user.currency).toBe(0);
  });

  it('connexion par email ouvre une session utilisable', async () => {
    const email = `spec-${crypto.randomUUID()}@hexamap.test`;
    const password = 'motdepasse-123';
    const pseudo = 'spec-pseudo';

    const signUp = await app.handle(
      new Request(`${baseUrl}/api/auth/sign-up/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ email, password, name: 'Spec', pseudo }),
      }),
    );
    expect(signUp.status).toBeGreaterThanOrEqual(200);
    expect(signUp.status).toBeLessThan(300);

    const signIn = await app.handle(
      new Request(`${baseUrl}/api/auth/sign-in/email`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin },
        body: JSON.stringify({ email, password }),
      }),
    );
    expect(signIn.status).toBe(200);

    const cookie = extractSessionCookie(signIn);
    expect(cookie.length).toBeGreaterThan(0);

    const me = await app.handle(
      new Request(`${baseUrl}/api/v1/me`, { headers: { cookie, origin } }),
    );
    expect(me.status).toBe(200);

    const body = (await me.json()) as { user: MeUser };
    expect(body.user.email).toBe(email);
    expect(body.user.pseudo).toBe(pseudo);
  });
});
