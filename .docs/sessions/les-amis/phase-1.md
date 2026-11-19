---
status: pending
---

# Instruction: Cas rouges — `packages/spec/src/friends.spec.ts`

## Architecture projection

```txt
.
└── ✅ packages/spec/src/friends.spec.ts
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | `runMigrations(db)` + deux inscriptions Better Auth (`app.handle`) | deux comptes avec pseudo et cookie de session | api |
| Happy path | A envoie une demande à B, B l'accepte | `friendships` = 1 ligne `ACCEPTED`, chacun voit l'autre dans `GET /friends` | api |
| Edge case | auto-demande, demande croisée, refus, réouverture trop tôt, blocage, plafond | codes stables et lignes attendues (voir tâche 1) | api |
| Teardown | suppression des `friendships`, `blocks`, `user` créés ; restauration de `FRIEND_REQUEST_DAILY_CAP` | base revenue à l'état initial | api |

## Tasks to do

### `1)` Écrire le fichier de spécification, sans aucune implémentation

> Un fichier, treize cas, exécuté et vu rouge.

1. Copier les helpers de `packages/spec/src/market.spec.ts` : `createDb`, `baseUrl`, `origin`, `extractSessionCookie`, `signUp`, `authFetch`, `beforeAll(runMigrations)`, `afterAll` (suppression ciblée + `db.destroy()`). Aucun module partagé n'existe : les helpers sont locaux au fichier.
2. `signUp()` prend un suffixe de pseudo unique (`${prefix}-a`, `${prefix}-b`, …) et rend `{ cookie, userId, pseudo }`.
3. Cas 1 — `POST /api/v1/friends/requests { pseudo }` : `201`, `status === 'PENDING'`, une ligne en base, visible dans `outgoing` de A et `incoming` de B.
4. Cas 2 — `POST /api/v1/friends/requests/{A}/accept` par B : `200`, `status === 'ACCEPTED'`, `GET /friends` de A et de B contiennent chacun l'autre dans `friends`.
5. Cas 3 — demande croisée : B envoie une demande à A alors que A→B est `PENDING` → `200` avec `status === 'ACCEPTED'`, **une seule** ligne pour la paire (comptage SQL sur `least`/`greatest`).
6. Cas 4 — auto-demande : `400 SELF_FRIENDSHIP`. Cas 5 — pseudo inconnu : `404 PLAYER_NOT_FOUND`.
7. Cas 6 — refus : `POST .../{A}/decline` par B → `200`, ligne conservée `DECLINED`. Cas 7 — réouverture immédiate par A → `409 FRIEND_REQUEST_REOPEN_TOO_SOON`.
8. Cas 8 — réouverture après le délai : reculer `responded_at` de `FRIEND_REQUEST_REOPEN_MS + 1000` ms par SQL, puis `POST .../requests` par A → `200`/`201`, ligne `PENDING`.
9. Cas 9 — retrait : `DELETE /api/v1/friends/{B}` par A → `200`, ligne supprimée, plus aucun ami des deux côtés.
10. Cas 10 — blocage : `POST /api/v1/blocks { userId }` par A → `201`, la relation `ACCEPTED` disparaît des deux côtés ; B ne peut plus envoyer de demande (`409 FRIENDSHIP_BLOCKED`).
11. Cas 11 — plafond : lire `FRIEND_REQUEST_DAILY_CAP`, la passer à `2` par SQL, créer deux demandes vers deux comptes, la troisième → `429 FRIEND_REQUEST_CAP_REACHED`. Restaurer la valeur en `afterAll` **et** dans un `try/finally`.
12. Cas 12 — non authentifié : `GET /api/v1/friends` sans cookie → `401 UNAUTHORIZED`.
13. Lancer `bun test packages/spec/src/friends.spec.ts` dans Docker et **consigner la sortie rouge** (routes absentes → 404 `ROUTE_NOT_FOUND`).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le fichier s'exécute : aucune erreur d'import, `bun test` le découvre |
| 1 | Chaque cas porte un message d'assertion en français expliquant l'invariant |
| 1 | Le fichier est rouge avant la phase 2, et la sortie rouge est citée dans le journal |
| 1 | Aucun fichier de production n'est créé par cette phase |
