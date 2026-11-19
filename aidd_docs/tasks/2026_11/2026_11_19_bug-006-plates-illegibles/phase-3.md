---
status: pending
---

# Instruction: La case révélée

## Architecture projection

```txt
.
└── apps/
    └── web/
        └── src/
            ├── components/
            │   ├── ✏️ revealed-cell.tsx
            │   ├── ✏️ scratch-cell.tsx
            │   └── ui/
            │       └── cards/
            │           ├── ✏️ departement-card.tsx
            │           └── ✏️ rue-card.tsx
            ├── content/
            │   └── ✏️ tickets.ts
            └── routes/
                └── ✏️ tickets.$ticketId.tsx
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | open `http://localhost:5174/` at 390 px with a session, then `Obtenir un ticket` | the ticketing board renders sixteen cells in three columns | browser |
| Happy path   | scratch a cell until a card is revealed | the card's name is visible under the plate, the rarity seal announces `Rareté : …`, and the score is visible in the same caption | browser |
| Edge case    | reveal a `TWIN`, a `TREASURE`, a card without blason and a `RUE` | the `Jumelé` mark and the distance badge never overlap the name or the score; the missing blason leaves no empty box | browser |
| Edge case    | reveal a panel (`STATION`, `BELVEDERE`, `RENOVATION`) | its label and description fit the cell and stay at 10 px or more | browser |
| Edge case    | the ticket is exhausted | locked cells keep the same format as the scratchable ones, with no ragged row | browser |
| Teardown     | none | the board is a read-only rendering of a server state | browser |

## Wireframe

```txt
┌──────────────────────────────────────────────┐
│ (1) Le Relevé — bordereau et grattages        │
├──────────────────────────────────────────────┤
│ (2) Grille, 3 colonnes sous 640 px            │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐        │
│   │  (3)    │ │  (3)    │ │  (3)    │        │
│   │  planche│ │  planche│ │  planche│        │
│   │    (4) 3│ │         │ │         │        │
│   ├─────────┤ ├─────────┤ ├─────────┤        │
│   │ (5) nom │ │         │ │         │        │
│   │ ◉  1 200│ │         │ │         │        │
│   └─────────┘ └─────────┘ └─────────┘        │
└──────────────────────────────────────────────┘
```

1. The room header: bordereau id, remaining scrapes, status.
2. The fieldset: three columns below `sm`, four above, every cell at `aspect-[4/5]`.
3. The plate: the existing `decorative` miniature, `aria-hidden`, height-bound, width derived from `aspect-[4/5]`.
4. The distance badge: absolute top-right on the plate, solid background, never translucent.
5. The caption: name on at most two lines, then a row holding the blason, the rarity seal, the `Jumelé` mark when relevant, and the score.

## Tasks to do

### `1)` La miniature décorative tient à 56 px

> The decorative branch is the only branch that will be rendered at 56 px, so it is the only one that must lose its fixed pixel text.

1. `apps/web/src/components/ui/cards/departement-card.tsx:44`: `text-[8px]` becomes `text-[10px]` on the `refCode` inside the shield. The shield keeps `h-[62%] w-[62%]`: two or three characters fit.
2. `apps/web/src/components/ui/cards/rue-card.tsx:52`: `text-[9px]` becomes `text-[10px]` on the `rue` ornament, and the ornament gains `whitespace-nowrap`.
3. Touch nothing else in the four plates: `region-card.tsx` and `commune-card.tsx` decorative branches already render no text, and their `clamp()` floors are only reached above 120 px once phase 4 is done.
4. Do not add an image slot to `rue-card.tsx`. The source leaves the choice open — the department contour, or an accepted absence — and absence is chosen: `ref_odonymes` carries no blason column, `resolveCardAssets` returns nulls for `RUE` (`apps/api/src/services/draw.ts:437-440`), and borrowing the department contour would need a new reference lookup and a new payload field. Record the choice in the phase journal when it closes.

### `2)` La case révélée

> The plate shows art; the caption carries the reading.

