---
status: done
---

# Instruction: Preuve `ci:check`

## Architecture projection

```txt
.docs/sessions/les-medailles/
  review.md      ✅ verdict de relecture
  journal.md     ✅ journal de session
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `TEST_DATABASE_URL=…hexamap_test_27` | base de test dédiée, distincte de `DATABASE_URL` | system |
| Happy path   | `bun run ci:check` | quatre étapes vertes, arrêt à la première en échec | system |
| Edge case    | lint rouge | arrêt à `1/4`, aucun rapport de succès | system |
| Teardown     | aucune donnée laissée par les cas d'intégration | base au niveau de départ | system |

## Tasks to do

### `1)` Vérification

1. `docker compose --profile tools run --rm -e TEST_DATABASE_URL=… dev bun run ci:check`.
2. Relever le nombre exact de spécifications et de fichiers.

### `2)` Relecture et journal

1. Relire le diff complet comme un relecteur hostile, écrire `review.md`.
2. Écrire `journal.md` (ce qui est livré, écarts, chiffres).

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `1/4 Lint`, `2/4 Typecheck`, `3/4 Base de données`, `4/4 Spécifications` vertes |
| 1 | chiffres cités tels qu'affichés, jamais estimés |
| 2 | `review.md` dit « prêt à livrer » ou liste les défauts avec leur gravité |
