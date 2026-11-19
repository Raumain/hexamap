---
status: pending
---

# Instruction: Le registre lisible

## Architecture projection

```txt
.
└── apps/
    └── web/
        └── src/
            └── routes/
                └── ✏️ collection.tsx
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | open `/collection` at 390 px with a session holding at least one card of each category | the register renders, the filter bar is visible, and the first row is measured | browser |
| Happy path   | measure the plate and the row | the plate is at least 120 px wide, its blason or contour is at least 20 px, and the name, the score and the rarity badge sit beside it without overlap | browser |
| Edge case    | scroll the register to the last row | the virtualizer's stride equals the measured row height, so no two plates overlap | browser |
| Edge case    | a card whose reference has no blason | the plate falls back to its engraving, with no empty image box | browser |
| Edge case    | the window is widened past 768 px | the plate becomes 140 px and the first grid track follows, with no column overflow | browser |
| Teardown     | none | the register is a read-only rendering of a server state | browser |

## Wireframe

```txt
┌───────────────────────────────────────────────┐
│ (1) Le Cadastre — recherche, filtres, compteurs│
├───────────────────────────────────────────────┤
│ (2) Registre                                   │
│  ┌──────────┐ (3) Saint-Rémy — Commune         │
│  │  (4)     │     1 600 pts                    │
│  │ planche  │     (5) ◉ Peu commune           │
│  │ 120/140  │     12/11/2026                   │
│  └──────────┘                                  │
│  ┌──────────┐ (3) …                            │
│  └──────────┘                                  │
└───────────────────────────────────────────────┘
```

1. The room header: search field, category tabs, rarity filter, four counters.
2. The virtualised register: one row per card, window scroll only.
3. The condensed text block shown below `md`: name, `Catégorie · score pts`, rarity badge, acquisition date, lock state.
4. The plate: 120 px wide below `md`, 140 px above, `aspect-[5/7]`, the full compact plate.
5. The rarity badge: the only rarity mark of the row, already present beside the plate.

## Tasks to do

### `1)` La planche du registre

> 84 px is the width at which the plate's own text collapses to its `clamp()` floors; 120 px is where those floors stop being the binding constraint.

1. `apps/web/src/routes/collection.tsx:66`: `w-[84px] shrink-0 md:w-[96px]` becomes `w-[120px] shrink-0 md:w-[140px]` on the `CardLink`.
2. `apps/web/src/routes/collection.tsx:78`: the same change on the `Card` itself. Both carry the width because the link wraps the plate; neither may disagree.
3. `apps/web/src/routes/collection.tsx:141`: the first `grid-template` track `96px` becomes `140px`, so the desktop header and every row keep one alignment.
4. Leave `variant="compact"` in place: the plate stays a full plate, not a decorative miniature, because its caption already exists in the link's accessible name and in the text block beside it.

### `2)` Le pas de défilement

> A row measured 168 px tall under a stride of 142 makes the next plate start before the previous one ends.

1. `apps/web/src/routes/collection.tsx:306`: `estimateSize: () => (isDesktop ? 152 : 142)` becomes `estimateSize: () => (isDesktop ? 220 : 192)`.
2. Recompute from the plate, not from taste: `120 × 7/5 = 168` plus `py-3` (24) gives 192; `140 × 7/5 = 196` plus 24 gives 220.
3. Keep `measureElement` on the row: it stays the authority, and the estimate only sets the scrollbar.
4. Verify with the browser at 390 px and at 1024 px that no two consecutive plates overlap and that scrolling to the last card leaves no gap.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | At 390 px the plate measures at least 120 px and its blason or contour is at least 20 px; at 768 px and above it measures 140 px and the header track aligns with it. |
| 2 | The measured row height equals the virtualizer stride, and no plate overlaps its neighbour while scrolling. |
