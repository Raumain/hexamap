# Hexagone — Technical Roadmap Phases 12 → 15

**Baseline:** branch `chore/phase-11-release`, Phase 11 marked *Terminé* in `.docs/03-active-task.md`.
**Scope:** build pipeline & container unification, design system, mobile ergonomics, PWA.
**Rule for every phase:** spec-first. Behaviour changes land in `packages/spec` before implementation (`packages/spec/AGENTS.md`: *« Toute évolution de comportement commence par une PR de spec dédiée »*).

---

## §0 — Corrections to the brief (verified against the repository)

The brief was redacted and contains four factual errors. This roadmap proceeds on the **verified** facts; each item below cites the file that settles it.

| # | Brief says | Reality | Evidence |
|---|---|---|---|
| 1 | "5 rarity tiers: Common to Mythic" | **6 tiers**, identifiers `COMMUNE / INHABITUELLE / RARE / EPIQUE / LEGENDAIRE / MYTHIQUE` | `packages/shared/src/rarity.ts:1-10`; `packages/db/src/schema.ts:3`; `packages/db/migrations/0004_reference.ts:40,59`; `.docs/01-architecture.md` §2 |
| 2 | `DESIGN_SYSTEM.md` rarity map | Stale: 5 English keys (`COMMON…MYTHIC`), no `LEGENDAIRE`, and maps `MYTHIC` to amber while the code maps `MYTHIQUE` to fuchsia | `DESIGN_SYSTEM.md` §3 vs `apps/web/src/components/ui/card-styles.ts` |
| 3 | "<ScratchCell/> is mouse-only, migrate to Pointer Events" | **Already Pointer Events only** — `pointerdown/move/up/cancel/leave` + `setPointerCapture` + `touch-none` + zero `useState` + 40 % alpha threshold | `apps/web/src/components/scratch-cell.tsx:120-215` |
| 4 | "Market table (`@tanstack/react-table`)" | Market is a plain `<ul>` of `<li>` cards, paginated at 20. `@tanstack/react-table` is used **only** in `collection.tsx` (v9 `tableFeatures` API) | `apps/web/src/routes/market.index.tsx`; `apps/web/src/routes/collection.tsx:5-21,188` |
| 5 | "TanStack Router comes with built-in PWA support" | **No.** Zero `pwa` / `service-worker` / `offline` / `webmanifest` / `workbox` occurrences across all 274 files in `TanStack/router/docs`, and none in `docs/router/config.json` or `docs/start/config.json` (the doc nav indexes). PWA is a Vite-plugin concern in this stack | `api.github.com/repos/TanStack/router/git/trees/main?recursive=1`; `raw.githubusercontent.com/TanStack/router/main/docs/{router,start}/config.json` |

Two smaller corrections with architectural consequences:

- **`DESIGN_SYSTEM.md` is aspirational, not descriptive.** `apps/web/src/styles.css` currently ships `.card-foil` / `.card-holo` / `.card-glitch` using `linear-gradient`, `conic-gradient` and `mix-blend-mode` — all explicitly forbidden by `DESIGN_SYSTEM.md` §1-§2. Phase 13 must **delete** those classes, not extend them.
- **`DESIGN_SYSTEM.md` §6 already specifies the mobile navigation** (fixed bottom bar + `md:` sidebar + sticky header) and the safe areas — it just was never implemented. Phase 14 executes that spec rather than inventing one.

---

## §1 — Verified baseline (what the roadmap builds on)

### Workspace & tooling

