---
status: done
---

# Instruction: Banc E2E, ci:check vert, PR brouillon

## Architecture projection

```txt
.
├── packages/e2e/tests/account.spec.ts   ✏️ assertions inversées, jamais relâchées
└── .docs/sessions/compte-sans-verification/  ✏️ journal, revue
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | pile E2E complète, joueur connecté | `/compte` rendu | browser |
| Happy path | lire la salle | aucune pastille de vérification, champ actif | browser |
| Edge case | saisir une adresse invalide | le message de forme s'affiche, rien n'est soumis | browser |
| Teardown | aucun | rien à défaire | browser |

## Tasks to do

### `1)` Inverser les assertions du banc

1. Remplacer l'assertion de pastille par `toHaveCount(0)`.
2. Remplacer `toBeDisabled()` par `toBeEnabled()` et l'assertion du texte de fermeture par son absence.
3. Ajouter une saisie réelle dans le champ pour prouver qu'il accepte le texte.

### `2)` Mesurer

1. `ci:check` avec `TEST_DATABASE_URL=...hexamap_test_44`.
2. Banc E2E complet.

### `3)` Livrer

1. Journal, revue hostile, commits atomiques, PR brouillon vers `chore/v2-retours-campagne`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le cas E2E de la salle passe sans aucun `skip` |
| 2 | `ci:check` vert, nombre de spécifications et de fichiers relevé |
| 3 | PR ouverte en brouillon, base `chore/v2-retours-campagne` |
