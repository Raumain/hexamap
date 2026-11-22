/**
 * Second compte du banc E2E : un joueur **réel**, inscrit par l'API, avec une
 * session réutilisable et une carte à lui.
 *
 * `global-setup.ts` n'inscrivait qu'un seul joueur, et `market-fixture.ts` ne
 * semait qu'une ligne SQL sans mot de passe ni `account` : ce vendeur ne pouvait
 * jamais être connecté. Or plusieurs parcours de la v2 exigent deux sessions
 * simultanées — accepter une demande d'ami, troquer, observer la vitrine d'un
 * autre compte. Le compte créé ici passe donc par la vraie route
 * d'inscription, et son `storageState` a la même forme que celui du compte
 * principal : `test.use({ storageState })` peut le consommer tel quel.
 *
 * Le fichier est importable depuis `global-setup.ts` sans effet de bord : la
 * création n'a lieu que si la fonction est appelée, ou si le fichier est
 * exécuté directement.
 */

import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type APIRequestContext, type APIResponse, request } from '@playwright/test';
import { createDb } from '../../db/src/index';

// Le fichier vit dans `fixtures/`, un cran sous la racine du paquet — et non
// dans `tests/fixtures/`, qui en demande deux.
const e2ePackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const secondAuthDirectory = path.join(e2ePackageRoot, '.auth');

/** État enregistré du second compte, consommable par `use.storageState`. */
export const secondStorageStatePath = path.join(secondAuthDirectory, 'second.json');

/** Identité du compte pour les specs : identifiant, pseudo et carte obtenue. */
export const secondAccountPath = path.join(secondAuthDirectory, 'second-account.json');

/**
 * Identifiants fixes : le compte doit survivre d'une exécution à l'autre, sans
 * quoi un rejeu créerait un second joueur. Le pseudo est unique sans tenir
 * compte de la casse (`user_pseudo_lower_idx`), donc il reste stable.
 */
export const SECOND_ACCOUNT = {
  email: 'second-e2e@hexamap.test',
  password: 'Second-E2E-2026!9',
  pseudo: 'e2e-second',
} as const;

/** Commune du référentiel E2E : `${PREFIX}-C-${rarete}-${district}`. */
const CARD_REF = 'E2E-C-RARE-0';
const CARD_SCORE = 1000;

export interface SecondAccountFixture {
  userId: string;
  pseudo: string;
  email: string;
  password: string;
  cardId: string;
}

interface StorageCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Lax';
}

interface StorageState {
  cookies: StorageCookie[];
  origins: { origin: string; localStorage: { name: string; value: string }[] }[];
}

/**
 * Inscrit le second compte (ou le reconnecte s'il existe déjà), enregistre sa
 * session et lui garantit une carte. Idempotent : deux exécutions laissent le
 * même joueur, la même carte et aucun doublon.
 */
