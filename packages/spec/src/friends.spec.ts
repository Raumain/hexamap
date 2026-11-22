import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '@hexamap/api/app';
import type { FriendshipStatus } from '@hexamap/db';
import { createDb, runMigrations, sql } from '@hexamap/db';

const db = createDb(process.env.DATABASE_URL ?? '');

const baseUrl = 'http://localhost:3000';
const origin = 'http://localhost:5174';

const prefix = crypto.randomUUID().slice(0, 8);
const createdUserIds: string[] = [];

interface FriendEntryBody {
  id: string;
  status: string;
  createdAt: string;
  player: { id: string; pseudo: string | null };
}

interface FriendListBody {
  friends: FriendEntryBody[];
  incoming: FriendEntryBody[];
  outgoing: FriendEntryBody[];
}

interface FriendRow {
  requester_id: string;
  addressee_id: string;
  status: FriendshipStatus;
  responded_at: Date | null;
}

let dailyCap: number | null = null;
let capOverridden = false;
let reopenMs = 0;

function extractSessionCookie(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0])
    .join('; ');
}

async function signUp(label: string): Promise<{ cookie: string; userId: string; pseudo: string }> {
  const pseudo = `${prefix}-${label}-${crypto.randomUUID().slice(0, 4)}`;
  const email = `spec-${prefix}-${crypto.randomUUID()}@hexamap.test`;
  const res = await app.handle(
    new Request(`${baseUrl}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin },
      body: JSON.stringify({
        email,
        password: 'motdepasse-123',
        name: 'Spec',
        pseudo,
      }),
    }),
  );
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  const body = (await res.json()) as { user: { id: string } };
  const cookie = extractSessionCookie(res);
  createdUserIds.push(body.user.id);
  return { cookie, userId: body.user.id, pseudo };
}

async function authFetch(path: string, init: RequestInit = {}, cookie?: string): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('origin')) headers.set('origin', origin);
  if (cookie) headers.set('cookie', cookie);
  return app.handle(new Request(`${baseUrl}${path}`, { ...init, headers }));
}

function jsonBody(init: { method: string; body: unknown }): RequestInit {
  return {
    method: init.method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(init.body),
  };
}

async function getFriends(cookie: string): Promise<FriendListBody> {
  const res = await authFetch('/api/v1/friends', {}, cookie);
  expect(res.status).toBe(200);
  return (await res.json()) as FriendListBody;
}

async function sendRequest(cookie: string, pseudo: string): Promise<Response> {
  return authFetch(
    '/api/v1/friends/requests',
    jsonBody({ method: 'POST', body: { pseudo } }),
    cookie,
  );
}

async function acceptRequest(cookie: string, id: string): Promise<Response> {
  return authFetch(`/api/v1/friends/requests/${id}/accept`, { method: 'POST' }, cookie);
}

async function declineRequest(cookie: string, id: string): Promise<Response> {
  return authFetch(`/api/v1/friends/requests/${id}/decline`, { method: 'POST' }, cookie);
}

async function removeFriend(cookie: string, id: string): Promise<Response> {
  return authFetch(`/api/v1/friends/${id}`, { method: 'DELETE' }, cookie);
}

async function blockPlayer(cookie: string, userId: string): Promise<Response> {
  return authFetch('/api/v1/blocks', jsonBody({ method: 'POST', body: { userId } }), cookie);
}

async function pairRows(a: string, b: string): Promise<FriendRow[]> {
  return db
    .selectFrom('friendships')
    .select(['requester_id', 'addressee_id', 'status', 'responded_at'])
    .where(sql<boolean>`least(requester_id, addressee_id) = least(${a}::text, ${b}::text)`)
    .where(sql<boolean>`greatest(requester_id, addressee_id) = greatest(${a}::text, ${b}::text)`)
    .execute();
}

async function requestRow(cookie: string, pseudo: string): Promise<Response> {
  return sendRequest(cookie, pseudo);
}

async function acceptedPair(label: string): Promise<{
  a: { cookie: string; userId: string; pseudo: string };
  b: { cookie: string; userId: string; pseudo: string };
}> {
  const a = await signUp(`${label}-a`);
  const b = await signUp(`${label}-b`);
  const sent = await requestRow(a.cookie, b.pseudo);
  expect(sent.status).toBe(201);
  const accepted = await acceptRequest(b.cookie, a.userId);
  expect(accepted.status).toBe(200);
  return { a, b };
}

async function setDailyCap(value: number): Promise<void> {
  await sql`update game_config set value = ${value}::jsonb where key = 'FRIEND_REQUEST_DAILY_CAP'`.execute(
    db,
  );
}

beforeAll(async () => {
  await runMigrations(db);
  const cap = await db
    .selectFrom('game_config')
    .select('value')
    .where('key', '=', 'FRIEND_REQUEST_DAILY_CAP')
    .executeTakeFirst();
  dailyCap = cap ? Number(cap.value) : null;
  const reopen = await db
    .selectFrom('game_config')
    .select('value')
    .where('key', '=', 'FRIEND_REQUEST_REOPEN_MS')
    .executeTakeFirst();
  reopenMs = reopen ? Number(reopen.value) : 0;
});

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.deleteFrom('friendships').where('requester_id', 'in', createdUserIds).execute();
    await db.deleteFrom('friendships').where('addressee_id', 'in', createdUserIds).execute();
    await db.deleteFrom('blocks').where('blocker_id', 'in', createdUserIds).execute();
    await db.deleteFrom('blocks').where('blocked_id', 'in', createdUserIds).execute();
    await db.deleteFrom('user').where('id', 'in', createdUserIds).execute();
  }
  if (capOverridden && dailyCap !== null) {
    await setDailyCap(dailyCap);
  }
  const restored = await db
    .selectFrom('game_config')
    .select(sql<string>`jsonb_typeof(value)`.as('kind'))
    .where('key', '=', 'FRIEND_REQUEST_DAILY_CAP')
    .executeTakeFirst();
  expect(restored?.kind, 'Le plafond restauré doit être un nombre JSON.').toBe('number');
  await db.destroy();
});

describe('Phase 28 — Les Amis (architecture §2.9 / base §4.9)', () => {
  it('1 — une demande crée une ligne PENDING et apparaît dans les listes des deux joueurs', async () => {
    const a = await signUp('d1-a');
    const b = await signUp('d1-b');

    const res = await sendRequest(a.cookie, b.pseudo);
    expect(res.status, 'Une demande valide doit être créée (201).').toBe(201);
    const body = (await res.json()) as { request: FriendEntryBody };
    expect(body.request.status).toBe('PENDING');
    expect(body.request.id).toBe(b.userId);
    expect(body.request.player.id).toBe(b.userId);
    expect(typeof body.request.createdAt).toBe('string');
    expect(Number.isNaN(Date.parse(body.request.createdAt))).toBe(false);

    const rows = await pairRows(a.userId, b.userId);
    expect(rows, 'La paire ne doit produire qu’une seule ligne.').toHaveLength(1);
    expect(rows[0]?.status).toBe('PENDING');

    const fromA = await getFriends(a.cookie);
    expect(fromA.outgoing.map((entry) => entry.id)).toEqual([b.userId]);
    expect(fromA.friends).toHaveLength(0);

    const fromB = await getFriends(b.cookie);
    expect(fromB.incoming.map((entry) => entry.id)).toEqual([a.userId]);
    expect(fromB.friends).toHaveLength(0);
  });

  it('2 — l’acceptation rend les deux joueurs amis et la ligne passe ACCEPTED', async () => {
    const a = await signUp('d2-a');
    const b = await signUp('d2-b');
    expect((await sendRequest(a.cookie, b.pseudo)).status).toBe(201);

    const res = await acceptRequest(b.cookie, a.userId);
    expect(res.status, 'Le destinataire accepte la demande (200).').toBe(200);
    const body = (await res.json()) as { request: FriendEntryBody };
    expect(body.request.status).toBe('ACCEPTED');
    expect(body.request.id).toBe(a.userId);

    const rows = await pairRows(a.userId, b.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('ACCEPTED');
    expect(rows[0]?.responded_at).not.toBeNull();

    expect((await getFriends(a.cookie)).friends.map((entry) => entry.id)).toEqual([b.userId]);
    expect((await getFriends(b.cookie)).friends.map((entry) => entry.id)).toEqual([a.userId]);
  });

  it('3 — une demande croisée sur une ligne PENDING inversée vaut acceptation mutuelle', async () => {
    const a = await signUp('d3-a');
    const b = await signUp('d3-b');
    expect((await sendRequest(a.cookie, b.pseudo)).status).toBe(201);

    const res = await sendRequest(b.cookie, a.pseudo);
    expect(res.status, 'Deux consentements valent acceptation (200).').toBe(200);
    const body = (await res.json()) as { request: FriendEntryBody };
    expect(body.request.status).toBe('ACCEPTED');

    const rows = await pairRows(a.userId, b.userId);
    expect(rows, 'La paire ne doit jamais porter deux lignes.').toHaveLength(1);
    expect(rows[0]?.status).toBe('ACCEPTED');
  });

  it('4 — une auto-demande renvoie 400 SELF_FRIENDSHIP', async () => {
    const a = await signUp('d4');
    const res = await sendRequest(a.cookie, a.pseudo);
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('SELF_FRIENDSHIP');
    expect(body.message).toBe('Vous ne pouvez pas vous ajouter vous-même.');
    expect(await pairRows(a.userId, a.userId)).toHaveLength(0);
  });

  it('5 — un pseudo inconnu renvoie 404 PLAYER_NOT_FOUND', async () => {
    const a = await signUp('d5');
    const res = await sendRequest(a.cookie, `${prefix}-fantome`);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('PLAYER_NOT_FOUND');
    expect(body.message).toBe('Ce joueur est introuvable.');
  });

  it('6 — un refus conserve une ligne DECLINED et pose responded_at', async () => {
    const a = await signUp('d6-a');
    const b = await signUp('d6-b');
    expect((await sendRequest(a.cookie, b.pseudo)).status).toBe(201);

    const res = await declineRequest(b.cookie, a.userId);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { request: FriendEntryBody };
    expect(body.request.status).toBe('DECLINED');

    const rows = await pairRows(a.userId, b.userId);
    expect(rows, 'Un refus ne supprime pas la ligne.').toHaveLength(1);
    expect(rows[0]?.status).toBe('DECLINED');
    expect(rows[0]?.responded_at).not.toBeNull();

    expect((await getFriends(a.cookie)).friends).toHaveLength(0);
    expect((await getFriends(b.cookie)).friends).toHaveLength(0);
  });

  it('7 — un demandeur ne peut pas rouvrir une demande déclinée trop tôt', async () => {
    const a = await signUp('d7-a');
    const b = await signUp('d7-b');
    expect((await sendRequest(a.cookie, b.pseudo)).status).toBe(201);
    expect((await declineRequest(b.cookie, a.userId)).status).toBe(200);

    const res = await sendRequest(a.cookie, b.pseudo);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('FRIEND_REQUEST_REOPEN_TOO_SOON');
    expect(body.message).toBe('Cette demande a été déclinée récemment. Réessayez plus tard.');
    expect((await pairRows(a.userId, b.userId))[0]?.status).toBe('DECLINED');
  });

  it('8 — une demande déclinée peut être rouverte après FRIEND_REQUEST_REOPEN_MS', async () => {
    const a = await signUp('d8-a');
    const b = await signUp('d8-b');
    expect((await sendRequest(a.cookie, b.pseudo)).status).toBe(201);
    expect((await declineRequest(b.cookie, a.userId)).status).toBe(200);

    const seconds = (reopenMs + 1000) / 1000;
    await sql`update friendships set responded_at = now() - make_interval(secs => ${seconds}::double precision)
      where requester_id = ${a.userId} and addressee_id = ${b.userId}`.execute(db);

    const res = await sendRequest(a.cookie, b.pseudo);
    expect(res.status, 'La réouverture rouvre la ligne, elle n’en crée pas.').toBe(200);
    const body = (await res.json()) as { request: FriendEntryBody };
    expect(body.request.status).toBe('PENDING');

    const rows = await pairRows(a.userId, b.userId);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('PENDING');
    expect(rows[0]?.responded_at).toBeNull();
  });

  it('9 — retirer un ami supprime la ligne et la relation des deux côtés', async () => {
    const { a, b } = await acceptedPair('d9');
    expect((await getFriends(a.cookie)).friends).toHaveLength(1);

    const res = await removeFriend(a.cookie, b.userId);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ removed: true });

    expect(await pairRows(a.userId, b.userId)).toHaveLength(0);
    expect((await getFriends(a.cookie)).friends).toHaveLength(0);
    expect((await getFriends(b.cookie)).friends).toHaveLength(0);
  });

  it('10 — un blocage supprime la relation existante dans les deux sens', async () => {
    const { a, b } = await acceptedPair('d10');
    expect((await getFriends(a.cookie)).friends).toHaveLength(1);

    const res = await blockPlayer(a.cookie, b.userId);
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ blocked: true });

    expect(await pairRows(a.userId, b.userId)).toHaveLength(0);
    expect((await getFriends(a.cookie)).friends).toHaveLength(0);
    expect((await getFriends(b.cookie)).friends).toHaveLength(0);

    const blocks = await db
      .selectFrom('blocks')
      .select(['blocker_id', 'blocked_id'])
      .where('blocker_id', '=', a.userId)
      .where('blocked_id', '=', b.userId)
      .execute();
    expect(blocks).toHaveLength(1);
  });

  it('11 — un joueur bloqué ne peut plus envoyer de demande (409 FRIENDSHIP_BLOCKED)', async () => {
    const a = await signUp('d11-a');
    const b = await signUp('d11-b');
    expect((await blockPlayer(a.cookie, b.userId)).status).toBe(201);

    const res = await sendRequest(b.cookie, a.pseudo);
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('FRIENDSHIP_BLOCKED');
    expect(body.message).toBe('Cette relation est indisponible.');
    expect(await pairRows(a.userId, b.userId)).toHaveLength(0);
  });

  it('12 — le plafond quotidien renvoie 429 FRIEND_REQUEST_CAP_REACHED', async () => {
    const sender = await signUp('d12-s');
    const first = await signUp('d12-a');
    const second = await signUp('d12-b');
    const third = await signUp('d12-c');
    capOverridden = true;
    await setDailyCap(2);

    try {
      expect((await sendRequest(sender.cookie, first.pseudo)).status).toBe(201);
      expect((await sendRequest(sender.cookie, second.pseudo)).status).toBe(201);

      const res = await sendRequest(sender.cookie, third.pseudo);
      expect(res.status, 'Le troisième envoi dépasse le plafond de deux.').toBe(429);
      const body = (await res.json()) as { code: string; message: string };
      expect(body.code).toBe('FRIEND_REQUEST_CAP_REACHED');
      expect(body.message).toBe('Vous avez atteint le nombre de demandes du jour.');
      expect(await pairRows(sender.userId, third.userId)).toHaveLength(0);
    } finally {
      await setDailyCap(dailyCap ?? 20);
    }
  });

  it('13 — GET /friends sans cookie renvoie 401 UNAUTHORIZED', async () => {
    const res = await authFetch('/api/v1/friends');
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('14 — un refus ne se contourne pas par DELETE : la ligne reste et le délai tient', async () => {
    const a = await signUp('d14-a');
    const b = await signUp('d14-b');
    expect((await sendRequest(a.cookie, b.pseudo)).status).toBe(201);
    expect((await declineRequest(b.cookie, a.userId)).status).toBe(200);

    const removed = await removeFriend(a.cookie, b.userId);
    expect(removed.status, 'Une ligne déclinée ne se supprime pas.').toBe(404);
    const body = (await removed.json()) as { code: string; message: string };
    expect(body.code).toBe('FRIENDSHIP_NOT_FOUND');
    expect(body.message).toBe('Aucune relation avec ce joueur.');

    const rows = await pairRows(a.userId, b.userId);
    expect(rows, 'Le refus doit rester en base après le DELETE.').toHaveLength(1);
    expect(rows[0]?.status).toBe('DECLINED');

    const again = await sendRequest(a.cookie, b.pseudo);
    expect(again.status, 'Le DELETE ne doit pas rouvrir la demande.').toBe(409);
    expect(((await again.json()) as { code: string }).code).toBe('FRIEND_REQUEST_REOPEN_TOO_SOON');
  });

  it('15 — une demande reçue se refuse, elle ne s’annule pas ; le demandeur peut annuler', async () => {
    const a = await signUp('d15-a');
    const b = await signUp('d15-b');
    expect((await sendRequest(a.cookie, b.pseudo)).status).toBe(201);

    const refused = await removeFriend(b.cookie, a.userId);
    expect(refused.status, 'Le destinataire ne peut pas annuler une demande reçue.').toBe(409);
    const body = (await refused.json()) as { code: string; message: string };
    expect(body.code).toBe('FRIEND_REQUEST_NOT_CANCELLABLE');
    expect(body.message).toBe("Une demande reçue se refuse, elle ne s'annule pas.");

    const pending = await pairRows(a.userId, b.userId);
    expect(pending, 'La demande reçue doit rester en attente.').toHaveLength(1);
    expect(pending[0]?.status).toBe('PENDING');

    const cancelled = await removeFriend(a.cookie, b.userId);
    expect(cancelled.status, 'Le demandeur peut annuler sa propre demande.').toBe(200);
    expect(await cancelled.json()).toEqual({ removed: true });
    expect(await pairRows(a.userId, b.userId)).toHaveLength(0);
  });

  it('16 — un refus A→B laisse B sans réouverture possible : 409 FRIENDSHIP_DECLINED', async () => {
    const a = await signUp('d16-a');
    const b = await signUp('d16-b');
    expect((await sendRequest(a.cookie, b.pseudo)).status).toBe(201);
    expect((await declineRequest(b.cookie, a.userId)).status).toBe(200);

    // B n'est pas le demandeur d'origine : le contrat §2.9 réserve la réouverture à A,
    // donc aucun délai ne lui ouvrira cette porte — le code doit le dire, pas mentir.
    const res = await sendRequest(b.cookie, a.pseudo);
    expect(res.status, 'Un refus ne se retourne pas contre son auteur.').toBe(409);
    const body = (await res.json()) as { code: string; message: string };
    expect(body.code).toBe('FRIENDSHIP_DECLINED');
    expect(body.message).toBe('Cette demande a été refusée.');

    const rows = await pairRows(a.userId, b.userId);
    expect(rows, 'Aucune réouverture inversée ne doit être écrite.').toHaveLength(1);
    expect(rows[0]?.status).toBe('DECLINED');
    expect(rows[0]?.requester_id).toBe(a.userId);
  });

  it('17 — la base refuse une paire inversée en double et une auto-relation', async () => {
    const a = await signUp('d17-a');
    const b = await signUp('d17-b');
    expect((await sendRequest(a.cookie, b.pseudo)).status).toBe(201);

    // `pg` expose le SQLSTATE sur l'erreur : une assertion de code distingue la
    // contrainte violée d'une simple panne de connexion.
    const duplicate = db
      .insertInto('friendships')
      .values({ requester_id: b.userId, addressee_id: a.userId })
      .execute();
    await expect(duplicate, 'La paire inversée doit violer l’index unique.').rejects.toThrow();
    const duplicateError = await duplicate.catch((error: unknown) => error);
    expect((duplicateError as { code?: string }).code, '23505 = unique_violation.').toBe('23505');

    const selfRelation = db
      .insertInto('friendships')
      .values({ requester_id: a.userId, addressee_id: a.userId })
      .execute();
    await expect(selfRelation, 'Une auto-relation doit violer le CHECK.').rejects.toThrow();
    const selfError = await selfRelation.catch((error: unknown) => error);
    expect((selfError as { code?: string }).code, '23514 = check_violation.').toBe('23514');

    const rows = await pairRows(a.userId, b.userId);
    expect(rows, 'Aucune insertion refusée ne doit laisser de trace.').toHaveLength(1);
    expect(rows[0]?.status).toBe('PENDING');
  });

  it('18 — un pseudo entouré d’espaces est trimmé avant la recherche', async () => {
    const a = await signUp('t1-a');
    const b = await signUp('t1-b');

    const res = await sendRequest(a.cookie, `  ${b.pseudo}  `);
    expect(res.status, 'Les espaces de bord ne doivent pas faire échouer la recherche.').toBe(201);
    const body = (await res.json()) as { request: FriendEntryBody };
    expect(body.request.id).toBe(b.userId);
    expect((await pairRows(a.userId, b.userId))[0]?.status).toBe('PENDING');

    const blank = await sendRequest(a.cookie, '   ');
    expect(blank.status, 'Un pseudo vide après trim ne trouve personne.').toBe(404);
    expect(((await blank.json()) as { code: string }).code).toBe('PLAYER_NOT_FOUND');
  });

  // R-003 — « Un ami n'a pas de lien vers sa vitrine ». Le lien n'est offert que
  // lorsque la vitrine est publique, donc la charge utile de `/friends` doit porter
  // le drapeau : sans lui, l'écran ne peut pas distinguer un ami public d'un ami privé
  // et produirait un lien vers un `404` silencieux (architecture §2.9).
  interface FriendEntryWithFlag {
    id: string;
    player: { id: string; pseudo: string | null; profile_public: boolean };
  }

  async function friendsWithFlag(cookie: string): Promise<FriendEntryWithFlag[]> {
    const res = await authFetch('/api/v1/friends', {}, cookie);
    expect(res.status).toBe(200);
    return ((await res.json()) as { friends: FriendEntryWithFlag[] }).friends;
  }

  it('19 — GET /friends rend `profile_public`, vrai quand aucune ligne de profil n’existe', async () => {
    const { a, b } = await acceptedPair('r3-pub');

    const entry = (await friendsWithFlag(a.cookie)).find((item) => item.id === b.userId);
    expect(entry, 'L’ami accepté doit figurer dans « Mes amis ».').toBeDefined();
    expect(
      entry?.player.profile_public,
      'Sans ligne `user_profiles`, le profil est public : c’est le défaut SQL (base §4.9).',
    ).toBe(true);
    expect(
      typeof entry?.player.profile_public,
      'Le schéma `response` est fermé : un drapeau non déclaré serait retiré de la charge utile.',
    ).toBe('boolean');

    await db
      .insertInto('user_profiles')
      .values({ user_id: b.userId, bio: null, profile_public: true })
      .execute();

    const after = (await friendsWithFlag(a.cookie)).find((item) => item.id === b.userId);
    expect(after?.player.profile_public, 'Une ligne explicite à `true` reste publique.').toBe(true);
  });

  it('20 — GET /friends rend `profile_public` faux quand la vitrine est fermée', async () => {
    const { a, b } = await acceptedPair('r3-prv');

    await db
      .insertInto('user_profiles')
      .values({ user_id: b.userId, bio: null, profile_public: false })
      .execute();

    const entry = (await friendsWithFlag(a.cookie)).find((item) => item.id === b.userId);
    expect(entry?.player.profile_public, 'Un profil fermé doit être rendu `false`.').toBe(false);

    const other = (await friendsWithFlag(b.cookie)).find((item) => item.id === a.userId);
    expect(
      other?.player.profile_public,
      'Le drapeau est celui du joueur visé, pas celui du lecteur.',
    ).toBe(true);
  });
});