1. In `apps/web/src/components/revealed-cell.tsx`, replace the root class `aspect-square` with `aspect-[4/5]`, keep `p-1.5`, and stop passing `h-full w-full` to `Card`.
2. Render the plate inside a `relative flex min-h-0 flex-1 items-center justify-center` wrapper, with `<Card … decorative className="h-full w-auto" />`. `decorative` makes the plate `aria-hidden` and `aspect-[4/5]` (`apps/web/src/components/ui/cards/card-shell.ts:44`), and `w-auto` derives the width from the height so the plate can never overflow.
3. Forward `refCode={card.refCode}` to `Card`. The decorative department branch prints `refCode` inside its shield (`departement-card.tsx:44-46`), and without the prop it prints the `'—'` fallback set by `Card.tsx:43` — the revealed cell would show a shield with a dash for every department.
4. Add the caption below the plate, outside the `Card`: a `<p className="line-clamp-2 font-display text-[11px] leading-[1.15] text-ink">` holding `card.nom || nom || 'Carte'`.
5. Add the caption row: `<img src={card.blasonUrl} alt="" title={card.blasonCredit ?? undefined} className="h-4 w-4 shrink-0 object-contain" />` only when `blasonUrl` is non-null, then `<RaritySeal rarity={card.rarity} size={18} />`, then the `Jumelé` mark when `kind === 'TWIN'`, then `<span className="ml-auto font-mono text-[10px] tabular-nums">{formatNumber(card.score)}<span className="sr-only"> points</span></span>`.
6. Move the `Jumelé` mark out of the plate: it becomes a `font-mono text-[10px] uppercase tracking-[0.1em] text-brass-deep` label in the caption row, so it can never cover the art or the badge.
7. Replace the distance paragraph with an absolute badge on the plate wrapper: `absolute right-0 top-0 z-[2] rounded-[2px] bg-cabinet px-1 font-mono text-[10px] leading-none tabular-nums text-brass`. Give it `aria-label={TICKET.distanceAriaLabel(distance)}`. No `bg-*/80`, no `backdrop-blur`: the scratch grid forbids both.
8. Keep the panel branch, but raise `text-[9px]` to `text-[10px]` and keep `line-clamp-3` on the description.

### `3)` La grille et le format uniforme

> Three columns give the caption room; one shared ratio keeps the rows even.

1. `apps/web/src/routes/tickets.$ticketId.tsx:223`: `grid-cols-4` becomes `grid-cols-3 sm:grid-cols-4`. Keep `gap-2 md:gap-3` and `overscroll-none`.
2. `apps/web/src/components/scratch-cell.tsx:283`: `aspect-square` becomes `aspect-[4/5]`. The brush still derives its radius from the rendered rectangle (`packages/shared/src/ui.ts`), so no constant changes.
3. `LockedCell` in `tickets.$ticketId.tsx:413`: `aspect-square` becomes `aspect-[4/5]`.
4. `LoadingBoard` in `tickets.$ticketId.tsx:435-447`: `grid-cols-4` becomes `grid-cols-3 sm:grid-cols-4` and each placeholder `aspect-square` becomes `aspect-[4/5]`.
5. Do not introduce `useState`: the cell components stay display-only, and the scratch controller is untouched.

### `4)` Les libellés de distance

> The board speaks French, and the badge needs a full sentence where the numbers alone would not read.

1. In `apps/web/src/content/tickets.ts`, add `distanceLabel(distance: number): string`, returning `'Pépite'` for `0` and `${distance} pas` otherwise.
2. Add `distanceAriaLabel(distance: number): string`, returning `'Distance à la pépite : aucune, vous y êtes'` for `0` and `Distance à la pépite : ${distance} pas` otherwise.
3. Keep the existing `TICKET` object as the home of static strings; the two functions join `scrapesLabel`, `cellLabel` and `revealAnnouncement`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | No text of the four plates renders below 10 px, and the decorative department and rue miniatures stay readable at 56 px. |
| 2 | A revealed card shows its name, its rarity seal, its score and, when it exists, its blason, with no box overlapping another inside the cell; a department miniature prints its code, never a dash. |
| 3 | At 390 px the board renders three columns; every cell kind has the same 4:5 box, and no row is ragged. |
| 4 | The distance badge reads `Pépite` or `3 pas`, and its accessible name is the full French sentence. |