| Item | Reality |
|---|---|
| Package manager | `bun@1.4.4`, workspaces `apps/*`, `packages/*`, `scripts/*` |
| Root scripts | `dev:api`, `dev:web`, `build`, `typecheck` (6 workspaces), `lint`, `lint:fix`, `test`, `test:spec`, `db:migrate`, `db:types` |
| TS config | **No root `tsconfig.json`** — only `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `moduleResolution: bundler`, `noEmit`). No `paths` at base; `apps/web` adds `@/*` |
| Lint | `biome.json` 2.6.8, `recommended` preset, 2-space/100 cols, single quotes; excludes `apps/web/src/routeTree.gen.ts` and `packages/db/src/types.generated.ts` |
| CI | `.github/workflows/ci.yml` — single `quality` job in `oven/bun:1`, runs lint → typecheck → `bun test packages/spec` → build. **No Postgres service**, no Docker build, no E2E |
| `scripts/ci-check.ts` | **Does not exist** |

### Containers (current: 2 images, 2 app containers)

| File | Present | Notes |
|---|---|---|
| `Dockerfile.api` | yes | stages `base` → `dev`/`build` → `prod`; `prod` is `oven/bun:alpine` but ships **only** `apps/api/dist/index.js` + `dist-db/migrate.js`. No web assets |
| `Dockerfile.web` | yes | `oven/bun:1` build → `nginx:1.27-alpine`, copies `apps/web/dist` |
| `apps/web/nginx.conf` | yes | `try_files $uri $uri/ /index.html`, proxies `/api/` and `/blasons/` to `api:3000` |
| `compose.yml` | yes | dev: `db`, `dev` (profile `tools`), `pgadmin` (profile `admin`), `api`, `web`. Networks `frontend`, `backend` (`internal: true`), `admin` |
| `docker-compose.prod.yml` | yes | `db` + `api` (no published port) + `web` (nginx, publishes `8080`) |
| `docker-compose.e2e.yml` | yes | `db`/`api`/`web`/`playwright`, DB `hexamap_e2e` |
| `scripts/prod-entrypoint.sh` | yes | runs migrations when `RUN_MIGRATIONS=1` |
| `.dockerignore` | yes | excludes `**/dist`, `.env`, `node_modules` |

### API (`apps/api`)

- `src/index.ts` — `app.listen(env.PORT)` only.
- `src/app.ts` — `cors`, `openapi({ path: '/api/docs' })`, `GET /api/v1/health`, `GET /api/v1/health/db`, `publicRoutes` (`/api/v1`, import-status), `protectedRoutes` (`/api/v1` + `authPlugin` + ref/tickets/cards/tableaux/market + `/me`), `blasonRoutes` at root `/blasons/*`, `.mount(auth.handler)`, `export type App = typeof app`.
- **No `@elysiajs/static`, no SPA fallback, no `onError`.** Wildcard `GET /blasons/*` already claims a root prefix with a hand-rolled traversal guard + ETag (`src/routes/blasons.ts`).
- `src/env.ts` (zod): `NODE_ENV`, `PORT`, `DATABASE_URL`, `APP_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, `FRONTEND_URL` (required in prod), `TRUSTED_ORIGINS`, `AUTH_COOKIE_SECURE`, `BLASONS_DIR` (`/data/blasons`), `IMPORT_STATUS_DIR`.
- `packages/db/src/index.ts` → `createDb()` uses **`postgres` (postgres.js) via `kysely-postgres-js`, `{ max: 10 }`** — invariant satisfied, `pg` never imported.
- ACID invariants satisfied: `.forUpdate()` at `routes/tickets.ts:227`, `routes/market.ts:288,372,398,416,510`, `routes/tableaux.ts:557`; `currency_ledger` written inside the market transaction (`market.ts:446`).

### Web (`apps/web`)

- React `19.3.1`, `@tanstack/react-router` `1.170.46`, `-query` `5.107.1`, `-table` `9.3.1`, `-virtual` `3.14.26`, Tailwind `4.3.5` (CSS-first, `@tailwindcss/vite`), Vite `8.3.8`, `@elysia/eden` `1.4.10`.
- `vite.config.ts` — `tanstackRouter` + `react` + `tailwindcss`; port `5174`; proxies `/api` **and** `/blasons` to `API_INTERNAL_URL`.
- `build` = `tsr generate && tsc --noEmit && vite build`. Route generation is part of the build.
- `styles.css` — **no `@theme`, no `@font-face`, no tokens**; only the forbidden foil/holo/glitch classes. All colours are default Tailwind palettes.
- `__root.tsx` — single flat horizontal `<nav>` (5 links + balance pill + greeting + logout), `bg-slate-950 text-slate-100`, `max-w-5xl`. No sidebar, no bottom bar, no wrap.
- Breakpoints in use: **only `sm:` and `lg:`** (8 occurrences app-wide). No `md:`.
- Virtualization: `collection.tsx` (rows) and `tableau.tsx` (drawer list). Not used elsewhere.

### Spec / e2e

- `packages/spec` — 6 files, ~110 passing + **2 pre-existing failures** (`.docs/03-active-task.md`: `Plan §5.6 — un référentiel totalement vide reste une erreur explicite`, 5 s timeout).
- Pattern: `app.handle(new Request(...))` — **never a listening port**; `runMigrations(db)` in `beforeAll`; unique per-file prefix (`crypto.randomUUID().slice(0,8)`); manual `afterAll` cleanup. **No shared fixtures, no per-worker schema.**
- `packages/e2e` — Playwright, `baseURL` `E2E_BASE_URL ?? http://localhost:8080`, `workers: 1`, **no `webServer` block** (expects the Docker stack up).

### Documentation

- `.docs/01-architecture.md` (299 lines, source of truth), `.docs/02-database.md` (605 lines, SQL contract), `.docs/03-active-task.md` (Phase 11 journal).
- `DESIGN_SYSTEM.md` (264 lines, §1-§6.4) — normative for UI, **but** its rarity map is stale and its own §1 forbids what `styles.css` currently does.
- **No `ROADMAP.md`, no PWA documentation anywhere.**

---

## Phase 12 — Pre-Build Gatekeeper & Unified Single-Container Build

### 12.1 Current state audit

**Working:** `bun run lint`, `bun run typecheck` and `bun run build` all exist and are green individually. `Dockerfile.api` already has a lean `oven/bun:alpine` prod stage.

**Gaps / debt found:**

1. **No gatekeeper.** Three separate commands, no fail-fast wrapper, no ordering guarantee. `README.md` and `.github/pull_request_template.md` list them as four manual checkboxes.
2. **CI cannot run the spec suite successfully.** `.github/workflows/ci.yml` runs `bun test packages/spec` in a bare `oven/bun:1` container with **no PostgreSQL**. `packages/spec/src/*.spec.ts` call `createDb(process.env.DATABASE_URL ?? '')` — in CI this yields an empty connection string and every integration spec fails. The workflow is currently decorative for the integration half.
3. **The spec suite is not green.** 2 known failures (`Plan §5.6`, 5 s timeout). A gatekeeper that cannot pass is worthless — **this must be fixed inside Phase 12, not deferred.**
4. **Specs share one database.** Despite `packages/spec/AGENTS.md` claiming *« un schéma isolé par worker »*, every file points at the same `DATABASE_URL` and relies on UUID prefixes + manual `afterAll`. A gatekeeper running against the dev database would pollute it.
5. **Two containers where one is required.** `docker-compose.prod.yml` runs `web` (nginx) + `api`. `apps/api` has no static capability at all — `grep static apps/api` returns zero matches, and `grep dist` only matches `package.json` scripts.
6. **Root-level route collision risk.** `GET /blasons/*` is registered on the bare app before `.mount(auth.handler)`; any naive `/*` SPA fallback will shadow it or `/api/*`.
7. **`.dockerignore` excludes `**/dist`** — correct for the build stage (which builds in-image) but a trap for anyone tempted to `COPY apps/web/dist` from the host.

### 12.2 Spec-first test plan

**New file `packages/spec/src/static.spec.ts`** — this is the contract for the unified server.

Fixtures (committed, tiny):
```
packages/spec/fixtures/web-dist/index.html        <!-- <div id="root"></div> -->
packages/spec/fixtures/web-dist/assets/app-fixture.js
packages/spec/fixtures/web-dist/manifest.webmanifest
```

Because `env` is parsed at import time, this spec must use a **dynamic import** and set `process.env.WEB_DIST_DIR` before it:

```ts
// packages/spec/src/static.spec.ts
process.env.WEB_DIST_DIR = new URL('../fixtures/web-dist', import.meta.url).pathname;
const { app } = await import('@hexamap/api/app');
```

Test cases (names in French, referencing `Archi §6.1`):

| # | Test | Assertion |
|---|---|---|
| 1 | `Archi §6.1 — GET / renvoie la coquille SPA` | 200, `content-type` starts `text/html`, body contains `id="root"` |
| 2 | `Archi §6.1 — une route cliente inconnue retombe sur index.html` | `GET /collection` → 200 `text/html` + body `id="root"` |
| 3 | `Archi §6.1 — un asset haché est servi avec un cache immuable` | `GET /assets/app-fixture.js` → 200, `cache-control` contains `immutable`, `max-age=31536000` |
| 4 | `Archi §6.1 — index.html n'est jamais mis en cache` | `GET /` → `cache-control` contains `no-cache` |
| 5 | `Archi §6.1 — /api/v1/health reste du JSON` | 200, `content-type` `application/json`, body `{ status: 'ok' }` — **not** HTML |
| 6 | `Archi §6.1 — une route API inconnue renvoie un 404 JSON, jamais index.html` | `GET /api/v1/inexistant` → 404, JSON body with `code` |
| 7 | `Archi §6.1 — /api/auth est réservé à Better Auth` | `GET /api/auth/ok` → not `text/html` (whatever status) |
| 8 | `Archi §6.1 — /blasons reste servi par l'API` | regression test: `GET /blasons/x.svg` → 404 JSON (not index.html) when file absent |
| 9 | `Archi §6.1 — le manifeste PWA est servi avec le bon type MIME` | `GET /manifest.webmanifest` → `application/manifest+json` |
| 10 | `Archi §6.1 — la traversée de répertoire est refusée` | `GET /assets/../../../etc/passwd` → 404 |

**Fix `packages/spec/src/tickets.spec.ts`** — the `Plan §5.6 — un référentiel totalement vide reste une erreur explicite` test. Root cause to confirm during implementation: the 5 s default `bun:test` timeout combined with `drawCard` walking every rarity bucket. Fix by injecting a seeded RNG (`createRng(seed)` per `packages/spec/AGENTS.md`) and bounding the fallback loop, **not** by raising the timeout.

**New `scripts/ci-check.ts` has no unit test** — it is verified by running it (12.4).

### 12.3 File-by-file implementation plan

#### A. Gatekeeper

| Path | Action | Change |
|---|---|---|
| `scripts/ci-check.ts` | **create** | Sequential fail-fast runner. `Bun.spawn` with `{ stdout: 'inherit', stderr: 'inherit' }`, awaited one at a time, `process.exit(code)` on the first non-zero. Steps: (1) `bunx @biomejs/biome check .`; (2) `bun run typecheck`; (3) DB reachability probe — `createDb(process.env.DATABASE_URL!)` from `@hexamap/db` then `sql\`select 1\`` from `kysely`, failing with an explicit French message if unset/unreachable; (4) `bun test packages/spec`. Print `[hexamap] ✓ 1/4 Lint` style banners matching the existing `[hexamap]` French console convention. Identifiers and comments in English. Refuse to run if `NODE_ENV=production` (guards against wiping a prod DB). |
| `package.json` (root) | modify | Add `"ci:check": "bun run scripts/ci-check.ts"`. Leave `lint`/`typecheck`/`test` untouched — the gatekeeper composes them, it does not replace them. |
| `.github/workflows/ci.yml` | modify | Add a `postgres:16-alpine` **service** with healthcheck and `DATABASE_URL=postgres://hexamap:hexamap@localhost:5432/hexamap_test`. Replace the four steps with a single `bun run ci:check`. Keep `bun install --frozen-lockfile`. |
| `.github/pull_request_template.md` | modify | Replace the four checkboxes with `- [ ] bun run ci:check`. |
| `packages/spec/package.json` | modify | Add `"test:watch": "bun test --watch"` (optional DX). |
| `.env.example` | modify | Add `# Base de test dédiée au gatekeeper` + `TEST_DATABASE_URL`. |

#### B. Unified server (API serves the SPA)

| Path | Action | Change |
|---|---|---|
| `apps/api/src/static.ts` | **create** | `export const webRoutes = (root: string) => new Elysia({ name: 'routes.web' })` exposing `GET /*`. Handler logic, in order: (a) read `params['*'] ?? ''`; reject `..`, `\\`, leading `/`, empty segments — mirror the guard style already proven in `routes/blasons.ts`; (b) **if the path starts with `api/`, `api/auth` or `blasons/` → return a 404 JSON `{ code: 'ROUTE_NOT_FOUND', message: 'Ressource introuvable' }` and never fall back to HTML**; (c) if the resolved file exists and its extension is in an allow-list (`html,js,css,svg,webp,woff2,woff,ico,png,webmanifest,map`) serve it via `Bun.file` with an ETag; (d) otherwise serve `index.html` with `Cache-Control: no-cache`. `/assets/*` gets `public, max-age=31536000, immutable`; everything else `public, max-age=0, must-revalidate`. MIME map must include `webmanifest → application/manifest+json`. |
| `apps/api/src/env.ts` | modify | Add `WEB_DIST_DIR` (`z.string().default('./public')`) and `SERVE_WEB` (`z.enum(['true','false']).optional()`). |
| `apps/api/src/app.ts` | modify | After the protected group, `blasonRoutes` and `.mount(auth.handler)`, append `.use(webRoutes(resolve(env.WEB_DIST_DIR)))` **only when** `env.SERVE_WEB === 'true' \|\| env.NODE_ENV === 'production'`. Add a startup log line stating the assets root. Do **not** register a second `onError`. |
| `apps/api/package.json` | modify | Add `"start:prod": "NODE_ENV=production bun dist/index.js"` is unnecessary — `start` already exists; instead ensure `build` still emits only `dist/index.js`. |

