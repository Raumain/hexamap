# Hexamap — Live roadmap (what is actually left)

**Updated:** 2026-11-20.
**Baseline:** `main` after the merge of PR #26 (`feat/phase-28-les-amis`), #27
(`feat/phase-26-le-carnet`), #28 (`feat/phase-27-les-medailles`), #29
(`feat/phase-29-la-vitrine`) and #30 (`chore/agents-et-contrat-economie`).
**Status:** the original plan (phases 12 → 15) and the economy/social layer (phases 26 → 29) are
**fully consumed**. They survive in git history; this file now tracks only what remains.
Per-phase detail and measurements live in `.docs/03-active-task.md`; defects live in
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
| 26 | Le Carnet (charges, derived balance) | Done — PR #27 |
| 27 | Les Médailles (achievements → écus, first faucet) | Done — PR #28 |
| 28 | Les Amis (friendships, blocks) | Done — PR #26 |
| 29 | La Vitrine (public profile, unique pseudo) | Done — PR #29 |
| — | Migrations rejouables (ordering repair) | Done — `fix/migrations-rejouables` |

Original roadmap → repo mapping: its Phase 12 = repo 12; **its Phase 13 = repo 13 + 14** (the
design system was rewritten once); **its Phase 14 = repo 14/15 partially + 16**; **its Phase 15 =
repo 17, at ~80 %, closed in practice by repo 19**.

Verified on 2026-11-20: `ci:check` green with **267 specs across 15 files**; the production image
compresses text payloads in-process — main bundle `255 461` → `80 243` octets in gzip (−68,6 %)
and `75 518` in brotli (−70,4 %) — while still serving `/manifest.webmanifest`
(`application/manifest+json`) and `/sw.js` (`text/javascript`, `no-cache`). The twelve migrations
replay from a dropped `kysely_migration` — twice — with row counts unchanged. The Playwright bench
was last run in full at **58 tests, 56 passed / 2 skipped** (2026-11-19) and has not been re-run
since phases 26 → 29; `charges.spec.ts` adds 3 cases, so the suite now discovers 61.

---

## 2. What remains, in order

The economy and social layer (phases 26 → 29) shipped on 2026-11-19 and 2026-11-20. The backlog
is empty again: the only unscheduled work left is **phase 30**, blocked on legal rather than code.
The rationale of each shipped phase — the charge/card ambiguity, the finite faucet, the symmetric
friendship, the 404 private showcase — lives in `.docs/03-active-task.md` and in git history.

### Shipped — economy and social layer (2026-11-19 → 20)

| Phase | What now exists | PR |
| :--- | :--- | :--- |
| 26 — Le Carnet | `user_scratch_charges`; balance derived from `last_regen_at` (no incrementing counter); 6 charges / 30 min, regeneration suspended at the cap; generation and draw in one transaction under `FOR UPDATE`; `/charges` returns `charges` + `nextChargeAt`, the client ticks locally, no polling | #27 |
| 27 — Les Médailles | `user_achievements`; finite one-time ledger faucet `ACHIEVEMENT:<key>` written in the same transaction as the medal row; ~66 000 écus catalogue locked in `packages/shared`; `ACHIEVEMENT_PAYOUTS_ENABLED` cuts payouts without a migration | #28 |
| 28 — Les Amis | `friendships` (one unordered pair via `least/greatest`), `blocks` (unilateral and silent), daily request cap in `game_config`, only `ACCEPTED` rows count toward medals | #26 |
| 29 — La Vitrine | `user_profiles`; unique `lower(pseudo)` index with a deterministic pre-dedupe; `/players/$playerId` with a strict allow-list and **404** for a private showcase; 3–24 character pseudo validation at signup | #29 |

Contract status: `0009_scratch_charges`, `0010_friendships`, `0011_achievements` and
`0012_profiles` are all **Migrée** in `.docs/02-database.md` §2. No table remains in **Contrat**.

### Maintenance — migrations are replayable

The development database had executed `0011_achievements` before `0009` and `0010` existed on
`main`, so Kysely rejected the sequence. Every `up` now carries `if not exists` /
`on conflict do nothing` guards, and the tracking table can be dropped and the twelve migrations
replayed without losing a row. The rule lives in `.docs/02-database.md` §1 rule 8 and §8 step 8;
the repair is on branch `fix/migrations-rejouables`.

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

### Known gap — the market has no faucet — **closed by phase 27**

A new account still starts at `currency = 0` (Better Auth `defaultValue`), but the phase 27
medals are now a second writer of `currency_ledger`: each medal pays once, in the same transaction
as its `user_achievements` row. A fresh player can therefore earn écus by playing before ever
selling. The faucet stays finite by construction — there is still no daily bonus, no ticket
reward and no `game_config` grant — and `ACHIEVEMENT_PAYOUTS_ENABLED` cuts it without a migration.

### Parked — decided 2026-11-19, no work planned

| Item | Why it is parked |
| :--- | :--- |
| Double-tap e2e fixture | Unblocked by phase 27 — an account can now earn écus — but still unscheduled: the case needs a second account with an open listing, which `global-setup.ts` does not create. The server half is already proven by `market.spec.ts` |
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
| Migrations gain `if not exists` guards after they were applied | The history stays replayable when a branch ran ahead of `main`; only the guard is added, the schema effect is unchanged |

---

## 4. Risk register (re-scored against reality)

| Risk | Status | Notes |
| :--- | :--- | :--- |
| `workbox-build` under Bun | **Disproven** | Build green, `dist/sw.js` emitted, precache populated |
| The two failing `Plan §5.6` specs | **Resolved** | Never a timeout; suite is at 267 / 0 |
| `GET /*` shadowing `/api`, `/api/auth`, `/blasons` | **Covered** | 13 cases in `static.spec.ts`, deny-list evaluated in the handler, not by route order |
| `backend` network `internal: true` blocking the published port | **Covered** | `api` attaches to both `backend` and `public` |
| Removing nginx loses gzip/brotli | **Covered** | in-process gzip + brotli, 13 specs, measured on the production image |
| `navigateFallback` without a precached `index.html` | **Hit and fixed** | Otherwise `non-precached-url` at install; `html` is in `globPatterns` |
| A stale service worker pinning players | **Covered** | `pwa.spec.ts`, 7 cases, on the HTTPS bench: install, precache, offline shell fallback, no `/api/` entry in any cache |
| Any future transform on `<main>` re-breaks every `fixed` overlay | **Covered** | `.enter-salon` runs `animation-fill-mode: backwards`, so `main` carries no transform after the 180 ms entry; `OverlayPortal` renders both route overlays in `document.body`, immune to any transformed ancestor. Asserted in `design-system.spec.ts` |
| A branch executes a later migration before `main` introduces an earlier one | **Covered** | Every `up` is idempotent; `kysely_migration` can be dropped and replayed twice with row counts unchanged. Rule and proof procedure in `.docs/02-database.md` §1 rule 8 / §8 step 8 |

Invariants, unchanged: `import type { App }` is the only cross-boundary import; `scratch-cell.tsx`
has 0 `useState` and 0 mouse/touch handlers; every backend change starts in `packages/spec`; French
UI, English identifiers; no `pg`; every migration `up` is replayable; `currency_ledger` in the
same transaction as any balance change; no external runtime asset or API call.
