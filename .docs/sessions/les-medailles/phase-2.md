---
status: done
---

# Instruction: Migration `0011_achievements`

## Architecture projection

```txt
packages/db/migrations/
  0011_achievements.ts   ✅ table user_achievements + semis de l'interrupteur
packages/db/src/
  migrator.ts            ✏️ import + clé en fin de liste
  schema.ts              ✏️ UserAchievementTable + entrée Database en fin de liste
.docs/02-database.md     ✏️ §2 : statut Contrat → Migrée
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | base de test migrée jusqu'à 0008 | migration 0011 applicable sans erreur | system |
| Happy path   | `runMigrations` sur la base `hexamap_test_27` | `user_achievements` existe avec sa clé primaire composite | system |
| Edge case    | rejouer la migration | `down` puis `up` propres, aucune erreur | system |
| Teardown     | `down` | table supprimée, `game_config` laissé intact | system |

## Tasks to do

### `1)` Table et semis

> Le DDL est recopié de `.docs/02-database.md` §4.8, sans rien ajouter.

1. `createTable('user_achievements').ifNotExists()` : `user_id` text FK `"user"("id")` on delete cascade, `achievement_key` text, `unlocked_at` timestamptz default now, clé primaire composite.
2. `createIndex('user_achievements_key_idx').on('user_achievements').column('achievement_key')`.
3. Semer `ACHIEVEMENT_PAYOUTS_ENABLED` dans `game_config` en `ON CONFLICT (key) DO NOTHING`.
4. `down` : drop de l'index puis de la table.

### `2)` Enregistrement et schéma

> Deux fichiers partagés, deux ajouts en fin de liste.

1. `migrator.ts` : import + clé `'0011_achievements'` en dernière position.
2. `schema.ts` : `UserAchievementTable` et l'entrée `Database` en fin de liste.

### `3)` Contrat de données

1. Passer la ligne `user_achievements` de `.docs/02-database.md` §2 à **Migrée**.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `\d user_achievements` montre la PK `(user_id, achievement_key)` et la FK vers `"user"("id")` |
| 1 | `select value from game_config where key = 'ACHIEVEMENT_PAYOUTS_ENABLED'` rend `true` |
| 2 | `bun run --cwd packages/db typecheck` vert, `Database` connaît `user_achievements` |
| 3 | `.docs/02-database.md` §2 porte le statut Migrée sur cette seule ligne |
