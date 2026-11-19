# Hexamap — Live roadmap (what is actually left)

**Updated:** 2026-11-19.
**Baseline:** `main` after the merge of PR #16 (`feat/phase-16-le-geste`) and PR #15
(`feat/phase-17-installation`).
**Status:** the original plan (phases 12 → 15, written against the `chore/phase-11-release`
baseline) is **fully consumed**. It survives in git history; this file now tracks only what
remains. Per-phase detail and measurements live in `.docs/03-active-task.md`; defects live in
`.docs/04-bugs.md`.

Rules that did not change: spec-first (`packages/spec` before implementation), everything runs in
Docker, French UI, server authoritative, no external call at runtime.

---

## 1. Where we actually are

| Repo phase | Scope | State |
| :--- | :--- | :--- |
| 12 | Documentation of the single-container production | Done |
| 13 | IGN cartography & road-signage design system | Done (superseded by 14) |
| 14 | Cabinet de cartographie (design system v4) | Done |
| 15 | Le Cartel (card detail room) | Done — PR #16 branch |
| 16 | Le Geste (touch engine, mobile e2e) | Done — PR #16 |
| 17 | L'Installation (manifest, icons, service worker) | Done — PR #15 |
| 19 | La Preuve d'installation (suite PWA, banc e2e HTTPS) | Done |
| 20 | Les Overlays ancrés (BUG-007, `OverlayPortal`) | Done |
| 21 | Les Salles retrouvées (BUG-005, `Plus` sheet) | Done |
| 22 | Les Planches lisibles (BUG-006) | Done |
| 23 | Les lignes du tiroir (BUG-008) | Done |
| 24 | Le mode d'emploi (README PWA) | Done |
| 25 | Les encoches latérales (safe-area insets) | Done |

Original roadmap → repo mapping: its Phase 12 = repo 12; **its Phase 13 = repo 13 + 14** (the
design system was rewritten once); **its Phase 14 = repo 14/15 partially + 16**; **its Phase 15 =
repo 17, at ~80 %, closed in practice by repo 19**.

Verified today: `ci:check` green with **159 specs across 11 files**; the production image compresses
text payloads in-process — main bundle `255 461` → `80 243` octets in gzip (−68,6 %) and `75 518`
in brotli (−70,4 %) — while still serving `/manifest.webmanifest` (`application/manifest+json`),
`/sw.js` (`text/javascript`, `no-cache`), 46 precache entries; Playwright **58 tests, 56 passed /
2 skipped**, aucun flaky.

---

## 2. What remains, in order

The previous backlog is empty: the README PWA section and the lateral safe-area insets both
shipped on 2026-11-19 as phases 24 and 25, recorded in `.docs/03-active-task.md`.

What follows is the **economy and social layer**, in dependency order. Each phase starts in
`packages/spec`. The data contract for all five phases is already ratified — `.docs/01-architecture.md`
§2.6, §2.8, §2.9 and `.docs/02-database.md` §4.7–§4.9, tables marked **Contrat** — so no phase
may reopen it silently: a change starts by editing those two documents, then a migration. The
rule stays the same as the rest of the game: the server decides, the client displays.

### Phase 26 — Le Carnet (scratch pace)

A player holds **charges**, and one charge buys one ticket. `SCRATCH_CHARGE_CAP = 6`,
`SCRATCH_REGEN_MS = 30 min`. One charge regenerates while below the cap, and regeneration
**pauses** at the cap: nothing accrues, nothing is lost.

- A new account starts **at the cap**, not at 1. The first session must be able to produce a
  real ticket, and phase 27's "scratch your first ticket" medal must fire on a real object.
- The server derives the balance from `last_regen_at` on every read. Never a counter that a
  request increments, never a client clock. Generation runs in the same transaction and under
  the same `FOR UPDATE` lock as the draw, so two parallel requests cannot both spend the last
  charge.
- The API returns `charges` and `nextChargeAt`; the client ticks the countdown locally from
  those two values and re-synchronises on each mutation. No polling: `/charges` is not called
  every minute, and the service worker keeps no cached copy of a balance.

**The objection, answered.** *"1 card every 30 minutes"* is ambiguous against the GDD, where
a **carte à gratter** is the 16-cell ticket and the **case** is what gets scratched. Read
literally as one cell, a ticket would take eight hours. The limit is therefore on **ticket
generation**, and "stock 6" means **six bankable tickets** — the only reading in which
"stock a max of 6 cards" is coherent. This has to be written into `.docs/01-architecture.md`
§2.6, whose current text says a user has at most one `ACTIVE` ticket.

**The collision that decides the design.** `tickets_one_active_per_user` (`.docs/02-database.md`
§4.3) is a unique partial index on `status = 'ACTIVE'`. Banking six tickets either drops that
index or breaks the invariant. Recommended shape: keep the index, bank **charges** in
`user_scratch_charges (user_id, charges, last_regen_at)`, and spend a charge when a ticket is
generated. One active ticket stays true, the anti-cheat model (`grid` stays server-only) is
untouched, and the cap sits one `FOR UPDATE` away from the draw.

