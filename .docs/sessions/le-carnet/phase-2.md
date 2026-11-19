---
status: done
---

# Instruction: Le carnet en base

## Architecture projection

```txt
packages/db/
  migrations/
    0009_scratch_charges.ts  ✅ table + semis des six clés
  src/
    migrator.ts              ✏️ import et clé ajoutés en fin de liste
    schema.ts                ✏️ UserScratchChargeTable + entrée Database en fin de liste
.docs/
  02-database.md             ✏️ statut Contrat → Migrée pour user_scratch_charges
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | `runMigrations` sur la base de test | `user_scratch_charges` et les six clés de `game_config` existent | bun test |
| Happy path | `select * from game_config` | six clés, valeurs `6`, `1800000`, `6`, `20`, `604800000`, `true` | bun test |
| Edge case | rejouer le semis | `ON CONFLICT DO NOTHING` : aucune erreur, aucune valeur écrasée | bun test |
| Edge case | `charges = -1` | violation du `CHECK charges >= 0` | bun test |
| Teardown | `down` après avoir modifié une clé semée | la table disparaît, la clé modifiée **survit** — seules les valeurs encore au défaut sont supprimées | bun test |

## Tasks to do

### `1)` La migration

> Le DDL doit être identique, au caractère près, à `.docs/02-database.md` §4.7.

1. `packages/db/migrations/0009_scratch_charges.ts`, `up`/`down` en SQL brut via `sql` de `kysely` — le contrat est figé, on ne le paraphrase pas.
2. `create table user_scratch_charges (user_id text primary key references "user"("id") on delete cascade, charges smallint not null check (charges >= 0), last_regen_at timestamptz not null default now())`.
3. **Aucune borne haute** dans le `CHECK` : le plafond vit dans `game_config`.
4. Semer les six clés de §4.1 en `jsonb` avec `on conflict (key) do nothing` : `SCRATCH_CHARGE_CAP 6`, `SCRATCH_REGEN_MS 1800000`, `SCRATCH_START_CHARGES 6`, `FRIEND_REQUEST_DAILY_CAP 20`, `FRIEND_REQUEST_REOPEN_MS 604800000`, `ACHIEVEMENT_PAYOUTS_ENABLED true`.
5. `down`: `drop table user_scratch_charges` puis suppression des six clés **uniquement si leur valeur est encore celle semée** — une valeur réglée après coup (un plafond à 8) survit à un retour arrière.

### `2)` Le branchement

1. `packages/db/src/migrator.ts`: `import * as scratchCharges from '../migrations/0009_scratch_charges';` et `'0009_scratch_charges': scratchCharges,` **en fin de liste**.
2. `packages/db/src/schema.ts`: `UserScratchChargeTable { user_id: string; charges: number; last_regen_at: Generated<Date> }` à la fin du bloc des tables de jeu, entrée `user_scratch_charges` à la fin de `Database`.

### `3)` Le statut documentaire

1. `.docs/02-database.md` §2: passer `user_scratch_charges` de **Contrat** à **Migrée**, avec `packages/db/migrations/0009_scratch_charges.ts` en origine. Aucune autre ligne du document ne change.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `bun run db:migrate` applique `0009_scratch_charges` sans erreur sur la base de test. |
| 1 | `insert into user_scratch_charges (user_id, charges) values ($1, -1)` échoue sur le `CHECK`. |
| 1 | Aucune contrainte ne référence le plafond : `charges = 99` est accepté. |
| 2 | `createDb` typé connaît `user_scratch_charges`; `tsc --noEmit` passe. |
| 3 | Le statut est **Migrée** et aucun autre paragraphe n'est modifié. |
