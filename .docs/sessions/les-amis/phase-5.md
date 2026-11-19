---
status: pending
---

# Instruction: Preuve, revue, livraison

## Architecture projection

```txt
.
├── ✅ .docs/sessions/les-amis/journal.md
├── ✏️ .docs/sessions/les-amis/plan.md
└── ✅ .docs/sessions/les-amis/review.md
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | arbre complet des phases 1 à 4 | `git status` montre les fichiers attendus, rien d'autre | system |
| Happy path | `ci:check` avec la base `hexamap_test_28` | quatre étapes vertes, nombre de spécifications cité | system |
| Edge case | revue hostile du diff | verdict écrit, défauts classés par gravité | system |
| Teardown | commits atomiques + PR en brouillon | branche poussée, aucun commit sur `main` | system |

## Tasks to do

### `1)` Vérification

1. `docker compose --profile tools run --rm -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_28' dev bun run ci:check` jusqu'au vert, sans `skip` ajouté.
2. Consigner la sortie exacte (spécifications, fichiers) dans `journal.md`.

### `2)` Revue

1. Relire le diff complet en relecteur hostile : contrat §4.9 respecté au caractère près, aucun `any`, codes stables, messages français, index de paire réellement utilisé, plafond et délai lus depuis `game_config`, aucune duplication de la règle.
2. Écrire `review.md` : « prêt à livrer » ou « bloqué », défauts avec gravité et fichier/ligne.

### `3)` Livraison

1. `journal.md` : décisions, écarts, sorties de commandes.
2. Commits atomiques `type(scope): impératif en français` (données, api, web, docs), poussée de `feat/phase-28-les-amis`, PR en brouillon vers `main`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `ci:check` vert, sortie citée intégralement (4/4 et le nombre de spécifications) |
| 2 | `review.md` existe et ne contient aucun défaut *deal-breaker* non corrigé |
| 3 | La PR est en brouillon, la branche est poussée, `main` n'a reçu aucun commit |
