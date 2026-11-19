---
status: pending
---

# Instruction: Le blason dans la réponse

## Architecture projection

```txt
.
└── apps/
    └── api/
        └── src/
            ├── routes/
            │   └── ✏️ tickets.ts
            └── services/
                ├── ✏️ draw.ts
                └── ✏️ ticket.ts
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | run `bun test packages/spec` on the phase-1 spec | the new case fails on the two missing fields, and every other case stays green | system |
| Happy path   | run `bun test packages/spec` again | the new case passes on both the scratch response and the persisted read, and the suite reports 159 cases | system |
| Edge case    | reveal a card whose reference row only carries `contour_url` | `blasonUrl` is the contour path, identical to what `GET /api/v1/cards/:id` returns for the same card | api |
| Edge case    | reveal a `RUE` | both fields are `null` and no reference query is issued for the rue | api |
| Edge case    | scratch with a renovation pending | the granted rarity is the upgraded one and the blason is unchanged, because the blason does not depend on rarity | api |

## Tasks to do

### `1)` Une seule règle de repli

> `blason_url ?? contour_url` must exist once, not four times.

1. In `apps/api/src/services/draw.ts`, add a pure helper beside `CardAssets` (line 364): `blasonOf(row: { blason_url: string | null; contour_url: string | null; blason_credit: string | null }): CardAssets`, returning `{ blasonUrl: row.blason_url ?? row.contour_url, blasonCredit: row.blason_credit }`.
2. Replace the three inline constructions at `draw.ts:402-405`, `:415-419` and `:429-433` with `blasonOf(r)`.
3. Keep `CardAssets` the single type of the pair; do not add a second interface for the reveal.

### `2)` `resolveCardMeta` porte le blason

> The scratch path already reads the reference row; it must come back with the blason, without a second query.

1. Extend `interface CardMeta` (`draw.ts:26-30`) with `blasonUrl: string | null;` and `blasonCredit: string | null;`.
2. In each of the four branches of `resolveCardMeta` (`draw.ts:240-286`), add `blason_url`, `contour_url` and `blason_credit` to the `select`, and return `...blasonOf(row)` in the result object.
3. In the `RUE` branch (`:275-285`), return `{ blasonUrl: null, blasonCredit: null }` explicitly: `ref_odonymes` has no blason column.
4. Leave `editionBonus` and every score derivation untouched.

### `3)` Le schéma et les deux constructeurs

> The response schema strips what it does not declare, and two different builders fill the same schema.

1. In `apps/api/src/routes/tickets.ts`, add `blasonUrl: t.Union([t.String(), t.Null()])` and `blasonCredit: t.Union([t.String(), t.Null()])` to `maskedCardSchema` (`:45-56`). Keep `additionalProperties: false`.
2. In the `/scratch` handler, add `blasonUrl: meta.blasonUrl` and `blasonCredit: meta.blasonCredit` to the `card` object of `revealed.push` (`:341-347`).
3. In `apps/api/src/services/ticket.ts`, resolve the assets for the whole batch before the loop: after `const noms = await resolveCardNoms(...)` (`:266`), call `resolveCardAssets(exec, [...cardsById.values()])` and index the result with `cardNomKey`.
4. Add the two fields to the `card` object built at `:273-279`, defaulting to `{ blasonUrl: null, blasonCredit: null }` when the map has no entry.
5. Typecheck the two workspaces: `docker compose --profile tools run --rm dev bun run typecheck`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `blasonOf` is the only place the `??` fallback is written, and the three region, department and commune branches of `resolveCardAssets` call it. |
| 2 | A scratched card returns the same `blasonUrl` and `blasonCredit` as the reference row it came from, and the `RUE` branch returns two nulls. |
| 3 | `GET /api/v1/tickets/current` and `POST /api/v1/tickets/{id}/scratch` both carry the two fields, `packages/spec` is green at 159 cases, and `ci:check` passes its four steps. |