**The numbers.** Keep 30 min / 6 for V1, but put both in `game_config` so tuning is not a
migration. My objection is not the 3-hour refill as such — 30 min still yields up to 48 tickets
a day for a player who empties the bank — it is that a three-hour dead zone punishes the player
who opens the app twice in an evening. If retention says so, `20 min / 6` (2 h) or `30 min / 8`
are the two honest alternatives, and either is one config row.

Open questions to settle in the GDD: a banked charge never expires (only a generated ticket's
`expires_at` does), and regeneration does not continue at the cap.

### Phase 27 — Les Médailles (achievements → écus)

This phase **closes the known gap** recorded below: it is the market's first faucet.

- The currency gets a display name, the **écu**. `currency` and `currency_ledger` keep their
  columns; the name is a French-UI string plus a line in `.docs/01-architecture.md`.
- `user.currency` starts at 0 and only ever rises through `currency_ledger` rows. A claim
  writes `reason = 'ACHIEVEMENT:<key>'` **in the same transaction** as the `user_achievements`
  row, whose unique `(user_id, key)` makes a retried claim pay once.
- Progress is computed server-side from authoritative rows — revealed tickets, `user_cards`,
  `tableaux`, `SOLD` listings, accepted friendships — never from a client counter and never
  from a mutable column that can be replayed.
- The faucet is **finite**: every claim is one-time. That is what bounds inflation, unlike a
  daily bonus. `achievements` is a `packages/shared` catalogue (key, family, threshold, écus),
  not a table anyone can edit at runtime.

Catalogue, ~66 000 écus in total, of which ~28 000 is the collection family. Amounts are the
opening bid; they live in the shared catalogue and are locked by a spec, not tuned by hand.

| Family | Medal | Écus |
| :--- | :--- | ---: |
| Grattage | First ticket / 10 / 50 / 100 / 500 / 1 000 tickets | 100 / 250 / 500 / 1 000 / 2 500 / 5 000 |
| Grattage | First Pépite / 10 Pépites / a Mythique from a ticket | 150 / 750 / 2 000 |
| Collection | 10 / 50 / 100 / 500 cards owned | 200 / 500 / 1 200 / 4 000 |
| Collection | All 18 régions / all 101 départements | 3 000 / 15 000 |
| Collection | One card of each of the six rarity tiers | 1 500 |
| Collection | A rue found in only one commune in France (`N = 1`) | 2 500 |
| La Planche | First tableau / multiplier ×1,5 / ×2,5 / ×5 | 100 / 200 / 500 / 1 500 |
| La Planche | Tableau total ≥ 5 000 / 10 000 / 15 000 pts | 500 / 1 500 / 4 000 |
| Le Comptoir | First sale / first purchase | 150 / 150 |
| Le Comptoir | 10 / 100 cards sold / 10 000 écus earned from sales | 500 / 3 000 / 2 000 |
| Le Comptoir | One purchase at ≥ 1 000 écus | 300 |
| Social | First friend / 10 / 50 / 100 friends | 100 / 500 / 2 000 / 5 000 |
| Social | Public profile complete (pseudo, avatar, bio) | 100 |
| Assiduité | 7 / 30 consecutive days with at least one ticket | 700 / 3 000 |

Two rules the catalogue must keep. No medal is ever claimable twice, and **no medal pays for
spending real money** — that would braid pay-to-win into progression, which phase 30 exists to
avoid. The social rows ship **declared and locked** with this phase, then unlock in phase 28,
so the catalogue is written once.

### Phase 28 — Les Amis

- Friendship is **symmetric and consensual**: `friendships (requester_id, addressee_id, status
  in PENDING/ACCEPTED/DECLINED, created_at, responded_at)`, `check (requester_id <> addressee_id)`,
  and an unordered-pair unique index on `(least(a, b), greatest(a, b))` so the reverse request
  cannot create a second row.
- Send, accept, decline, cancel, remove. A `blocks` row is separate and hides the profile in
  both directions; it also drops any pending request.
- A request cap per day (`game_config`) and the Better Auth rate limiter, because "add 100
  friends" is a medal and therefore a farming target. Only **ACCEPTED** rows count toward it, so
  a sock-puppet farm costs one accepted request per account per day.
- A pending-request badge on the rail and the mobile tab bar. No email, no push in V1.

### Phase 29 — La Vitrine (public profile)

- Route `/players/$userId`, by id and not by pseudo, because `pseudo` is nullable and not
  unique today. Display name is `pseudo ?? name`.
- Content: pseudo, member since, cards owned, per-category completion (`x / 18`, `x / 101`),
  best tableau score and multiplier, achievement badges, open listings, friend count, and the
  "Ajouter en ami" control from phase 28.
- **Never**: email, `currency`, `session` or `account` rows, `locked` state, `grid`,
  `treasure_index`. A private profile answers **404**, not 403 — same reasoning as
  `CARD_NOT_VISIBLE`.