#### C. Docker

| Path | Action | Change |
|---|---|---|
| `Dockerfile` | **create** (from `Dockerfile.api`) | Three stages. `deps` (`oven/bun:1`): copy every workspace `package.json` + `bun.lock`, `bun install --frozen-lockfile`. `build`: copy source, then `bun run --cwd apps/web build`, `bun run --cwd apps/api build`, `bun build packages/db/src/migrate.ts --outdir apps/api/dist-db --target bun`. `prod` (`oven/bun:alpine`): `COPY --from=build /app/apps/api/dist/index.js ./dist/index.js`, `.../dist-db/migrate.js ./db-migrate.js`, **`COPY --from=build /app/apps/web/dist ./public`**, `scripts/prod-entrypoint.sh`, `ENV NODE_ENV=production PORT=3000 WEB_DIST_DIR=/app/public SERVE_WEB=true`, `USER bun`, `EXPOSE 3000`, keep the existing `/api/v1/health` `HEALTHCHECK`. |
| `Dockerfile.api` | **delete** | Superseded by `Dockerfile`. |
| `Dockerfile.web` | **delete** | No second image. |
| `apps/web/nginx.conf` | **delete** | Nginx disappears from the topology. Keep it in git history only. |
| `docker-compose.prod.yml` | modify | Delete the `web` service. `api` becomes the only published service: `ports: ["${WEB_HOST_PORT:-8080}:3000"]`, and attaches to **both** networks (`backend` for Postgres, `public` for ingress) — `backend` is `internal: true` so a single-network attachment would make the published port unreachable. Add `WEB_DIST_DIR: /app/public`, `SERVE_WEB: "true"`, and `APP_URL`/`FRONTEND_URL`/`BETTER_AUTH_URL` all defaulting to the same origin. `depends_on: db healthy`. Healthcheck comes from the Dockerfile. |
| `docker-compose.e2e.yml` | modify | Delete `web`; run `api` as the edge with `E2E_BASE_URL=http://api:3000`; Playwright project gets `baseURL` from that. Keep the dedicated `hexamap_e2e` DB and `AUTH_COOKIE_SECURE=false`. |
| `compose.yml` | **unchanged** | Dev keeps `api` + Vite `web` for HMR. State explicitly in `README.md` that dev is two containers by design and prod is one. |
| `.dockerignore` | modify | Add `apps/web/dev-dist`, `.cache`, `ROADMAP.md`. Keep `**/dist` (the image builds its own). |
| `dev.sh` | modify | Add a `--prod` branch that runs `docker compose -f docker-compose.prod.yml up -d --build` and prints `http://localhost:8080`. (Note: `dev.sh` is currently locally modified and untracked-adjacent — confirm with the author before touching.) |

#### D. Docs

| Path | Action | Change |
|---|---|---|
| `README.md` | modify | Replace the "production = db + api + web" section with the single-container topology; document `bun run ci:check`; add the `Dockerfile` stage table. |
| `.docs/01-architecture.md` | modify | §6.1: rewrite prod serving as *one edge container*; document the `/api/*` + `/blasons/*` exclusion rule and the new `static.ts` plugin. |
| `.docs/03-active-task.md` | modify | New entry: Phase 12 checklist + journal. |

### 12.4 Verification & acceptance criteria

```sh
# 1. Gatekeeper is green end-to-end (needs Postgres up)
docker compose up -d db
docker compose --profile tools run --rm dev bun run ci:check

# 2. It fails fast — intentionally break a file, expect exit 1 on step 1
docker compose --profile tools run --rm dev bunx @biomejs/biome check .

# 3. Production image builds and the SPA is served
docker compose -f docker-compose.prod.yml up --build -d
curl -fsS http://localhost:8080/api/v1/health          # {"status":"ok",...}
curl -fsSI http://localhost:8080/collection | head -1  # HTTP/1.1 200, text/html
curl -fsS  http://localhost:8080/api/v1/inexistant     # 404 JSON, not HTML
curl -fsSI http://localhost:8080/assets/$(ls apps/web/dist/assets | head -1) | grep -i cache-control

# 4. E2E on the unified image (web service removed)
docker compose -f docker-compose.e2e.yml up -d --build db api
docker compose -f docker-compose.e2e.yml run --rm playwright
docker compose -f docker-compose.e2e.yml down -v

# 5. Container count assertion — exactly two
docker compose -f docker-compose.prod.yml ps --format '{{.Service}}'   # db, api
docker images | grep -c hexamap-prod-   # 1 application image
```

**Acceptance:**

- [ ] `bun run ci:check` runs the 4 steps **in order** and exits non-zero at the first failure (proven by an intentional break).
- [ ] `packages/spec` is **fully green**, including the two previously failing `tickets.spec.ts` cases.
- [ ] `static.spec.ts` — all 10 cases pass.
- [ ] `docker compose -f docker-compose.prod.yml up` starts exactly **two** containers.
- [ ] Deleting `Dockerfile.web`, `Dockerfile.api` and `apps/web/nginx.conf` leaves `bun run build` green.
- [ ] No `pg` import anywhere: `grep -rn "from 'pg'" apps packages` → empty.
- [ ] Deep-linking `/collection` and `/market/mine` in a fresh browser tab returns the app (not 404).
- [ ] `docker-e2e` suite green with `web` removed.

**Do not:** introduce `@elysiajs/static` (hand-rolled `Bun.file` + ETag is already the established pattern in `routes/blasons.ts` and keeps TypeBox response typing intact); make the SPA fallback intercept `/api/*`; skip the failing spec fix "to unblock the pipeline".

---

## Phase 13 — "IGN Cartography & French Road Signage" Design System

### 13.1 Current state audit

**Working:** `components/ui/Card.tsx` already renders 4 variants procedurally (inline SVG shield for territories, `RuePlaque` with 4 rivets), rarity is data-driven through `RARITY_CARD_STYLES`, and combo scoring is *already* server/pure-function-driven (`evaluateTableauAlignment`, `tableauScore` from `@hexamap/shared`) — never recomputed in the browser.

**Gaps / debt found:**

1. **Zero design tokens.** `apps/web/src/styles.css` has no `@theme`, no CSS custom properties, no `@font-face`. Every colour is a default Tailwind palette value.
2. **The current CSS actively violates the target system.** `styles.css` defines `.card-foil`, `.card-glow`, `.card-holo`, `.card-glitch` built on `linear-gradient`, `conic-gradient` and `mix-blend-mode: screen/overlay/color-dodge/soft-light` — exactly what `DESIGN_SYSTEM.md` §1-§2 forbids. `card-styles.ts` additionally uses `bg-gradient-to-tr from-slate-800 to-slate-900`.
3. **No `apps/web/src/lib/rarity-theme.ts`.** `DESIGN_SYSTEM.md` §3 mandates that exact file; it does not exist. Rarity styling is duplicated in three places: `components/ui/card-styles.ts`, `content/tickets.ts` (`RARITY_STYLES`, `RARITY_LABELS`), and locally re-declared `RarityBadge` components in `market.index.tsx`, `market.mine.tsx`, `tableaux.tsx`, `tableau.tsx`.
4. **No typographic pairing and no numeric discipline.** No font is loaded; no element enforces `font-mono tabular-nums`. Population/score/price/multiplier are formatted with `Intl.NumberFormat('fr-FR')` in `content/market.ts` and `revealed-cell.tsx`, but the *monospace* invariant is not applied.
5. **`DESIGN_SYSTEM.md`'s rarity map is stale** (5 tiers, English keys) — see §0.1.
6. **`DESIGN_SYSTEM.md` §5.2 (Département) is prose only** — no JSX reference, unlike §5.1/5.3/5.4. It must be authored.
7. **Combo board has no visual connectors** — `tableau.tsx` renders 4 slot cards in a `grid gap-4 sm:grid-cols-2` with a separate right-hand `MultiplierPanel`. Alignment exists as data (`alignment.links`) but is only surfaced as ✓/✗ text, not as geometry.

