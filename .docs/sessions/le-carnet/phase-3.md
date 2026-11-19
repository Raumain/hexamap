---
status: done
---

# Instruction: Le service des charges

## Architecture projection

```txt
apps/api/src/
  services/
    config.ts   ✅ lecture typée des trois clés SCRATCH_*, sans défaut silencieux
    charges.ts  ✅ unique propriétaire de la dérivation côté serveur
```

Les cas d'intégration rejoignent `packages/spec/src/charges.spec.ts`, créé en phase 1.

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | compte neuf, `readCharges` | `charges === min(SCRATCH_START_CHARGES, cap)`, `cap === SCRATCH_CHARGE_CAP`, `nextChargeAt === null` | bun test + PostgreSQL |
| Happy path | `last_regen_at = now - 1,5 × regen`, `readCharges` | `charges + 1`, `last_regen_at` avancé d'exactement `regen`, pas jusqu'à `now` | bun test + PostgreSQL |
| Happy path | carnet plein, `consumeCharge` | `charges = cap - 1` et `nextChargeAt ≈ now + regen` (le compte à rebours est armé par la dépense) | bun test + PostgreSQL |
| Edge case | `SCRATCH_CHARGE_CAP = 8` en base, aucune migration | `cap === 8`, le carnet régénère jusqu'à 8 | bun test + PostgreSQL |
| Edge case | deux `consumeCharge` concurrents avec une seule charge | une seule réussit, l'autre lève `409 NO_CHARGE_LEFT`, solde final `0` | bun test + PostgreSQL |
| Edge case | `SCRATCH_CHARGE_CAP` supprimée | `503 GAME_CONFIG_MISSING`, message français, jamais de valeur par défaut | bun test + PostgreSQL |
| Edge case | `SCRATCH_START_CHARGES > SCRATCH_CHARGE_CAP` | la ligne créée est plafonnée à `cap`, jamais au-delà | bun test + PostgreSQL |
| Teardown | supprimer les comptes créés | aucune ligne résiduelle | bun test + PostgreSQL |

## Tasks to do

### `1)` La configuration

> `game_config` n'est lu nulle part dans l'API aujourd'hui : ce module en est le seul lecteur.

1. `apps/api/src/services/config.ts`: `interface ScratchConfig { cap: number; regenMs: number; startCharges: number }`, `readScratchConfig(exec): Promise<ScratchConfig>`.
2. Un seul `select … where key in ('SCRATCH_CHARGE_CAP','SCRATCH_REGEN_MS','SCRATCH_START_CHARGES')`.
3. Toute clé absente ou non numérique lève `new HttpError(503, 'GAME_CONFIG_MISSING', 'Configuration de jeu incomplète.')` — `HttpError` vient de `apps/api/src/lib/http-error.ts`, jamais d'une classe locale.
4. Aucun cache, aucun défaut en dur : le plafond doit suivre `game_config` sans redémarrage ni migration.
5. Les trois autres clés de `.docs/02-database.md` §4.1 ne sont pas lues ici : la génération de tickets ne doit pas dépendre d'une clé des phases 27 à 29.

### `2)` Le carnet

> `apps/api/src/services/charges.ts` est le seul endroit qui dérive un solde.

1. `interface ChargeSnapshot { charges: number; cap: number; nextChargeAt: Date | null; regenMs: number }`.
2. `readCharges(exec, userId, now = new Date())`: `insert … on conflict (user_id) do nothing` avec `charges = min(startCharges, cap)` et `last_regen_at = now`, puis `select … for update`, puis `regenerateCharges` de `@hexamap/shared`.
3. **Conversion d'unité en un seul point**: `row.last_regen_at.getTime()` à l'entrée, `new Date(ms)` à la sortie. Aucun `number` ne franchit la frontière de la base, aucun `Date` n'entre dans `packages/shared`.
4. Persister l'état dérivé (`charges`, `last_regen_at` — `new Date(balance.lastRegenAt)`) dans la même transaction, **uniquement s'il diffère** du stocké. Au plafond il diffère à chaque lecture : c'est le figeage, et c'est voulu.
5. `consumeCharge(exec, userId, now)`: même dérivation sous `FOR UPDATE`, puis `charges - 1`; lève `new HttpError(409, 'NO_CHARGE_LEFT', 'Aucune charge disponible : votre prochaine charge arrive bientôt.')` si le solde dérivé vaut `0`.
6. La dépense depuis le plafond arme le compte à rebours : le figeage a déjà posé `last_regen_at = now`, donc aucune branche supplémentaire — vérifié par un cas dédié.

### `3)` Les cas d'intégration

1. Section `describe('Carnet de charges — service')` dans `charges.spec.ts`, calquée sur `tickets.spec.ts` (`app.handle`, `signUp`, `authFetch`, `runMigrations` en `beforeAll`, nettoyage des comptes en `afterAll`).
2. Couvrir les huit scénarios du tableau ci-dessus.
3. Chaque mutation de `game_config` est restaurée dans un `finally`, pour ne pas laisser le plafond à 8 derrière elle.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Supprimer `SCRATCH_CHARGE_CAP` fait lever `503 GAME_CONFIG_MISSING`; aucune valeur de repli n'est utilisée. |
| 2 | Aucune arithmétique de régénération dans `routes/` : `charges.ts` est le seul à diviser par `regenMs`. |
| 2 | Deux `consumeCharge` concurrents avec `charges = 1` : exactement un succès, exactement un `NO_CHARGE_LEFT`, solde final `0`. |
| 2 | Deux `readCharges` successifs sous le plafond ne font pas avancer `last_regen_at` de plus de `g × regenMs`. |
| 2 | Dépenser depuis le plafond rend `nextChargeAt` entre `now` et `now + regenMs`. |
| 3 | Les cas sont rouges avant l'implémentation, verts après. |
