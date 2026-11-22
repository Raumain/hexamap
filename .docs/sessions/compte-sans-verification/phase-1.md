---
status: done
---

# Instruction: Verrouiller la capacité par une spec neuve, vue rouge

## Architecture projection

```txt
.
└── packages/spec/src/account.spec.ts   ✏️ (ajout d'un cas, aucun cas existant touché)
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | `process.env.MAIL_OUTBOX_DIR` pointé sur un répertoire temporaire | transport considéré configuré | api |
| Happy path | `GET /api/v1/account/capabilities` avec session | `{ deletion, emailVerification: false }` | api |
| Edge case | même appel **rouge** avant le correctif | `emailVerification: true` reçu → cas rouge | api |
| Teardown | variable restaurée | état de l'environnement rendu | api |

## Tasks to do

### `1)` Écrire le cas avant le code

1. Ajouter dans `describe('Comptes §2.9 — les capacités du compte')` un `it` qui pose `MAIL_OUTBOX_DIR`, appelle la route et asserte `emailVerification: false`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le cas échoue sur la branche non corrigée (relevé du message) et passe après la phase 3 |