### 13.2 Spec-first test plan

**A. `packages/shared` — the only shared-logic change in this phase.**

Move the rarity presentation *data* (not Tailwind classes) into shared so it can be spec-tested and can never drift from the domain:

- `packages/shared/src/rarity.ts` — add `RARITY_LABELS: Record<Rarity, string>` = `{ COMMUNE: 'Commune', INHABITUELLE: 'Peu commune', RARE: 'Rare', EPIQUE: 'Épique', LEGENDAIRE: 'Légendaire', MYTHIQUE: 'Mythique' }` and `RARITY_ACCENT_HEX: Record<Rarity, string>`.

**New `packages/spec/src/rarity.spec.ts`:**

| # | Test | Assertion |
|---|---|---|
| 1 | `GDD §3.A — les libellés couvrent exactement les six paliers` | `Object.keys(RARITY_LABELS).sort()` deep-equals `[...RARITY].sort()` |
| 2 | `GDD §3.A — aucun palier n'est absent du thème` | `Object.keys(RARITY_ACCENT_HEX)` also covers exactly `RARITY` |
| 3 | `GDD §3.A — les libellés français sont exacts` | table-driven: `LEGENDAIRE → 'Légendaire'`, `INHABITUELLE → 'Peu commune'`, … |
| 4 | `GDD §3.A — les poids de rareté somment à 100` | `RARITY_WEIGHTS` sum ≈ 100 |

**B. `packages/e2e/tests/design-system.spec.ts`** (new) — the visual contract cannot live in `packages/spec` (no DOM, no `apps/web` dependency):

| # | Test | Assertion |
|---|---|---|
| 1 | `jetons — le fond de page est le papier cartographique` | computed `background-color` of `<body>` === `rgb(244, 241, 234)` (`#F4F1EA`) |
| 2 | `jetons — aucun dégradé ni verre dépoli` | no element on `/collection` has a non-`none` `background-image` containing `gradient`, nor `backdrop-filter !== 'none'` |
| 3 | `typographie — les nombres sont en mono tabulaire` | every element rendering a score/price/population has `font-variant-numeric: tabular-nums` and `font-family` matching `/JetBrains Mono/` |
| 4 | `carte — les quatre gabarits sont structurellement distincts` | Région contains `svg` contour paths; Département contains the department-number watermark; Commune matches the EB10 red-border shell; Rue has `bg` = `#003399` and a white inner border |
| 5 | `carte — budget DOM de 12 nœuds` | `el.querySelectorAll('*').length + 1 <= 12` on a rendered card inside a virtual row |
| 6 | `tableau — le multiplicateur affiché vient du serveur` | with 0/1/2/3 valid links the panel shows `×1,0 / ×1,5 / ×2,5 / ×5,0` and the badge text matches `TABLEAU_LINK_LABELS` |

### 13.3 File-by-file implementation plan

#### A. Tokens & typography

| Path | Action | Change |
|---|---|---|
| `apps/web/src/styles.css` | **rewrite** | `@import "tailwindcss";` then a single `@theme` block with exactly the `DESIGN_SYSTEM.md` §3 tokens: `--color-canvas:#F4F1EA`, `--color-surface:#FFFFFF`, `--color-muted:#E6E2D8`, `--color-border:#1E293B`, `--color-ink:{DEFAULT:#0F172A,secondary:#475569,muted:#94A3B8,inverse:#F8FAFC}`, `--color-sign-blue:#003399`, `--color-sign-green:#005C36`, `--color-sign-red:#D92323`, `--color-sign-ochre:#C25E00`, `--color-sign-gold:#D97706`; `--font-sans: "Space Grotesk", Inter, system-ui, sans-serif`; `--font-mono: "JetBrains Mono", ui-monospace, monospace`; `--shadow-tactile: 2px 2px 0 0 #0F172A`, `--shadow-tactile-sm: 1px 1px 0 0 #0F172A`, `--shadow-tactile-lg: 4px 4px 0 0 #0F172A`. **Delete** `card-foil`, `card-glow`, `card-holo`, `card-glitch` and all their keyframes. Add `@font-face` × 2 (`font-display: swap`). Add one `@layer base` rule: `body { background: var(--color-canvas); color: var(--color-ink); }` and a `.num` utility (`font-mono tabular-nums`). |
| `apps/web/public/fonts/SpaceGrotesk-Variable.woff2` | **create** | Self-hosted. **No Google Fonts CDN** — zero external runtime calls is an invariant. Subset latin + latin-ext (French accents). |
| `apps/web/public/fonts/JetBrainsMono-Variable.woff2` | **create** | Same. |
| `apps/web/index.html` | modify | Add `<link rel="preload" as="font" type="font/woff2" crossorigin>` for both files. |

#### B. Rarity theme (single source of truth)

| Path | Action | Change |
|---|---|---|
| `packages/shared/src/rarity.ts` | modify | Add `RARITY_LABELS`, `RARITY_ACCENT_HEX` (6 keys each). |
| `apps/web/src/lib/rarity-theme.ts` | **create** | `RARITY_THEME: Record<Rarity, { border: string; badge: string; surface: string; label: string; accent: string }>` — **6 entries**, keyed by the domain identifiers. Values are the literal `DESIGN_SYSTEM.md` §3 classes mapped onto the correct tiers: `COMMUNE → border-slate-400 / bg-slate-200 text-slate-800`, `INHABITUELLE → border-emerald-700 / bg-emerald-100 text-emerald-900`, `RARE → border-blue-700 / bg-blue-100 text-blue-900`, `EPIQUE → border-purple-800 / bg-purple-100 text-purple-900`, `LEGENDAIRE → border-amber-600 / bg-amber-100 text-amber-950`, `MYTHIQUE → border-amber-500 ring-1 ring-amber-500 / bg-amber-50 text-amber-950`. Invert the stale `DESIGN_SYSTEM.md` mapping so that **amber belongs to MYTHIQUE** as the original GDD intends, and give `LEGENDAIRE` the ochre `#C25E00` treatment. |
| `apps/web/src/components/ui/card-styles.ts` | **delete** | Fully replaced by `lib/rarity-theme.ts`. |
| `apps/web/src/content/tickets.ts` | modify | Remove `RARITY_LABELS` and `RARITY_STYLES`; re-export from `@hexamap/shared` (`RARITY_LABELS`) and `lib/rarity-theme.ts` (`RARITY_BADGE`). Keeps `content/` as the label layer without duplicating data. |
| `apps/web/src/components/ui/rarity-badge.tsx` | **create** | The one `<RarityBadge rarity/>` component. Delete the four local duplicates in `market.index.tsx`, `market.mine.tsx`, `tableaux.tsx`, `tableau.tsx`. |

#### C. The four procedural card templates

| Path | Action | Change |
|---|---|---|
| `apps/web/src/components/ui/card.tsx` | **rewrite** | One shell: `article` with `aspect-[3/4] w-full rounded-md border-2 bg-surface p-2.5 flex flex-col justify-between select-none relative overflow-hidden` + `RARITY_THEME[rarity].border`. Then switch on `type` to 4 sub-components, each **≤ 12 DOM nodes** (rivets/filigree via `::before`/`::after`, never extra elements). |
| `apps/web/src/components/ui/cards/region-card.tsx` | **create** | Topographic motif: a single inline `<svg viewBox="0 0 100 140">` with **3 `<path>`** contour lines, `stroke=var(--color-sign-ochre)`, `fill=none`, `stroke-width=.75`, on `#FAF8F5`. Node budget: article + svg + 3 paths + header + badge + h3 + footer + score = **10**. |
| `apps/web/src/components/ui/cards/departement-card.tsx` | **create** | Authored from scratch (`DESIGN_SYSTEM.md` §5.2 has no JSX). Large watermark department code (`font-mono text-4xl font-black text-ink/10`), geometric octagonal shield via a `clip-path` on a bordered `div`, INSEE code + name. Node budget: article + watermark + shield + h3 + code + footer + score = **7**. |
| `apps/web/src/components/ui/cards/commune-card.tsx` | **create** | EB10 road sign: `border-2 border-sign-red bg-white rounded-sm`, title `text-xs md:text-sm font-black uppercase tracking-tight text-ink line-clamp-2`, population chip `bg-muted font-mono tabular-nums text-[10px]`, INSEE badge. Node budget: article + header + category + rarity + h3 + population + footer + score + insee = **9**. |
| `apps/web/src/components/ui/cards/rue-card.tsx` | **create** | Enamel plaque: `bg-sign-blue` (`bg-sign-green` for `RARE`+), inner `border border-white/80`, title `font-bold uppercase tracking-wide`, footer `{nbCommunes} rép. FR` in `font-mono tabular-nums`. **4 rivets via two pseudo-elements** (`::before` top-left+bottom-right, `::after` top-right+bottom-left, `box-shadow`), not 4 DOM nodes. Node budget: **6**. |
| `apps/web/src/components/revealed-cell.tsx` | modify | Consume `RarityBadge` + `lib/rarity-theme.ts`; drop the inline `RARITY_STYLES` import. Replace `rounded-2xl`/`shadow-[0_0_14px…]` (forbidden) with `rounded-sm` + `shadow-tactile-sm`. Apply `font-mono tabular-nums` to the score and the distance label. |
| `apps/web/src/components/scratch-cell.tsx` | modify | Cosmetic only in this phase: replace the `#334155→#1e293b` gradient fill with a flat `#E6E2D8` (`muted`) + `#94A3B8` hatch, and the 150 speckles with an `HEXAGONE`/`?` stamp per `DESIGN_SYSTEM.md` §6. Class `rounded-2xl` → `rounded-md`, `border-slate-700` → `border-2 border-border`. **Do not touch the pointer logic here** — that is Phase 14. |

