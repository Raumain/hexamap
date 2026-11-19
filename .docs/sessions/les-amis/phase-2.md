---
status: pending
---

# Instruction: Contrat de données — migration `0010_friendships`

## Architecture projection

```txt
.
├── ✏️ .docs/02-database.md
├── ✅ packages/db/migrations/0010_friendships.ts
├── ✏️ packages/db/src/migrator.ts
└── ✏️ packages/db/src/schema.ts
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | `runMigrations(db)` sur la base de test | `friendships` et `blocks` existent avec leurs index | api |
| Happy path | insertion d'une paire, puis de la paire inversée | la seconde insertion viole `friendships_pair_idx` | api |
| Edge case | insertion `requester_id = addressee_id` | `friendships_self_check` refuse | api |
| Teardown | `down` de la migration (jamais joué en test) | tables absentes | api |

## Tasks to do

### `1)` Migration

> Le DDL est recopié de `.docs/02-database.md` §4.9, à la lettre.

1. `packages/db/migrations/0010_friendships.ts` : `up` crée `friendships` (`requester_id`, `addressee_id` → `"user"("id")` `on delete cascade`, `status` `CHECK in ('PENDING','ACCEPTED','DECLINED')` `default 'PENDING'`, `created_at`, `responded_at`, `CHECK (requester_id <> addressee_id)`, `primary key (requester_id, addressee_id)`), l'index unique `friendships_pair_idx` sur `(least(requester_id, addressee_id), greatest(requester_id, addressee_id))` et `friendships_addressee_idx` sur `(addressee_id, status)`.
2. Même `up` : `blocks` (`blocker_id`, `blocked_id`, `created_at`, `CHECK (blocker_id <> blocked_id)`, `primary key (blocker_id, blocked_id)`) et `blocks_blocked_idx` sur `(blocked_id)`.
3. Semis idempotent des deux clés utiles à la phase : `FRIEND_REQUEST_DAILY_CAP = 20` et `FRIEND_REQUEST_REOPEN_MS = 604800000` en `insert … on conflict (key) do nothing`. Aucune autre clé (les six appartiennent à la phase 26).
4. `down` : `dropTable('blocks')` puis `dropTable('friendships')`.
5. `packages/db/src/schema.ts` : `FriendshipTable` (`status: Generated<FriendshipStatus>`, `responded_at: Date | null`) et `BlockTable` **après** `RateLimitTable` ; entrées `friendships` et `blocks` **à la fin** de `Database`.
6. `packages/db/src/migrator.ts` : `import * as friendships from '../migrations/0010_friendships'` et clé `'0010_friendships'` **en fin** de l'objet.
7. `.docs/02-database.md` §2 : `friendships`, `blocks` → **Migrée** (colonne Origine : `packages/db/migrations/0010_friendships.ts`). Ne toucher à aucune autre ligne du document.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1-4 | `runMigrations` va au bout sur la base de test et le catalogue PostgreSQL montre les deux `CHECK` et les deux index |
| 1-4 | L'insertion d'une paire inversée échoue en violation d'unicité (couvert par le cas 3 de `friends.spec.ts`) |
| 5-6 | `bun run typecheck` propre ; aucune entrée existante réordonnée |
| 1 | Le tableau §2 ne marque plus `friendships` et `blocks` comme Contrat |
