---
status: pending
---

# Instruction: Le blason dans le contrat

## Architecture projection

```txt
.
└── packages/
    └── spec/
        └── src/
            └── ✏️ tickets.spec.ts
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | seed a blason URL, a contour URL and a credit on the seeded reference rows, then create a ticket | `ref_regions`, `ref_departements` and `ref_communes` carry the three columns; the ticket is `ACTIVE` with one free reveal | api |
| Happy path   | scratch a grid cell whose category is not `RUE`, then read `GET /api/v1/tickets/current` | `revealed[].card.blasonUrl` is a string starting with `/blasons/`, `blasonCredit` is a non-empty string, and the persisted read returns the same two values | api |
| Edge case    | reveal a `RUE` cell | `blasonUrl` and `blasonCredit` are both `null`, without a reference lookup for rues | api |
| Edge case    | read the ticket before any reveal | every unrevealed cell still has `card: null`, and the body still contains neither `treasure_index` nor `grid` | api |
| Edge case    | a reference row with `blason_url` null and `contour_url` set | `blasonUrl` equals the contour path, proving the fallback is the shared one | api |
| Teardown     | delete the created users and their tickets and reveals | the seeded reference counts are back to their baseline | api |

## Tasks to do

### `1)` Étendre le type et semer les blasons

> The spec must be able to name the two fields before the API produces them.

1. In `packages/spec/src/tickets.spec.ts`, add `blasonUrl: string | null;` and `blasonCredit: string | null;` to `interface MaskedCard` (lines 15-21).
2. `refCode` needs no addition: `MaskedCard.refCode` already exists (line 17) and `maskedCardSchema` already declares it (`apps/api/src/routes/tickets.ts:48`). The new case asserts it anyway, so the confirmation the source asks for is executed rather than read.
3. In `seedReference()` (starts line 156), add `blason_url`, `contour_url` and `blason_credit` to the region, department and commune inserts. Give one commune a `blason_url`, one a `contour_url` only, and one neither, so the three branches are reachable.
4. Leave `ref_odonymes` and every `RUE` case without blason: the plate of a rue has no image slot (`apps/web/src/components/ui/cards/rue-card.tsx:69-76`), and `resolveCardAssets` already skips the category.

### `2)` Le cas de contrat

> One case proves the field exists, is populated, is identical on both read paths, and stays null for a rue.

1. Add `it('Archi §4.7 — la révélation porte le blason, l’attribution et le repli contour', …)` below the existing `Plan §5.5 — gratter une case la révèle…` case (line 371).
2. Read the grid from the database, pick the first cell whose category is `REGION`, `DEPARTEMENT` or `COMMUNE`, scratch that index through the `scratch()` helper, and assert on `body.revealed`.
3. Bound the search to six tickets; if no such cell exists, fail with an explicit message rather than skipping. The grid always holds commune cards (`GDD §2.6`, the ten `Routes communales`), so the bound is a guard, not an expectation.
4. Assert `card.refCode` equals the `ref_code` of the grid cell that was scratched: that is the `refCode` half of the prerequisite, and it must hold on both read paths.
5. Call `GET /api/v1/tickets/current` with the same cookie and assert the same cell carries the same `refCode`, `blasonUrl` and `blasonCredit`.
6. Add a second assertion block that reveals a `RUE` cell when the grid holds one and requires `blasonUrl` and `blasonCredit` to be `null`.
7. Confirm the two anti-trick assertions of the existing case still pass on the new body: `treasure_index` and `"grid"` absent.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `MaskedCard` declares both fields, `refCode` is confirmed present rather than added, and the seeded reference rows reachable by the new case carry a blason or a contour. |
| 2 | The new case fails before phase 2 with `undefined` where `blasonUrl` and `blasonCredit` are expected, and names `Archi §4.7` in its title like every spec of the package. |