#### D. Combo board connectors

| Path | Action | Change |
|---|---|---|
| `apps/web/src/components/tableau/combo-board.tsx` | **create** | Lays out the 4 slots in a 2×2 (mobile) / 1×4 (lg) grid, rendering the 3 connectors **between** slots. Connector visual state derives **only** from `preview.alignment.links` returned by `GET /api/v1/tableaux/preview` — no client-side re-derivation, no duplicated scoring. |
| `apps/web/src/components/tableau/alignment-connector.tsx` | **create** | `<svg aria-hidden>` + a 2px line; valid → `stroke-emerald-700` + ✓ badge `bg-emerald-100 text-emerald-900 border border-emerald-700`; invalid → `stroke-slate-400` dashed + ✗ `bg-slate-200 text-slate-600`. Inline `<span class="sr-only">` carrying `TABLEAU_LINK_LABELS[key]` + "aligné"/"hors-zone". |
| `apps/web/src/components/tableau/multiplier-panel.tsx` | **create** | Extracted from `tableau.tsx`. Giant `×{multiplier}` in `font-mono tabular-nums text-2xl md:text-4xl font-black`; uses `MULTIPLIER_TIERS` from `content/tableau.ts`; `<div aria-live="polite">` announcement on change. |
| `apps/web/src/routes/tableau.tsx` | modify | Replace the `grid gap-4 sm:grid-cols-2` slot grid + inline `MultiplierPanel` with `<ComboBoard/>` + `<MultiplierPanel/>`. Keep `CardDrawer` as-is (already virtualized). |
| `apps/web/src/routes/tableaux.tsx` | modify | Swap the card grid to use the new templates + `RarityBadge`; render the saved alignment with `AlignmentConnector` instead of ✓/✗ text. |

#### E. Documentation

| Path | Action | Change |
|---|---|---|
| `DESIGN_SYSTEM.md` | **modify, commit first** | §3 rarity map: 5 → **6** tiers with the code identifiers; `LEGENDAIRE` in amber-600/ochre, `MYTHIQUE` as the single gold+ring tier. Add the missing §5.2 Département JSX. Add §7 "Roadmap phase mapping". This file is currently **untracked** — it must be committed before being referenced. |
| `.docs/01-architecture.md` | modify | Add §4.8 "Design system: tokens, rarity theme, 12-node budget". |
| `.docs/03-active-task.md` | modify | Phase 13 checklist. |

### 13.4 Verification & acceptance criteria

```sh
docker compose --profile tools run --rm dev bun test packages/spec
docker compose --profile tools run --rm dev bun run --cwd apps/web build
docker compose up -d --build db api web
docker compose -f docker-compose.e2e.yml run --rm playwright -- test design-system
```

**Manual / visual:**

- Compare `/collection` and `/tableau` side by side with `DESIGN_SYSTEM.md` §5.1-§5.4 — four visually distinct templates.
- DevTools: `document.querySelectorAll('body *')` filtered for a non-`none` `background-image` → only the Région contour SVG, no `gradient`, no `backdrop-filter`.
- Every number (score, price, population, multiplier, balance) renders in JetBrains Mono with tabular figures.
- Add/remove a slot on `/tableau` → connectors and `×N` change without a full page reload.

**Acceptance:**

- [ ] `RARITY_THEME` has exactly **6** keys, matching `RARITY` — enforced by `packages/spec/src/rarity.spec.ts`.
- [ ] `grep -rn "gradient\|mix-blend-mode\|backdrop-blur" apps/web/src` → only the Région contour `svg` (no CSS gradients).
- [ ] `grep -rn "rounded-2xl\|rounded-3xl\|shadow-lg\|shadow-xl" apps/web/src` → empty.
- [ ] A rendered card is ≤ 12 DOM nodes (measured in the e2e test).
- [ ] `content/tickets.ts` no longer declares `RARITY_LABELS`/`RARITY_STYLES`; exactly one `RarityBadge` component exists.
- [ ] UI text is 100 % French; code identifiers English.
- [ ] Zero network requests to font/CDN hosts at runtime (Network tab, hard reload).

**Do not:** keep the `card-foil/holo/glitch` classes; introduce a gradient even for "rarity glow"; write a 5-tier rarity map; add an i18n library; compute a multiplier in the browser.

---

## Phase 14 — Mobile-First Ergonomics & Touch Engine

### 14.1 Current state audit

**Working (better than the brief assumes):**

- `components/scratch-cell.tsx` **already** uses native Pointer Events exclusively (`pointerdown/move/up/cancel/leave`), calls `setPointerCapture`, has `touch-none` on both the `<button>` and the `<canvas>`, contains **zero `useState`**, and fires `onReveal` exactly once via a `firedRef` latch.
- The 40 % threshold is implemented correctly at device-pixel resolution (`getImageData`, alpha `< 128`, `erased / total >= 0.4`, `REVEAL_THRESHOLD = 0.4`).
- `collection.tsx` already virtualizes rows with `@tanstack/react-virtual` and has a sticky header.
- `tableau.tsx`'s `CardDrawer` is virtualized.

**Gaps / debt found:**

1. **No mobile navigation at all.** `__root.tsx` renders 5 text links + balance + greeting + logout in a single non-wrapping `flex` row inside `max-w-5xl`. On a 360 px viewport this overflows horizontally. There is no `md:` in the codebase, no hamburger, no drawer, no bottom bar, no sidebar.
2. **`apps/web/index.html` viewport meta lacks `viewport-fit=cover`** — without it `env(safe-area-inset-*)` resolves to `0` and a bottom bar will sit under the iOS home indicator.
3. **`collection.tsx` uses one fixed 6-column grid on every viewport**: `grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,0.8fr)]` plus a `min-w-64` filter rail and a fixed `h-[32rem]` scroll box. Unusable below ~768 px.
4. **Brush radius is a constant `BRUSH_SIZE = 26` CSS px** (`scratch-cell.tsx`). On a phone the cell is ~76 px wide, so the brush covers ~34 % of the cell width versus ~13 % on desktop — touch difficulty is viewport-dependent and untested.
5. **No `requestAnimationFrame` throttling** despite `.docs/01-architecture.md` §4.6 requiring `ref` + `requestAnimationFrame`. Every `pointermove` paints synchronously *and* every 6th does a full-resolution `getImageData` scan.
6. **Resize destroys progress silently.** `ResizeObserver` only repaints while `moveCountRef.current === 0`; any rotation/resize after the first stroke leaves a stale backing store.
7. **The `<canvas>` lacks `select-none`** (`DESIGN_SYSTEM.md` §6 asks for `touch-none select-none cursor-crosshair`). Long-press can still trigger text selection / the iOS callout on the wrapping button.
8. **Market buy button has no per-listing pending state.** `market.index.tsx` shares one `buyListing` mutation across the list; nothing prevents a double-tap from firing twice, and `disabled` is not tied to `mutation.isPending`.
9. **Market listings are a single-column `<ul>`** at every width — 20 items per page rendered full-width on a phone.
10. **`tableau.tsx` slots are `sm:grid-cols-2`** — 2 columns from 640 px, so a 2×2 board on mobile but no deliberate thumb-zone layout.

### 14.2 Spec-first test plan

`packages/spec` is backend/shared only — **no DOM**. Mobile ergonomics is verified in `packages/e2e`. The only spec-package addition is a shared constant so brush sizing is testable:

