---
status: done
---

# Instruction: Index d'idempotence d'achat et plafond quotidien

## Architecture projection

```txt
.
├── packages/db/migrations/
│   └── 0013_shop.ts                    ✅ create
├── packages/db/src/
│   └── migrator.ts                     ✏️ modify (import + clé en fin de liste)
├── packages/spec/src/
│   └── ledger.spec.ts                  ✅ create
└── .docs/02-database.md                ✏️ modify (§2, §4.1, §4.6, §7.1)
```

## Test Scope

| Scenario     | Action | Observable outcome | Actor |
| ------------ | ------ | ------------------ | ----- |
| Setup        | `runMigrations` sur la base de test, inscription d'un compte | schéma à jour, un `user.id` connu | api |
| Happy path   | deux `insert … on conflict do nothing` du même `PURCHASE:<uuid>` | `currency_ledger` porte **une** ligne | api |
| Happy path   | deux `insert` identiques `MARKET_BUY` | `currency_ledger` porte **deux** lignes | api |
| Edge case    | lecture de `pg_indexes` et de `game_config` | `currency_ledger_purchase_uniq` présent, `SHOP_DAILY_PURCHASE_CAP` = `12000` | api |
| Teardown     | `delete from "user"` pour les comptes créés | cascade : plus aucune ligne de ledger | api |

## Tasks to do

### `1)` Spec d'intégration rouge

> Un cas qui échoue avant la migration, vert après.

1. Créer `packages/spec/src/ledger.spec.ts` : `createDb`, `runMigrations` en `beforeAll`, `signUp` locale (copie du modèle `market.spec.ts`), `afterAll` qui supprime les comptes créés.
2. Cas : l'index existe dans `pg_indexes` ; deux `PURCHASE:<uuid>` sous `on conflict do nothing` → 1 ligne ; deux `MARKET_BUY` → 2 lignes ; `SHOP_DAILY_PURCHASE_CAP` = 12000 (nombre JSON).
3. Lancer la spec seule : elle doit être **rouge** (index absent, clé absente).

### `2)` Migration `0013_shop`

> Le SQL exact du contrat, rejouable.

1. `create unique index if not exists currency_ledger_purchase_uniq on currency_ledger (user_id, reason) where reason like 'PURCHASE:%'`.
2. `insert into game_config (key, value) values ('SHOP_DAILY_PURCHASE_CAP', '12000'::jsonb) on conflict (key) do nothing`.
3. `down` : `drop index if exists`, `delete from game_config where key = 'SHOP_DAILY_PURCHASE_CAP'`.
4. `migrator.ts` : `import * as shop from '../migrations/0013_shop'` et `'0013_shop': shop` **à la fin** de la liste.

### `3)` Contrat mis à jour

1. §2 : ligne de l'index, statut **Migrée**, origine `0013_shop`.
2. §4.1 : `SHOP_DAILY_PURCHASE_CAP`, number, `12000`, plafond d'écus achetés par jour et par compte.
3. §4.6 : la note d'unicité passe au présent.
4. §7.1 : invariant « un rejeu `PURCHASE:<id>` n'écrit qu'une ligne ».

### `4)` Preuve

1. Spec verte seule, puis `ci:check` complet dans Docker.
2. Rejeu de la migration deux fois de suite sur une base jetable, sans erreur.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | La spec est rouge avant la migration sur les deux assertions (index, clé) et verte après. |
| 2 | `up` rejoué deux fois ne lève pas ; `down` retire index et clé. |
| 3 | Les quatre sections du contrat disent la même chose que le code. |
| 4 | `ci:check` vert, nombre de spécifications et de fichiers cité tel qu'observé. |