export async function ensureSecondAccount(options: {
  baseURL: string;
}): Promise<SecondAccountFixture> {
  const { baseURL } = options;
  const context = await request.newContext({ baseURL, ignoreHTTPSErrors: true });
  let db: ReturnType<typeof createDb> | null = null;

  try {
    const authenticated = await authenticate(context, baseURL);
    const { cookieHeader, cookies } = sessionCookies(authenticated, baseURL);
    const userId = await resolveUserId(context, cookieHeader);

    db = createDb(databaseUrl());
    const cardId = await ensureCard(db, userId);

    await mkdir(secondAuthDirectory, { recursive: true });

    const state: StorageState = { cookies, origins: [] };
    await writeFile(secondStorageStatePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8');

    const fixture: SecondAccountFixture = {
      userId,
      pseudo: SECOND_ACCOUNT.pseudo,
      email: SECOND_ACCOUNT.email,
      password: SECOND_ACCOUNT.password,
      cardId,
    };
    await writeFile(secondAccountPath, `${JSON.stringify(fixture, null, 2)}\n`, 'utf8');

    return fixture;
  } finally {
    await context.dispose();
    if (db !== null) await db.destroy();
  }
}

/** Inscription par la vraie route ; la connexion prend le relais si le compte existe. */
async function authenticate(context: APIRequestContext, baseURL: string): Promise<APIResponse> {
  const headers = { origin: baseURL };

  const signUp = await context.post('/api/auth/sign-up/email', {
    headers,
    data: {
      email: SECOND_ACCOUNT.email,
      password: SECOND_ACCOUNT.password,
      name: SECOND_ACCOUNT.pseudo,
      pseudo: SECOND_ACCOUNT.pseudo,
    },
  });

  if (signUp.ok()) return signUp;

  const signIn = await context.post('/api/auth/sign-in/email', {
    headers,
    data: { email: SECOND_ACCOUNT.email, password: SECOND_ACCOUNT.password },
  });

  if (signIn.ok()) return signIn;

  throw new Error(
    `Second compte E2E inutilisable : inscription refusée (statut ${signUp.status()}) ` +
      `et connexion refusée (statut ${signIn.status()}).`,
  );
}

/**
 * Cookies de session rendus par la réponse d'authentification, convertis dans
 * la forme attendue par Playwright. `headersArray()` est le seul accès sûr :
 * plusieurs `Set-Cookie` y restent séparés, alors qu'un `Expires` contient une
 * virgule qui casserait un découpage naïf.
 */
function sessionCookies(
  response: APIResponse,
  baseURL: string,
): { cookieHeader: string; cookies: StorageCookie[] } {
  const domain = new URL(baseURL).hostname;
  const secure = new URL(baseURL).protocol === 'https:';
  const cookies: StorageCookie[] = [];

  for (const header of response.headersArray()) {
    if (header.name.toLowerCase() !== 'set-cookie') continue;
    const parsed = parseSetCookie(header.value, { domain, secure });
    if (parsed !== null) cookies.push(parsed);
  }

  if (cookies.length === 0) {
    throw new Error(
      'La réponse d’authentification du second compte E2E ne porte aucun cookie de session.',
    );
  }

  const cookieHeader = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ');
  return { cookieHeader, cookies };
}

function parseSetCookie(
  raw: string,
  options: { domain: string; secure: boolean },
): StorageCookie | null {
  const [pair, ...attributes] = raw.split(';');
  if (pair === undefined) return null;

  const separator = pair.indexOf('=');
  if (separator <= 0) return null;

  const name = pair.slice(0, separator).trim();
  const value = pair.slice(separator + 1).trim();
  if (name.length === 0) return null;

  return {
    name,
    value,
    domain: options.domain,
    path: '/',
    expires: expiresOf(attributes),
    httpOnly: true,
    secure: options.secure,
    sameSite: 'Lax',
  };
}

/** `-1` désigne un cookie de session ; `Max-Age` prime sur `Expires`. */
function expiresOf(attributes: string[]): number {
  let maxAge: number | null = null;
  let expires: number | null = null;

  for (const attribute of attributes) {
    const [rawKey, rawValue] = attribute.split('=');
    const key = rawKey?.trim().toLowerCase() ?? '';
    const value = rawValue?.trim() ?? '';

    if (key === 'max-age') {
      const seconds = Number.parseInt(value, 10);
      if (Number.isFinite(seconds)) maxAge = seconds;
    }

    if (key === 'expires') {
      const timestamp = Date.parse(attribute.slice(attribute.indexOf('=') + 1).trim());
      if (Number.isFinite(timestamp)) expires = Math.floor(timestamp / 1000);
    }
  }

  if (maxAge !== null) return Math.floor(Date.now() / 1000) + maxAge;
  if (expires !== null) return expires;
  return -1;
}

async function resolveUserId(context: APIRequestContext, cookieHeader: string): Promise<string> {
  const response = await context.get('/api/auth/get-session', {
    headers: { cookie: cookieHeader },
  });

  if (!response.ok()) {
    throw new Error(
      `Lecture de session impossible pour le second compte E2E (statut ${response.status()}).`,
    );
  }

  const userId = userIdOf(await response.json());

  if (userId === null) {
    throw new Error(
      'Session du second compte E2E sans identifiant utilisateur : sa carte ne peut pas être semée.',
    );
  }

  return userId;
}

/** Extraction défensive : `get-session` rend `null` ou `{ user: { id } }`. */
function userIdOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;

  const user: unknown = Reflect.get(payload, 'user');
  if (typeof user !== 'object' || user === null) return null;

  const id: unknown = Reflect.get(user, 'id');
  return typeof id === 'string' && id.length > 0 ? id : null;
}

/**
 * Une carte, et une seule : suppression ciblée puis insertion, donc un rejeu ne
 * duplique rien. Les annonces du compte partent d'abord, sans quoi la carte
 * resterait référencée par une annonce ouverte.
 */
async function ensureCard(db: ReturnType<typeof createDb>, userId: string): Promise<string> {
  await db.deleteFrom('market_listings').where('seller_id', '=', userId).execute();
  await db.deleteFrom('user_cards').where('user_id', '=', userId).execute();

  const inserted = await db
    .insertInto('user_cards')
    .values({
      user_id: userId,
      category: 'COMMUNE',
      ref_code: CARD_REF,
      rarity: 'RARE',
      score: CARD_SCORE,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return inserted.id;
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error('DATABASE_URL manquant : le second compte E2E ne peut pas recevoir sa carte.');
  }

  return url;
}

export function readSecondAccountFixture(): SecondAccountFixture {
  try {
    return JSON.parse(readFileSync(secondAccountPath, 'utf8')) as SecondAccountFixture;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Second compte E2E introuvable (${secondAccountPath}). Le « globalSetup » n'a pas ` +
        `abouti : ${detail}`,
    );
  }
}

async function main(): Promise<void> {
  const fixture = await ensureSecondAccount({
    baseURL: process.env.E2E_BASE_URL ?? 'https://hexamap.test',
  });

  console.log(
    `[e2e] Second compte prêt : ${fixture.pseudo} (${secondStorageStatePath} → ${fixture.cardId}).`,
  );
}

// Garde d'exécution directe, sans effet de bord à l'import : Playwright charge ce
// module depuis `global-setup.ts`, et `process.argv[1]` y désigne son lanceur.
const entryPoint = process.argv[1];
const isDirectRun =
  entryPoint !== undefined && path.resolve(entryPoint) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