- `packages/shared/src/ui.ts` (new): `export const SCRATCH_REVEAL_THRESHOLD = 0.4;` and `export function scratchBrushRadius(cssWidth: number, cssHeight: number): number` → `clamp(18, 40, round(min(w,h) * 0.18))`. Move the magic numbers out of the component.

**New `packages/spec/src/ui.spec.ts`:**

| # | Test | Assertion |
|---|---|---|
| 1 | `Archi §4.6 — le seuil de révélation reste à 40 %` | `SCRATCH_REVEAL_THRESHOLD === 0.4` |
| 2 | `Archi §4.6 — le rayon du pinceau suit la taille de la case` | `scratchBrushRadius(76,76) < scratchBrushRadius(140,140)` |
| 3 | `Archi §4.6 — le rayon est borné` | `scratchBrushRadius(10,10) === 18`, `scratchBrushRadius(400,400) === 40` |

**New `packages/e2e/tests/mobile.spec.ts`** — add `Pixel 7` and `iPhone 13` projects to `playwright.config.ts`:

| # | Test | Assertion |
|---|---|---|
| 1 | `mobile — la barre d'onglets est visible et le menu latéral masqué` | `BottomTabBar` visible; `Sidebar` `not.toBeVisible()` at 412 px |
| 2 | `bureau — le menu latéral est visible et la barre masquée` | inverse at 1280 px |
| 3 | `mobile — l'en-tête ne déborde pas` | `document.documentElement.scrollWidth <= innerWidth` |
| 4 | `mobile — les cibles tactiles font au moins 44 px` | every tab + scratch cell `boundingBox().height >= 44` |
| 5 | `mobile — gratter au doigt révèle la case` | `page.touchscreen` drag across a cell; `expect.poll` until the cell flips to revealed |
| 6 | `mobile — gratter ne fait pas défiler la page` | record `window.scrollY` before/after the drag; unchanged |
| 7 | `mobile — la collection passe en liste condensée` | at 412 px `score`/`locked`/`acquiredAt` cells hidden; at 1280 px visible |
| 8 | `mobile — le marché s'affiche en deux colonnes` | `getComputedStyle(list).gridTemplateColumns` has 2 tracks |
| 9 | `market — un double-appui n'achète qu'une fois` | throttle the route to 2 s, double-tap buy, assert exactly one `POST /listings/:id/buy` and button `disabled` while pending |

### 14.3 File-by-file implementation plan

#### A. Shell & navigation

| Path | Action | Change |
|---|---|---|
| `apps/web/src/components/layout/app-shell.tsx` | **create** | `min-h-dvh bg-canvas text-ink`; renders `<TopBar/>`, `<Sidebar/>`, `<main className="pb-20 md:pb-8 md:pl-60">{children}</main>`, `<BottomTabBar/>`. |
| `apps/web/src/components/layout/top-bar.tsx` | **create** | `sticky top-0 z-30 h-14 border-b-2 border-border bg-surface`; logo `<Link to="/">Hexagone</Link>`; `<CurrencyPill/>`; profile menu. Reserve `pt-[env(safe-area-inset-top)]` (applied definitively in Phase 15). |
| `apps/web/src/components/layout/sidebar.tsx` | **create** | `hidden md:flex md:w-60 md:flex-col border-r-2 border-border bg-surface fixed inset-y-0 left-0`. Links per `DESIGN_SYSTEM.md` §6: *Tickets à Gratter* `/`, *Ma Collection* `/collection`, *Tableau de Combo* `/tableau`, *Marché National* `/market`; secondary: *Mes tableaux* `/tableaux`, *Mes ventes* `/market/mine`. Inline SVG icons only (no icon dependency). `aria-current="page"` on the active link via `useMatchRoute`. |
| `apps/web/src/components/layout/bottom-tab-bar.tsx` | **create** | `fixed bottom-0 inset-x-0 z-40 flex md:hidden h-16 border-t-2 border-border bg-surface pb-[env(safe-area-inset-bottom)]`. Exactly **4** equal tabs (`flex-1 flex flex-col items-center justify-center text-xs font-medium`): Tickets / Collection / Tableau / Marché. Active: `bg-amber-100/70 text-ink font-bold border-t-2 border-ink`. Each tab `min-h-11` (44 px). |
| `apps/web/src/components/layout/currency-pill.tsx` | **create** | Extracted from `__root.tsx`'s `<span>`: `bg-surface border-2 border-border shadow-tactile-sm px-3 py-1 rounded-sm font-mono tabular-nums font-bold text-sm`. Single source for the balance. |
| `apps/web/src/routes/__root.tsx` | **rewrite** | Drop the flat nav; render `<AppShell><Outlet/></AppShell>`. Keep the `useSession()` gate + `signOut` flow verbatim. |
| `apps/web/index.html` | modify | `viewport` → `width=device-width, initial-scale=1.0, viewport-fit=cover`. |
| `apps/web/src/styles.css` | modify | Add `html { -webkit-tap-highlight-color: transparent; }` and `body { overscroll-behavior-y: contain; }` to stop pull-to-refresh on the ticket grid. |

#### B. Scratch engine hardening

| Path | Action | Change |
|---|---|---|
| `packages/shared/src/ui.ts` | **create** | `SCRATCH_REVEAL_THRESHOLD`, `scratchBrushRadius` (pure, spec-tested). Register in `packages/shared/src/index.ts`. |
| `apps/web/src/components/scratch-cell.tsx` | **modify** | (1) import `SCRATCH_REVEAL_THRESHOLD` + `scratchBrushRadius` from `@hexamap/shared`; delete the local `BRUSH_SIZE`/`REVEAL_THRESHOLD`. (2) In `paint()`, compute `brushRef.current = scratchBrushRadius(w, h)` so the radius tracks cell size. (3) `onPointerMove`: store the point in `pendingPointRef` and schedule one `requestAnimationFrame(flushRef)` if not already scheduled; `flush` draws the segment `lastPointRef → pendingPointRef`, increments `moveCountRef`, and runs `checkCoverage()` every 6 moves — cancel the rAF in the effect cleanup. (4) `ResizeObserver`: if `moveCountRef.current > 0`, copy the canvas into a detached `document.createElement('canvas')` at the old size, resize the backing store, and `drawImage(temp, 0, 0, w, h)` scaled — **preserving** erased pixels instead of skipping the repaint. (5) Add `select-none cursor-crosshair` to the `<canvas>` class list. (6) Keep `setPointerCapture` and the `pointerup/pointercancel/pointerleave` teardown exactly as-is. |
| `apps/web/src/routes/tickets.$ticketId.tsx` | modify | Grid: `grid grid-cols-4 gap-2 md:gap-3`; wrap in `<fieldset className="… overscroll-none">`. Cell labels drop below 10 px on small screens — bump to `text-[11px]`. Keep `firedCells` dedupe. |

#### C. Responsive lists

| Path | Action | Change |
|---|---|---|
| `apps/web/src/routes/collection.tsx` | modify | Two grid templates chosen by breakpoint via Tailwind arbitrary values on the shared `gridTemplate` constant: `grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[<existing 6-col template>]`. Hide `score`, `acquiredAt`, `locked` cells with `hidden md:flex` on both header and rows. Scroll box `h-[calc(100dvh-16rem)] md:h-[32rem]`. Filter rail `w-full md:min-w-64`. Virtualizer unchanged (`estimateSize` 84 stays valid — rows keep a fixed height). |
| `apps/web/src/routes/market.index.tsx` | modify | `<ul>` → `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3`. `ListingCard` gets a `compact` variant (`w-full`, card thumbnail `w-16`, meta stacked). Buy button: `disabled={mutation.isPending && mutation.variables?.id === listing.id}` + `aria-busy` + `touch-manipulation`; show "Achat…" for that row only. |
| `apps/web/src/routes/market.mine.tsx` | modify | Same responsive card grid; `SellForm` fields full-width (`grid-cols-1 sm:grid-cols-2`). |
| `apps/web/src/routes/tableaux.tsx` | modify | Keep `sm:grid-cols-2 lg:grid-cols-4`; ensure each `SlotCard` fits at 360 px (thumbnail `w-20 md:w-28`). |
| `apps/web/src/routes/tableau.tsx` | modify | Slot grid → `grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4`; `MultiplierPanel` `order-first lg:order-last`; `CardDrawer` max width `max-w-md` on desktop, full-height sheet `inset-x-0 bottom-0 top-16` on mobile. |

#### D. Docs

