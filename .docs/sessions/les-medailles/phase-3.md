---
status: done
---

# Instruction: Service de versement et route `GET /api/v1/achievements`

## Architecture projection

```txt
apps/api/src/services/
  achievements.ts        ✅ collecte des métriques, évaluation, versement
apps/api/src/routes/
  achievements.ts        ✅ GET /api/v1/achievements
apps/api/src/
  app.ts                 ✏️ .use(achievementRoutes) sur le groupe protégé
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | session ouverte, aucune médaille | `GET /api/v1/achievements` rend 37 médailles, toutes non obtenues, `payoutsEnabled = true` | api |
| Happy path   | un ticket gratté puis `GET` | `SCRATCH_FIRST_TICKET` obtenue, `currency` créditée de 100 | api |
| Edge case    | `ACHIEVEMENT_PAYOUTS_ENABLED = false` | aucune médaille obtenue, `currency` inchangée | api |
| Teardown     | comptes supprimés (cascade) | base au niveau de départ | system |

## Tasks to do

### `1)` Métriques

> Chaque famille a une source de vérité unique, lue par une requête Kysely.

1. `SCRATCH` : tickets `EXHAUSTED` ayant au moins une révélation ; Pépites = `ticket_reveals` sur une case `TREASURE` ; Mythique = carte `MYTHIQUE` issue d'un ticket.
2. `COLLECTION` : `user_cards` (total, régions distinctes, départements distincts, raretés distinctes), rue à `nb_communes = 1`.
3. `TABLEAU` : nombre de `tableaux`, meilleur multiplicateur (×10) et meilleur score recalculés par `@hexamap/shared`.
4. `MARKET` : `market_listings.status = 'SOLD'` uniquement, écus encaissés, meilleur achat.
5. `SOCIAL` : métrique `null` (médailles déclarées et verrouillées), comptage `ACCEPTED` fourni par `countAcceptedFriends`.
6. `ATTENDANCE` : plus longue série de jours consécutifs avec au moins un ticket (`created_at` en `Europe/Paris`).

### `2)` Versement

> Une seule transaction, la médaille d'abord, les écus ensuite.

1. Lire `ACHIEVEMENT_PAYOUTS_ENABLED` dans `game_config` (erreur explicite si la clé manque).
2. Si désactivé, ne rien verser et rendre l'état inchangé.
3. Pour chaque médaille nouvellement obtenue : `insertInto('user_achievements').onConflict(...).doNothing().returningAll()` ; si et seulement si une ligne revient, insérer `currency_ledger` avec `reason = 'ACHIEVEMENT:<key>'` et créditer `"user".currency` du même montant.
4. `market_listings_*` et `tickets_*` restent en lecture seule.

### `3)` Route

1. `new Elysia({ name: 'routes.achievements', prefix: '/achievements' })` sur le groupe protégé.
2. `GET /` → `{ payoutsEnabled, total, achievements: [{ key, family, label, description, payout, threshold, progress, earnedAt }] }`, schéma `response` TypeBox complet.
3. Aucune clé inconnue dans la réponse, date au format ISO.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | les six familles produisent une métrique, `SOCIAL` valant `null` |
| 2 | deux appels successifs dans la même seconde ne paient qu'une fois |
| 2 | interrupteur à `false` : zéro ligne dans `currency_ledger`, zéro ligne dans `user_achievements` |
| 3 | réponse conforme au schéma TypeBox, `401` sans session |
