---
objective: "At 390 px, every card a player can see — a scratched cell of Le Relevé and a row of Le Cadastre — shows its name, its rarity and its score without overlap, while the plate keeps enough size to stay a plate."
status: pending
---

# Plan: Plates legible at small sizes (BUG-006)

Source: `ROADMAP.md` §2 P2 — BUG-006, and `.docs/04-bugs.md` §BUG-006 (lines 360-436).

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Le blason dans le contrat | [`phase-1.md`](./phase-1.md) | none |
| 2   | Le blason dans la réponse | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | La case révélée | [`phase-3.md`](./phase-3.md) | 2 |
| 4   | Le registre lisible | [`phase-4.md`](./phase-4.md) | none |
| 5   | La preuve et la mémoire | [`phase-5.md`](./phase-5.md) | 3, 4 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none | none |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | None. No external call is added: the blason path already exists server-side (`apps/api/src/services/draw.ts:375-445` reads `blason_url ?? contour_url`), and `apps/web` only renders a URL the API produced. | none |
| regression | Medium. `maskedCardSchema` (`apps/api/src/routes/tickets.ts:45-56`) is embedded by `maskedCellSchema` (`:57-66`), which is itself used twice: inside `maskedTicketSchema` (`:68-80`, the `cells` array) and directly as the `revealed` array of the scratch response (`:406-414`). Two different builders fill it — `routes/tickets.ts:335-348` for the mutation, `services/ticket.ts:273-279` for the persisted read — so a field added to the schema must be produced by both. The four plates are shared by Le Cadastre, Le Comptoir, Mes Offres, La Planche and the ticket chapiteau. Safety net: the phase-1 spec, red before any implementation, plus `packages/e2e/tests/design-system.spec.ts` cases `planches — quatre gravures…` and `planches — budget de 18 nœuds…`, which pin four distinct `article.exhibit` structures and a per-plate DOM budget. | 1, 2, 5 |
| architecture | The reveal payload gains two fields on one schema owned by `maskedCardSchema`; the fallback rule `blason_url ?? contour_url` is written three times inline today (`apps/api/src/services/draw.ts:403`, `:417`, `:431`) and moves to a single helper that both builders use. The scratched cell stops rendering a text-bearing plate: the plate becomes the existing `decorative` miniature (`apps/web/src/components/ui/cards/card-shell.ts:44`, `aria-hidden`), and the caption leaves the plate — which keeps the ≤ 18 non-SVG node budget of `article.exhibit` untouched, since the caption is a sibling. | 2, 3 |
| documentation | BUG-006 is closed in `.docs/04-bugs.md`; `.docs/01-architecture.md` §4.9 gains the decorative-miniature-and-caption rule; `.docs/03-active-task.md` records the phase, and `ROADMAP.md` drops the entry from §2. `.docs/02-database.md` is untouched: no column, no table, no migration. | 5 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Spec-first: `packages/spec` before implementation | The reveal payload is a contract; phase 1 lands red before phase 2 changes the API. |
| Everything runs in Docker | Every command in this plan is prefixed `docker compose --profile tools run --rm dev …`. |
| French UI, English identifiers | New labels are French; new symbols (`blasonOf`, `blasonUrl`) are English. |
| No invented table or column | The payload is additive; `.docs/02-database.md` and `packages/db/migrations/` stay untouched. |
| Server authoritative | The browser renders `blasonUrl` as received; it never derives a blason, a contour or a score. |
| No React state for the canvas | `revealed-cell.tsx` is a display component; `scratch-cell.tsx` keeps its `ref`/`requestAnimationFrame` controller and gains no `useState`. |
| ≤ 18 non-SVG nodes per plate | The caption sits outside `article.exhibit`, so the budget measured by `design-system.spec.ts:264` does not move. |
| No `filter`, `backdrop-filter` or `mix-blend-mode` around the scratch grid | The new distance badge uses a solid background, never a translucent blur. |
| One branch, never a direct commit to `main` | `fix/bug-006-plates-illegibles`, opened against `main`. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| A decorative miniature plus a caption outside the plate, instead of shrinking the typography inside the plate | Text cannot scale below 10 px and stay legible; art can. The drawer already renders a decorative plate at 56 px (`tableau.tsx:547`), so the size precedent exists. |
| The reveal payload carries `blasonUrl` and `blasonCredit` | The alternative — a second request per revealed cell — breaks the "one response, nothing recomputed" rule of the ticket room and costs a query in a cascade that already reveals several cells. |
| One helper owns `blason_url ?? contour_url` | Three inline copies drift; the reveal must match `/cards` and `/market/listings` exactly. |
| All three cell kinds share `aspect-[4/5]` | A grid row is sized by its tallest item; a square scratch cell next to a taller revealed cell produces ragged rows and a stretched canvas. |
| Le Cadastre enlarges its plate instead of switching to `decorative` | The mobile row already carries name, score and rarity beside the plate in its own text block; enlarging keeps the desktop plate intact and removes the squeeze without duplicating information. |
| The Rue plate keeps no image slot | Its identity is the enamel plaque, and no server field carries a rue image: `ref_odonymes` has no blason column and `resolveCardAssets` returns nulls for `RUE` (`draw.ts:437-440`). Borrowing the department contour would need a new reference lookup and a new payload field for an ornament the caption already carries. |
| `refCode` is confirmed, not added | `maskedCardSchema` already declares it (`routes/tickets.ts:48`), so the prerequisite of the source reduces to passing it through to the plate — the decorative department shield prints `refCode`, and today it prints the `'—'` fallback of `Card.tsx:43` because `revealed-cell.tsx` never forwards it. |