| Path | Action | Change |
|---|---|---|
| `.docs/01-architecture.md` | modify | §4.6: document the rAF batching, the size-derived brush radius, and the resize-preserving buffer copy. |
| `.docs/03-active-task.md` | modify | Phase 14 checklist. |
| `README.md` | modify | Note the `md` (768 px) breakpoint as the navigation switch. |

### 14.4 Verification & acceptance criteria

```sh
docker compose --profile tools run --rm dev bun test packages/spec
docker compose --profile tools run --rm dev bun run --cwd apps/web typecheck
docker compose -f docker-compose.e2e.yml up -d --build db api
docker compose -f docker-compose.e2e.yml run --rm playwright -- --project="Pixel 7" --project="iPhone 13"
```

**Manual (DevTools device emulation, 360×640 and 390×844):**

- Every route reachable from the bottom bar in one thumb movement; no horizontal scrollbar anywhere.
- Scratch a cell with a simulated touch drag → reveals, the page does **not** scroll, no text selection, no callout.
- Rotate the device mid-scratch (`ResizeObserver` fires) → already-erased area is still erased, scratched area scales proportionally.
- `/collection` on mobile shows 3 columns of card info + virtual scrolling still smooth; desktop still shows 6.
- Tap "Acheter" twice rapidly → only one purchase, button reads "Achat…" then resolves.

**Acceptance:**

- [ ] `grep -c "useState" apps/web/src/components/scratch-cell.tsx` → `0` (invariant preserved).
- [ ] `grep -n "onMouse\|onTouchStart\|onTouchMove" apps/web/src/components/scratch-cell.tsx` → empty.
- [ ] `grep -n "requestAnimationFrame" apps/web/src/components/scratch-cell.tsx` → present, with a matching `cancelAnimationFrame` in cleanup.
- [ ] `packages/spec/src/ui.spec.ts` — 3/3 pass; threshold still `0.4`.
- [ ] No `md:`-less layout remains on `/collection`, `/market`, `/market/mine`, `/tableau`.
- [ ] Playwright mobile projects green on both devices.
- [ ] Zero horizontal overflow at 320 px on all 10 routes.

**Do not:** bind pointer coordinates to `useState`; replace `setPointerCapture`; use a global scroll lock instead of `touch-action`; lower the 40 % threshold; add a UI framework for the tabs.

---

## Phase 15 — PWA Transformation & Production Polish *(must be last)*

### 15.1 Current state audit

**Gaps:**

1. **No PWA of any kind.** `vite-plugin-pwa` is absent from `apps/web/package.json`; `grep manifest` and `grep serviceWorker` over `apps/web/src` return zero matches; `index.html` has no `<link rel="manifest">` and no `theme-color`.
2. **No icons.** No `apps/web/public/` icon set, no favicon beyond the browser default.
3. **Safe areas architecturally blocked** — `index.html`'s viewport meta lacked `viewport-fit=cover` until Phase 14. The `env()` padding itself is not applied anywhere (`grep "env(safe-area"` → 0).
4. **Cache-coherence risk with the new unified server.** From Phase 12 all assets are served by `apps/api/src/static.ts` with `/assets/*` immutable. A service worker must align its precache manifest with those hashed names and must never intercept `/api/*` or `/blasons/*`.
5. ~~**Vite 8.3.8 compatibility is unverified.**~~ **Resolved — verified against the npm registry.** `vite-plugin-pwa@2.0.0` declares `peerDependencies.vite: "^3.1.0 || ^4.0.0 || ^5.0.0 || ^6.0.0 || ^7.0.0 || ^8.0.0"`, so **Vite 8.3.8 is officially supported**. Its other declared peers are `workbox-build ^7.4.1`, `workbox-window ^7.4.1` and `@vite-pwa/assets-generator ^1.0.0 || ^2.0.0` — these are **peer** dependencies, so pnpm-style auto-install will not happen; they must be added explicitly. `engines.node >= 20.19.0` (Bun 1.4.4 satisfies the runtime; the build stage is `oven/bun:1`). No `workbox-build` hand-rolled fallback is needed.
6. **`biome check .` will lint generated artefacts** (`sw.js`, `workbox-*.js`, `dev-dist/`) unless excluded — this would break the Phase 12 gatekeeper.

### 15.2 Spec-first test plan

No backend behaviour changes, so `packages/spec` gains only one assertion that belongs to the static plugin contract (already stubbed in `static.spec.ts` case 9). The rest lands in `packages/e2e/tests/pwa.spec.ts`:

| # | Test | Assertion |
|---|---|---|
| 1 | `PWA — le manifeste est conforme` | `GET /manifest.webmanifest` → `name: 'Hexagone'`, `lang: 'fr'`, `display: 'standalone'`, `orientation: 'portrait'`, `start_url: '/'`, icons ≥ 192 & 512 |
| 2 | `PWA — le service worker s'installe et prend le contrôle` | after reload, `navigator.serviceWorker.controller` is non-null; state `activated` |
| 3 | `PWA — la coquille est précachée` | offline reload of `/` still renders the shell (header + bottom bar) |
| 4 | `PWA — /api/* n'est jamais servi depuis le cache` | `context.setOffline(true)`, then `GET /api/v1/health` **rejects**; with the network back, it returns fresh data |
| 5 | `PWA — une navigation profonde hors-ligne retombe sur la coquille` | offline `goto('/collection')` renders the app shell (no browser error page) |
| 6 | `PWA — le cache ne contient aucune entrée /api` | `caches.keys()` + `cache.keys()` → no URL matching `/\/api\//` |
| 7 | `PWA — les zones sûres sont appliquées` | computed `padding-bottom` of the bottom bar parses to a non-negative px; `padding-top` of the header likewise |

### 15.3 File-by-file implementation plan

