---
status: done
---

# Instruction: L'API

## Architecture projection

```txt
apps/api/src/
  routes/
    charges.ts  ✅ GET /charges, schéma response TypeBox
    tickets.ts  ✏️ la génération consomme une charge dans sa transaction
  app.ts        ✏️ chargeRoutes monté dans protectedRoutes
```

Les cas HTTP rejoignent `packages/spec/src/charges.spec.ts`, créé en phase 1.

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | compte neuf, session valide | cookie de session | api |
| Happy path | `GET /api/v1/charges` | `200`, `{ charges: 6, cap: 6, nextChargeAt: null, regenMs: 1800000 }` | api |
| Happy path | `POST /api/v1/tickets` puis `GET /charges` | la génération réussit, le solde baisse de 1, `nextChargeAt` non nul et proche de `now + regen` | api |
| Edge case | `GET /charges` sans session | `401` | api |
| Edge case | carnet vide, `POST /tickets` | `409 NO_CHARGE_LEFT`, message français, aucune ligne dans `user_cards` | api |
| Edge case | ticket déjà actif, second `POST /tickets` | `409 TICKET_ALREADY_ACTIVE` et **aucune charge perdue** | api |
| Teardown | supprimer les comptes | aucune ligne résiduelle | api |

## Tasks to do

### `1)` La route de lecture

> Le schéma `response` est obligatoire : il alimente Eden Treaty.

1. Lire d'abord `apps/api/src/routes/tickets.ts` (schémas locaux `errorSchema`, `unauthorized`) et reprendre **ses** conventions plutôt qu'en inventer.
2. `apps/api/src/routes/charges.ts`: plugin `Elysia({ name: 'routes.charges', prefix: '/charges' })`, `GET /`.
3. Réponse `{ charges: t.Integer(), cap: t.Integer(), nextChargeAt: t.Union([t.String(), t.Null()]), regenMs: t.Integer() }`; `nextChargeAt` en `toISOString()`.
4. `401` sur session absente, `503` sur configuration incomplète.
5. Monter `chargeRoutes` dans `protectedRoutes` de `app.ts`, en fin de liste — le groupe porte déjà `authPlugin`.

### `2)` La consommation à la génération

> La charge est dépensée dans la transaction du tirage : un `23505` annule la dépense.

1. Le pré-contrôle `TICKET_ALREADY_ACTIVE` **reste où il est**, avant la transaction : il évite de payer une charge pour un refus évident.
2. Remplacer l'appel direct à `generateTicket` par une transaction qui appelle `consumeCharge(trx, user.id)` **avant** `generateTicket(trx, user.id)`. La course résiduelle sur `tickets_one_active_per_user` fait lever `23505` à l'intérieur : Kysely annule la transaction, donc la dépense.
3. Propager `NO_CHARGE_LEFT` par le `catch` existant (`instanceof HttpError`), sans nouvelle branche de statut.
4. Ne pas toucher `tickets_one_active_per_user`, ni le tirage, ni `loadMaskedTicket`.

### `3)` Les cas HTTP

1. `GET /charges` nominal, `401` sans session.
2. Génération → solde décrémenté, `nextChargeAt` non nul, `regenMs` celui de `game_config`.
3. Carnet vide (`charges = 0`, `last_regen_at = now` en base) → `409 NO_CHARGE_LEFT` et aucune ligne dans `user_cards` pour ce compte.
4. Second `POST /tickets` sur un ticket actif → `409 TICKET_ALREADY_ACTIVE` et solde inchangé (c'est la preuve que le pré-contrôle court-circuite avant la dépense).
5. Vérifier au passage le nombre d'essais de la boucle de reprise de `packages/spec/src/tickets.spec.ts` (lignes 498/505) : s'il peut dépasser `SCRATCH_CHARGE_CAP`, le signaler dans le journal **sans modifier le cas existant**.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `GET /api/v1/charges` rend les quatre champs, `nextChargeAt` nul au plafond et chaîne ISO sinon. |
| 1 | Le plugin est monté sous `/api/v1` et répond `401` sans cookie de session. |
| 2 | Deux générations concurrentes avec une charge : une seule carte créée, l'autre en `409`. |
| 2 | Un `409 TICKET_ALREADY_ACTIVE` laisse le solde intact. |
| 3 | `NO_CHARGE_LEFT` porte un message français et le statut `409`. |