- Linkable profiles need a stable handle: a unique index on `lower("user".pseudo)` and pseudo
  validation on the registration form (3–24 characters) are prerequisites, not follow-ups.

### Phase 30 — La Boutique (real money) — unscheduled, deliberately

Blocked on legal, not on code: CGV, the right of withdrawal and its digital-content exception,
VAT on digital services, and parental consent for minors. Two engineering rules when it comes:
a payment provider (Stripe Checkout) and a webhook that writes `currency_ledger` with
`reason = 'PURCHASE'` and a **unique provider reference**, so a retried webhook cannot credit
twice; no client-side credit, ever.

Hard product rule: **the ticket is never sold.** Selling fixed-value currency is a
microtransaction; selling randomized tickets is a loot box, and French gambling regulation
(ANJ) would apply. The free ticket stays the only source of cards, which is also what keeps
phase 26's charge limit meaningful rather than a paywall.

### Known gap — the market has no faucet

A new account starts at `currency = 0` (Better Auth `defaultValue`), and the market buy
transaction is today the **only** writer of `currency_ledger`: no daily bonus, no ticket
reward, no `game_config` grant. A fresh player can never buy anything, and the plateau only
becomes reachable after a sale. **Scheduled as phase 27**; it needs the GDD and
`.docs/02-database.md` before any migration.

### Parked — decided 2026-11-19, no work planned

| Item | Why it is parked |
| :--- | :--- |
| Double-tap e2e fixture | Blocked by the gap above: no account can pay, so the test would prove the UI half against a purchase that always answers `409 INSUFFICIENT_FUNDS`. The server half is already proven by `market.spec.ts`; the case in `mobile.spec.ts` re-enables itself once phase 27 ships |
| Lighthouse PWA audit | A new dependency for information the 7 `pwa.spec.ts` cases already give, and the PWA category's status across Lighthouse versions is uncertain |
| `dev.sh --prod` | Tapping two commands instead of one does not justify touching the script that starts the whole stack |

---

## 3. Deliberate deviations — do not "fix" these back

| Deviation | Why |
| :--- | :--- |
| Market stays one column below `sm` | A 132 px thumbnail at 412 px squeezes cards to ~185 px; the e2e asserts no overflow instead of a column count |
| No `overscroll-behavior` on `body` | Would fight the window virtualizer on `/collection`; scoped to the scratch grid, which already carries `overscroll-none` |
| Manifest says **Hexamap**, colours `#0c1210` | The old roadmap said "Hexagone" and signal-signage colours; both predate the cabinet rename |
| `vite-plugin-pwa/client` via triple-slash reference | Equivalent to `tsconfig.types`, typecheck green |
| No `@elysiajs/static` | `Bun.file` + ETag is the proven pattern and keeps TypeBox response typing |
| Scratch e2e uses taps, not a synthetic drag | Playwright's `touchscreen` exposes only `tap`; CDP-coalesced drags measured 8–39 % coverage. Continuous drag stays a manual check |
| The compression hook runs on mounted Better Auth handlers | `app.mount()` is not a bypass for a global `onAfterHandle`; the route's 4-byte payload stays under the 1 KiB threshold, so it is never compressed. Verified by curl |

---

## 4. Risk register (re-scored against reality)

| Risk | Status | Notes |
| :--- | :--- | :--- |
| `workbox-build` under Bun | **Disproven** | Build green, 46 precache entries, `dist/sw.js` emitted |
| The two failing `Plan §5.6` specs | **Resolved** | Never a timeout; suite is at 159 / 0 |
| `GET /*` shadowing `/api`, `/api/auth`, `/blasons` | **Covered** | 13 cases in `static.spec.ts`, deny-list evaluated in the handler, not by route order |
| `backend` network `internal: true` blocking the published port | **Covered** | `api` attaches to both `backend` and `public` |
| Removing nginx loses gzip/brotli | **Covered** | in-process gzip + brotli, 13 specs, measured on the production image |
| `navigateFallback` without a precached `index.html` | **Hit and fixed** | Otherwise `non-precached-url` at install; `html` is in `globPatterns` |
| A stale service worker pinning players | **Covered** | `pwa.spec.ts`, 7 cases, on the HTTPS bench: install, precache, offline shell fallback, no `/api/` entry in any cache |
| Any future transform on `<main>` re-breaks every `fixed` overlay | **Covered** | `.enter-salon` runs `animation-fill-mode: backwards`, so `main` carries no transform after the 180 ms entry; `OverlayPortal` renders both route overlays in `document.body`, immune to any transformed ancestor. Asserted in `design-system.spec.ts` |

Invariants, unchanged: `import type { App }` is the only cross-boundary import; `scratch-cell.tsx`
has 0 `useState` and 0 mouse/touch handlers; every backend change starts in `packages/spec`; French
UI, English identifiers; no `pg`; `currency_ledger` in the same transaction as any balance change;
no external runtime asset or API call.
