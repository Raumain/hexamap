---
status: pending
---

# Instruction: Service et routes API

## Architecture projection

```txt
.
├── ✏️ apps/api/src/app.ts
├── ✅ apps/api/src/routes/friends.ts
└── ✅ apps/api/src/services/friends.ts
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | deux comptes, aucun lien | `GET /friends` rend trois listes vides | api |
| Happy path | demande puis acceptation | `ACCEPTED` des deux côtés, une seule ligne | api |
| Edge case | croisée / auto / refus / blocage / plafond | codes `400`, `404`, `409`, `429` stables | api |
| Teardown | suppression des comptes | cascade sur `friendships` et `blocks` | api |

## Tasks to do

### `1)` Service

> Toute la règle vit ici, une seule fois.

1. `apps/api/src/services/friends.ts` : `readGameConfigNumber(db, key)` (lecture `game_config`, `Number(value)`, `throw new Error` explicite si la clé manque ou n'est pas un nombre).
2. `findPlayerByPseudo(db, pseudo)` : comparaison insensible à la casse, bornée à deux lignes ; 0 ligne → `null`, 2 lignes → `null` (pseudo ambigu, la phase 29 ajoutera l'index unique).
3. `pairOf(a, b)` : `{ requester_id, addressee_id }` normalisés par ordre lexicographique pour les **lectures** ; l'écriture conserve l'orientation d'origine.
4. `isBlockedBetween(db, a, b)` : une seule requête sur les deux orientations.
5. `listFriends(db, userId)` : trois requêtes (amis `ACCEPTED`, reçues `PENDING` avec `addressee_id = userId`, envoyées `PENDING` avec `requester_id = userId`), jointure sur `"user"` pour `pseudo`, `orderBy(created_at desc)`.
6. `sendRequest(db, userId, targetId)` : refus si `userId === targetId` ; `isBlockedBetween` → `BLOCKED` ; ligne existante → `EXISTS` si `ACCEPTED`, `REOPEN_TOO_SOON` si `DECLINED` et `responded_at + reopenMs > now`, sinon remise en `PENDING` (`responded_at = null`) ; ligne inversée `PENDING` → acceptation mutuelle ; sinon plafond (comptage du jour) puis insertion.
7. `acceptRequest` / `declineRequest` : la ligne doit exister en `PENDING` avec `addressee_id = userId`, sinon `NOT_FOUND` ; acceptation pose `ACCEPTED` + `responded_at`, refus pose `DECLINED` + `responded_at`.
8. `removeFriend(db, userId, otherId)` : supprime la ligne de la paire quel que soit le sens et le statut ; aucune ligne → `NOT_FOUND`.
9. `blockPlayer(db, userId, targetId)` : auto-blocage refusé ; **dans une transaction** insertion `on conflict do nothing` de `blocks` + suppression de la ligne de paire dans les deux sens.
10. Le service rend des résultats typés (`{ ok: true, … }` / `{ ok: false, code }`), jamais des `Response` : les codes HTTP vivent dans le routeur.

### `2)` Routeur

> Schémas `response` TypeBox obligatoires, codes stables, messages français.

1. `apps/api/src/routes/friends.ts` : `export const friendRoutes = new Elysia({ name: 'routes.friends' }).use(authPlugin)`.
2. `GET /friends` → `200 { friends, incoming, outgoing }` ; chaque entrée `{ id, status, createdAt, player: { id, pseudo } }` ; `401` en erreur.
3. `POST /friends/requests` body `{ pseudo }` → `201 { request }` (création) ou `200 { request }` avec `status: 'ACCEPTED'` (absorption) ; `400 SELF_FRIENDSHIP`, `404 PLAYER_NOT_FOUND`, `409 FRIENDSHIP_EXISTS`, `409 FRIENDSHIP_BLOCKED`, `409 FRIEND_REQUEST_REOPEN_TOO_SOON`, `429 FRIEND_REQUEST_CAP_REACHED`.
4. `POST /friends/requests/:id/accept` et `.../decline` → `200 { request }` ; `404 FRIENDSHIP_NOT_FOUND` si aucune demande en attente entrante.
5. `DELETE /friends/:id` → `200 { removed: true }` ; `404 FRIENDSHIP_NOT_FOUND`.
6. `POST /blocks` body `{ userId }` → `201 { blocked: true }` ; `400 SELF_BLOCK`, `404 PLAYER_NOT_FOUND`.
7. `apps/api/src/app.ts` : `.use(friendRoutes)` dans `protectedRoutes`, après `marketRoutes`.
8. Aucune modification de `lib/http-error.ts` ni d'une route existante.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1-2 | `bun test packages/spec/src/friends.spec.ts` : les treize cas de la phase 1 sont verts |
| 2 | `bun run typecheck` propre : les schémas `response` alimentent Eden sans `any` |
| 2 | Aucune duplication de la formule de paire : `least`/`greatest` n'apparaît qu'en migration |
