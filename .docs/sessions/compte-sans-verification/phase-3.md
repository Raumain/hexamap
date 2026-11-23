---
status: done
---

# Instruction: Éteindre la capacité côté API et documenter sendVerificationEmail

## Architecture projection

```txt
.
├── apps/api/src/routes/account.ts    ✏️ capacité éteinte
├── apps/api/src/auth.ts              ✏️ commentaire de justification (aucun débranchement)
└── apps/web/src/lib/account.ts       ✏️ commentaire de type aligné
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | `MAIL_OUTBOX_DIR` posé | transport configuré | api |
| Happy path | `GET /account/capabilities` | `emailVerification: false` | api |
| Edge case | `MAIL_OUTBOX_DIR` absent | `emailVerification: false` (inchangé) | api |
| Teardown | variable retirée | état rendu | api |

## Tasks to do

### `1)` Éteindre la capacité

1. Remplacer `emailVerification: mailTransportConfigured()` par `emailVerification: false` avec un commentaire qui dit pourquoi.
2. Retirer l'import devenu inutilisé.

### `2)` Trancher et écrire le sort de `sendVerificationEmail`

1. Constater l'unique appelant (`auth.api.changeEmail`) et l'absence de `sendResetPassword`.
2. Conserver le branchement, écrire la raison dans le commentaire de `auth.ts`.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Le cas neuf de la phase 1 passe, les cas `:475` et `:481` restent verts sans être touchés |
| 2 | Le commentaire de `auth.ts` nomme l'appelant constaté et la raison du maintien |