| Path | Action | Change |
|---|---|---|
| `apps/web/package.json` | modify | Add `"vite-plugin-pwa": "^2.0.0"` plus its three declared peers: `"workbox-build": "^7.4.1"`, `"workbox-window": "^7.4.1"`, `"@vite-pwa/assets-generator": "^2.0.0"`. All four are required — the last three are peers and will not be auto-installed. |
| `apps/web/vite.config.ts` | modify | Add `VitePWA({ registerType: 'prompt', injectRegister: false, strategies: 'generateSW', filename: 'sw.js', manifest: false, workbox: { navigateFallback: '/index.html', navigateFallbackDenylist: [/^\/api\//, /^\/blasons\//, /^\/api\/auth\//], globPatterns: ['**/*.{js,css,woff2,svg,webmanifest}'], globIgnores: ['**/index.html'], cleanupOutdatedCaches: true, clientsClaim: false, skipWaiting: false, runtimeCaching: [/**api-GET*/, /**api-POST*/, /**api-PUT*/, /**api-PATCH*/, /**api-DELETE*/, blasons] }, devOptions: { enabled: false } })`. **`NetworkOnly` must be registered once per HTTP method** — Workbox `runtimeCaching` entries default to `method: 'GET'`, so a single `urlPattern: /\/api\//` entry silently leaves `POST` (i.e. every Eden mutation) unmatched. Five explicit entries (`method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'`, `handler: 'NetworkOnly'`) plus one `urlPattern: /\/blasons\//, handler: 'StaleWhileRevalidate', options: { cacheName: 'blasons', expiration: { maxEntries: 200, maxAgeSeconds: 2592000 } }`. `manifest: false` is supported and correct here because the manifest is authored as a static file. **`registerType: 'prompt'`** so a deploy never hot-swaps the SW under a player mid-scratch. |
| `apps/web/public/manifest.webmanifest` | **create** | `{ "name": "Hexagone — TCG géographique français", "short_name": "Hexagone", "description": "Collectionnez les régions, départements, communes et rues de France.", "lang": "fr", "dir": "ltr", "start_url": "/", "scope": "/", "display": "standalone", "orientation": "portrait", "background_color": "#F4F1EA", "theme_color": "#003399", "icons": [ … ] }` |
| `apps/web/public/logo.svg` | **create** | Source mark: flat hexagon + IGN contour motif, inline-drawn, no external assets. This single SVG is the input for every generated icon. |
| `apps/web/pwa-assets.config.ts` | **create** | `defineConfig({ headLinkOptions: { preset: '2023' }, preset: { ...minimal2023Preset } })` from `@vite-pwa/assets-generator/config`, pointing `source` at `public/logo.svg`. This replaces the hand-rolled `sharp` script: the official generator emits `pwa-192x192.png`, `pwa-512x512.png`, `maskable-icon-512x512.png`, `apple-touch-icon-180x180.png` and `favicon.ico` — exactly the raster set Android/iOS installability requires. |
| `apps/web/public/icons/*` (generated) | **create** | Produced once by `bunx @vite-pwa/assets-generator` and **committed**, so the Docker build needs no network. Declared in the manifest with `"type": "image/png"` and explicit `sizes`/`purpose`; the `logo.svg` itself is declared as `"image/svg+xml", "sizes": "any"`. |
| `apps/web/index.html` | modify | Add `<link rel="manifest" href="/manifest.webmanifest">`, `<meta name="theme-color" content="#003399">`, `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<meta name="apple-mobile-web-app-title" content="Hexagone">`, `<link rel="apple-touch-icon" href="/icons/apple-touch-icon-180.png">`. |
| `apps/web/src/lib/pwa.ts` | **create** | `registerSW({ immediate: false, onNeedRefresh, onOfflineReady })` wrapper from `virtual:pwa-register`; French callbacks (`'Nouvelle version disponible'`, `'Prêt à jouer hors connexion'`). |
| `apps/web/src/components/layout/pwa-update-prompt.tsx` | **create** | Fixed banner above the bottom bar, `role="status"`, French copy, two buttons *Recharger* / *Plus tard*. Mounted in `AppShell`. |
| `apps/web/src/main.tsx` | modify | Call `initPwa()` after render. |
| `apps/web/src/vite-env.d.ts` | modify | Add `/// <reference types="vite-plugin-pwa/client" />`. |
| `apps/web/tsconfig.json` | modify | Add `"vite-plugin-pwa/client"` to `compilerOptions.types`. |
| `apps/web/src/components/layout/top-bar.tsx` | modify | `pt-[env(safe-area-inset-top)]` (+ `pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]` for landscape notch). |
| `apps/web/src/components/layout/bottom-tab-bar.tsx` | modify | `pb-[env(safe-area-inset-bottom)]` and `pr-[env(safe-area-inset-right)] pl-[env(safe-area-inset-left)]`. |
| `apps/web/src/components/layout/sidebar.tsx` | modify | `pl-[env(safe-area-inset-left)]` on the desktop rail. |
| `apps/api/src/static.ts` | modify | Confirm `webmanifest → application/manifest+json` and `sw.js → text/javascript` + `Cache-Control: no-cache` in the MIME/header maps (a service worker must never be cached immutably). |
| `biome.json` | modify | Add `!apps/web/dev-dist`, `!apps/web/dist`, `!**/sw.js`, `!**/workbox-*.js` to `files.includes` so the Phase 12 gatekeeper stays green. |
| `.gitignore` | modify | Add `apps/web/dev-dist`. |
| `packages/e2e/playwright.config.ts` | modify | Add the `Pixel 7` / `iPhone 13` projects (from Phase 14) and a `pwa` project with `serviceWorkers: 'allow'` (Playwright blocks SW by default in some contexts). |
| `README.md` | modify | Document install, offline behaviour, the "tickets and balances are never cached" rule, and the `NetworkOnly` rationale. |
| `.docs/01-architecture.md` | modify | New §4.9 "Offline & caching policy": precache shell, `NetworkOnly` on `/api/*`, `StaleWhileRevalidate` on `/blasons/*`. |
| `.docs/03-active-task.md` | modify | Phase 15 checklist + release journal. |

### 15.4 Verification & acceptance criteria

```sh
docker compose --profile tools run --rm dev bunx pwa-assets-generator
docker compose --profile tools run --rm dev bun run ci:check
docker compose -f docker-compose.prod.yml up --build -d
docker compose -f docker-compose.e2e.yml up -d --build db api
docker compose -f docker-compose.e2e.yml run --rm playwright -- test pwa
```

**Manual (real device or DevTools → Application):**

- **Application → Manifest**: name *Hexagone*, `standalone`, `portrait`, both 192/512 icons resolve.
- **Application → Service Workers**: `sw.js` activated; precache contains JS/CSS/fonts/SVG; **no `/api/*` entry**.
- **Install on Android/iOS home screen** → launches standalone with no browser chrome; header clear of the notch; bottom bar clear of the home indicator.
- **Airplane mode** → app shell loads; opening a ticket shows the French network error, never a stale ticket or balance.
- **Deploy a new build** → the update banner appears; tapping *Recharger* activates the new SW; nothing swaps mid-scratch.

**Acceptance:**

- [ ] `pwa.spec.ts` — 7/7 pass, including the "no `/api/` entry in any cache" assertion.
- [ ] `curl -sI http://localhost:8080/sw.js | grep -i cache-control` → `no-cache` (never `immutable`).
- [ ] `curl -s http://localhost:8080/manifest.webmanifest | jq .display` → `"standalone"`.
- [ ] Lighthouse PWA audit: installable, no console errors.
- [ ] `bun run ci:check` still green **with `dev-dist`/`sw.js` present** (proves the Biome excludes work).
- [ ] Safe-area paddings non-zero on a notched viewport.
- [ ] The Phase 12 `static.spec.ts` suite remains green (the SW must not break SPA fallback).

**Do not:** precache or runtime-cache anything under `/api/`; enable `skipWaiting`/`clientsClaim`; use `autoUpdate`; rely on a CDN for icons or fonts; ship PNG icons without a reproducible generator.

---

## §6 — Cross-phase sequencing, risk register

### Sequencing (hard constraints)

```
Phase 12  ──▶  Phase 13  ──▶  Phase 14  ──▶  Phase 15
   │              │              │              │
   │              │              │              └─ SW precache must match the
   │              │              │                 final hashed asset set and the
   │              │              │                 final layout (safe areas).
   │              │              └─ `viewport-fit=cover` + AppShell must exist
   │              │                 before env() padding is meaningful.
   │              └─ Tokens/fonts change every card; SW globPatterns must include
   │                 woff2, so PWA must come after fonts are final.
   └─ The gatekeeper must exist before three UI phases of iteration.
```

Phase 12 is a **prerequisite**: without `ci:check`, Phases 13-14 have no cheap regression signal, and without the unified server, Phase 15's "shell cached, API never cached" split has no single origin to reason about.

### Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `workbox-build` fails to run under Bun in the `oven/bun:1` build stage | Low | Blocks Phase 15 build | `vite-plugin-pwa@2.0.0` supports Vite 8, so the plugin itself is fine; `workbox-build@7.4.1` is pure JS but shells into Rollup/Terser. Prove it early with `bun run --cwd apps/web build` inside the container before writing any SW policy. If it breaks, generate the SW in a separate `node` stage — but that reintroduces a Node dependency the repo deliberately avoids, so prefer pinning `workbox-build` to a Bun-compatible release. |
| The 2 failing specs have a deeper cause than the timeout | Medium | Blocks Phase 12 acceptance | Diagnose first with a seeded RNG; if it is a genuine `drawCard` fallback bug, fix it as its own spec-first PR before the gatekeeper lands. |
| `GET /*` fallback shadows `/blasons/*` or `/api/docs` | Medium | Breaks swagger + blasons | Explicit prefix deny-list inside the handler (not route-ordering trust) + `static.spec.ts` cases 5-8. |
| Removing nginx loses gzip/brotli | High | Larger transfer | `Bun.serve`/Elysia does not gzip by default. Either add a compression middleware or precompress in the image (`*.gz` + `Content-Encoding`). Add this to Phase 12 acceptance. |
| Single-container `backend` network is `internal: true` → published port unreachable | Certain if overlooked | Prod unreachable | Attach `api` to **both** `backend` and `public` (12.3 C). |
| Phase 13 token migration breaks `collection.tsx` virtualization perf | Low | Janky scroll | The 12-node budget + no `backdrop-filter` rule protects it; measure with the Performance panel at 1000 rows. |
| Phase 14 rAF batching delays the 40 % trigger | Low | Stuck cell | Coverage check still runs every 6 **drawn** moves plus on `pointerup/cancel/leave`; e2e case 5 covers it. |
| Phase 15 service worker serves a stale shell forever | Medium | Players stuck | `registerType: 'prompt'` + explicit *Recharger* banner + `cleanupOutdatedCaches`. |

### Invariants to re-assert at the end of every phase

- `import type { App } from '@hexamap/api/app'` is the only cross-boundary import in `apps/web` (`lib/api.ts`).
- `scratch-cell.tsx` contains **0** `useState` and **0** mouse/touch-specific handlers.
- Every backend change starts in `packages/spec`.
- UI text French; identifiers, comments, commit messages English.
- No `pg`; Kysely + postgres.js only.
- `currency_ledger` written in the same transaction as any `user.currency` update.
- No external runtime asset or API call (fonts, icons, GeoJSON, blasons are all local).
