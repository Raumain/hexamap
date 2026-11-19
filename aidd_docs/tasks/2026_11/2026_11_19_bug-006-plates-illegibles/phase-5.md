---
status: pending
---

# Instruction: La preuve et la mémoire

## Architecture projection

```txt
.
├── .docs/
│   ├── ✏️ 01-architecture.md
│   ├── ✏️ 03-active-task.md
│   └── ✏️ 04-bugs.md
├── ROADMAP.md
└── packages/
    └── e2e/
        └── tests/
            └── ✏️ mobile.spec.ts
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | rebuild the bench image, start `db`, `api` and `proxy`, then run the two tactile projects | the stack serves `apps/web/dist` built from the phase 3 and 4 sources | system |
| Happy path   | at 390 px, open a ticket and scratch until a card is revealed | the plate, the name, the rarity seal and the score are all inside the cell, and no pair of their boxes intersects | browser |
| Edge case    | the revealed card carries no blason | the caption keeps its row height, with no empty image box and no shift of the seal | browser |
| Edge case    | at 390 px on `/collection` | the plate measures at least 120 px, the condensed text block shows name, score and rarity, and the document does not scroll horizontally | browser |
| Edge case    | a card revealed by a cascade (`BELVEDERE`) | it gets the same caption and the same badge as a directly scratched cell | browser |
| Teardown     | run `bun run ci:check` and the full bench | four steps green, and 41 passed with 3 skipped | system |

## Tasks to do

### `1)` Le cas de la case révélée

> The acceptance of BUG-006 is a 390 px screen where name, rarity and score do not overlap; it must be measured, not eyeballed.

1. In `packages/e2e/tests/mobile.spec.ts`, add `test('mobile — une case révélée affiche nom, rareté et score sans chevauchement', …)` beside the two existing scratch cases (lines 250 and 269).
2. Reach a ticket without assuming the `global-setup` left one active: click `Obtenir un ticket` when it is visible, otherwise `Ouvrir un nouveau ticket`.
3. Scratch with the existing `SCRATCH_TAPS` loop over `getByRole('button', { name: SCRATCH_CELL })` until `article.exhibit[aria-hidden="true"]` appears, bounded to the number of cells.
4. Collect the boxes with `requireBox`: the revealed cell root, the plate, the name paragraph, the seal (`getByRole('img', { name: /^Rareté : / })`) and the score.
5. Assert each box lies inside the cell box, and that no pair intersects: the plate against the name, the name against the score, the score against the seal.
6. Assert `parseFloat(getComputedStyle(el).fontSize) >= 10` on the name and on the score.
7. Attach a screenshot named `case-revelee-390.png` through `test.info().attach`, so the acceptance evidence ships with the run.

### `2)` Le cas du registre

> The second half of the defect is the Cadastre, and it is measured the same way.

1. Add `test('mobile — le registre montre une planche lisible', …)`.
2. Open `/collection`, wait for the table named `Liste des cartes de votre collection`, and take the first `article.exhibit`.
3. Assert `box.width >= 120` and `box.height / box.width` within 0.05 of `7 / 5`.
4. Assert the condensed text block shows the name, a `Catégorie · N pts` line and a rarity seal, all visible.
5. Assert `document.documentElement.scrollWidth <= window.innerWidth`.
6. Attach a screenshot named `registre-390.png`.

### `3)` La mémoire

> A closed defect that leaves no rule behind comes back.

1. `.docs/04-bugs.md`: move BUG-006 to `Corrigé`, name the branch and the two proofs, and state the rule it leaves: a plate below 120 px is `decorative`, and its caption lives outside `article.exhibit`.
2. `.docs/01-architecture.md` §4.9: add one bullet — the four plates render text only from 120 px up; below that they are used through `decorative` (`card-shell.ts:44`), and the reading is carried by a caption outside the plate, so the ≤ 18 node budget does not move. Record the 10 px floor for any visible text.
3. `.docs/03-active-task.md`: open the phase entry with the objective, the checklist and the journal, using the measurements the two cases produced.
4. `ROADMAP.md` §2: delete the `P2 — BUG-006` block and update the verified line with the new bench counts.
5. Confirm `.docs/02-database.md` and `packages/db/migrations/` are untouched, then run `docker compose --profile tools run --rm dev bun run ci:check`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | The case passes on `Pixel 7` and `iPhone 13`, and fails if the caption is removed, if a font drops below 10 px, or if the plate is allowed to cover the name. |
| 2 | The case passes on both tactile projects and fails at the 84 px plate width of today. |
| 3 | `ci:check` is green, the bench reports 41 passed and 3 skipped, BUG-006 reads `Corrigé`, and the architecture document states the decorative-and-caption rule. |
