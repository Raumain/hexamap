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

Original roadmap → repo mapping: its Phase 12 = repo 12; **its Phase 13 = repo 13 + 14** (the
design system was rewritten once); **its Phase 14 = repo 14/15 partially + 16**; **its Phase 15 =
repo 17, at ~80 %**.

Verified today: `ci:check` green with **144 specs**; production image serving `/manifest.webmanifest`
(`application/manifest+json`), `/sw.js` (`text/javascript`, `no-cache`), 46 precache entries;
Playwright chromium 12 passed / 1 skipped, Pixel 7 and iPhone 13 8 / 1 each.

---

## 2. What remains, in order

### P1 — Production compression (was a High-likelihood risk, now realized)

Dropping nginx removed the only gzip/brotli layer. `apps/api` contains no
`compression` / `Content-Encoding` / `gzip` / `brotli` match: the API serves the hashed SPA bundle
and JSON uncompressed.

- Add gzip (and brotli where available) on text payloads in `apps/api/src/static.ts`, and on API
  JSON responses.
- Spec first: `Archi §6.1 — un asset texte est compressé quand le client l'accepte` and
  `Archi §6.1 — aucune compression sans Accept-Encoding`.
- Do not compress images, fonts or the immutable binary set; keep ETag/`304` intact.
- Acceptance: `curl -sI -H 'Accept-Encoding: gzip' :8080/assets/<hash>.js` exposes
  `content-encoding: gzip`, `curl -sI :8080/` without the header does not.

### P1 — BUG-007: fixed overlays anchored to `<main>`, not the viewport

`.enter-salon` runs with `animation-fill-mode: both`, so `<main>` keeps
`transform: translateY(0)` forever — which makes it the containing block for every
`position: fixed` descendant. The card drawer opens at the bottom of the **page** (mobile), and
the treasure modal overlay is mis-sized when the page is scrolled.

- Fix `.enter-salon` to `fill-mode: backwards` (`apps/web/src/styles.css`), or portal the overlays.
- Acceptance: after scrolling, the drawer's box stays within `innerHeight`; one Playwright mobile
  case asserts it. This restores BUG-004's modal geometry too.

### P1 — PWA end-to-end suite (last item of the original Phase 15)

Nothing today verifies the service worker: no `pwa.spec.ts`, no `pwa` Playwright project, no
`serviceWorkers` setting.

- `packages/e2e/tests/pwa.spec.ts`, 7 cases: manifest conforms; worker installs and controls; shell
  precached; **`/api/*` never served from cache**; deep link offline falls back to the shell; no
  `/api/` entry in any cache; safe-area paddings applied.
- Add a project with `serviceWorkers: 'allow'`.
- Acceptance: 7/7 green on the production image, plus `ci:check` unaffected.

### P2 — BUG-005: secondary rooms unreachable on mobile

`SECONDARY_NAV` (`/tableaux`, `/market/mine`, `/import-status`) exists only in the desktop rail.
A player can compose a planche and never reopen it.

- Fifth "Plus" tab opening a sheet, or the mobile account menu; keep 44 px targets.
- Acceptance: `/tableaux` reached in two taps from `/`, asserted in `mobile.spec.ts`.

### P2 — BUG-006: plates illegible at small sizes

`clamp()` floors are fixed px, the Département shield floors at 46 px, the scratched cell gives the
plate only 64 × 50 px, and `revealed-cell.tsx` passes no `blasonUrl` at all.

- Use the existing `decorative` miniature with a caption, widen the scratched-cell plate
  (`grid-cols-3` below `sm`), move the distance to a corner badge.
- Prerequisite (spec-first): confirm the reveal payload carries `blasonUrl` / `refCode`; extend
  `packages/spec` then the select and the Eden type if it does not.
- Acceptance: a photographed 390 px screen shows name, rarity and score without overlap.

### P2 — BUG-008: drawer rows overlap their plates

Row `h-16` (64 px) vs plate `w-14` + `aspect-[4/5]` (70 px), stride fixed at 64 by
`estimateSize`. Align the two measures (`h-[76px]` + `estimateSize: () => 76`, or `w-12`).

### P2 — README: PWA section

Install, offline behaviour, and the "tickets and balances are never cached" rule with the
`NetworkOnly`-per-method rationale. The only current `install` hits are `bun install`.

### P3 — Remaining polish

| Item | Note |
| :--- | :--- |
| Lateral safe-area insets | Five `env()` uses, all top/bottom; landscape notch unhandled on rails and bars |
| Double-tap e2e fixture | The UI half of the anti-double-purchase is unproven: `global-setup.ts` registers one account, so no cross-user listing exists. Needs a bench fixture |
| Lighthouse PWA audit | Never run; installability is proven by hand only |
| `dev.sh --prod` | Convenience only; the original roadmap itself asked for author sign-off |
| Install from the dev server | `devOptions.enabled: false` by design — installation is testable on the prod build (`:8080`) or any HTTPS origin, never on a LAN IP over HTTP |

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

---

## 4. Risk register (re-scored against reality)

| Risk | Status | Notes |
| :--- | :--- | :--- |
| `workbox-build` under Bun | **Disproven** | Build green, 46 precache entries, `dist/sw.js` emitted |
| The two failing `Plan §5.6` specs | **Resolved** | Never a timeout; suite is at 144 / 0 |
| `GET /*` shadowing `/api`, `/api/auth`, `/blasons` | **Covered** | 13 cases in `static.spec.ts`, deny-list evaluated in the handler, not by route order |
| `backend` network `internal: true` blocking the published port | **Covered** | `api` attaches to both `backend` and `public` |
| Removing nginx loses gzip/brotli | **Realized** | See P1 |
| `navigateFallback` without a precached `index.html` | **Hit and fixed** | Otherwise `non-precached-url` at install; `html` is in `globPatterns` |
| A stale service worker pinning players | **Partially mitigated** | `registerType: 'prompt'` + French banner + `cleanupOutdatedCaches`, but no e2e proof (P1) |
| Any future transform on `<main>` re-breaks every `fixed` overlay | **New** | BUG-007 is systemic; the portal option removes the class of bug |

Invariants, unchanged: `import type { App }` is the only cross-boundary import; `scratch-cell.tsx`
has 0 `useState` and 0 mouse/touch handlers; every backend change starts in `packages/spec`; French
UI, English identifiers; no `pg`; `currency_ledger` in the same transaction as any balance change;
no external runtime asset or API call.
