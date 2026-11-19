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

Nothing scheduled. The last two items shipped on 2026-11-19; per-phase detail is in
`.docs/03-active-task.md` (phases 24 and 25).

- **README: PWA section** — install, offline behaviour, and the "tickets and balances are
  never cached" rule with the `NetworkOnly`-per-method rationale. It also answers "install
  from the dev server", which is why that entry left this table.
- **Lateral safe-area insets** — `env(safe-area-inset-left|right)` on the rail, the bars,
  the sheet, the update prompt and the mobile header, plus the `.gutter-safe` utility for
  `main` and `footer`.

### Known gap — the market has no faucet

A new account starts at `currency = 0` (Better Auth `defaultValue`), and the market buy
transaction is the **only** writer of `currency_ledger`: no daily bonus, no ticket reward,
no `game_config` grant. A fresh player can therefore never buy anything, and the plateau
only becomes reachable after a sale. This is a **product** decision — it needs the GDD and
`.docs/02-database.md` before any migration.

### Parked — decided 2026-11-19, no work planned

| Item | Why it is parked |
| :--- | :--- |
| Double-tap e2e fixture | Blocked by the gap above: no account can pay, so the test would prove the UI half against a purchase that always answers `409 INSUFFICIENT_FUNDS`. The server half is already proven by `market.spec.ts`; the case in `mobile.spec.ts` re-enables itself once a faucet exists |
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
