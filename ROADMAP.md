# Hexamap — Live roadmap (what is actually left)

> **v2** — la feuille de route de la v2 vit dans `.docs/07-roadmap-v2.md`. Ce fichier ne suit plus
> que les restes de la v1 (tracks A, B, C) ; le track C (L'Assemblage) y est absorbé par les
> phases 33 à 35.

**Updated:** 2026-11-20.
**Baseline:** `main` after PR #34 (pre-deploy hardening), #36 → #42 (phase 30, economy →
boutique front), #44 (wave 3), #45 (Stripe webhook + 5 s redirect) and #46 (wave 2).
**Status:** phases 12 → 29 are fully consumed. Phase 30 is **implemented in the dark** — economy,
schema, checkout, webhook, refunds and the boutique front are merged; the phase 305 QA/e2e and the
legal gate remain. Phase 31 is still a V2 feature with a shipped teaser.
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
| — | Pre-deploy hardening (production image, host checklist) | **Code closed; host checks pending — §2.A** |
| 30 | La Boutique (Stripe, écus packs) | **Implemented dark — 30.1 → 30.8, front #42, webhook #45; phase 305 QA + legal gate remain — §2.B** |
| 31 | L'Assemblage (map of owned territory) | **Teaser shipped, feature in V2 — §2.C** |

Original roadmap → repo mapping: its Phase 12 = repo 12; **its Phase 13 = repo 13 + 14** (the
design system was rewritten once); **its Phase 14 = repo 14/15 partially + 16**; **its Phase 15 =
repo 17, at ~80 %, closed in practice by repo 19**.

Verified on 2026-11-20: `ci:check` green with **303 specs across 18 files**; the production image
compresses text payloads in-process — main bundle `255 461` → `80 243` octets in gzip (−68,6 %)
and `75 518` in brotli (−70,4 %) — while still serving `/manifest.webmanifest`
(`application/manifest+json`) and `/sw.js` (`text/javascript`, `no-cache`). The twelve-migration
replay was exercised on 2026-11-20 from a dropped `kysely_migration` — twice — with row counts
unchanged; `0013_shop` follows the same guards, and phase 305 QA must replay all thirteen. The
Playwright bench
was last run in full at **58 tests, 56 passed / 2 skipped** (2026-11-19) and has not been re-run
since phases 26 → 30; the phase 305 QA must run it, including the boutique and refund cases.

---

## 2. What remains, in order

The economy and social layer (phases 26 → 29) shipped on 2026-11-19 and 2026-11-20, and phase 30
is implemented in the dark. Three tracks remain: **A. pre-deploy hardening** blocks the first
player, **B. phase 30 — La Boutique** is code-complete but blocked on legal and on the phase 305 QA,
**C. phase 31 — L'Assemblage** is the V2 feature whose teaser ships now. The rationale of each
shipped phase — the charge/card ambiguity, the finite faucet, the symmetric friendship, the 404
private showcase, the 6 000-écu catalogue — lives in `.docs/03-active-task.md` and in git history.

**State of the three tracks, at a glance**

| Track | Done | To do | Start a fresh session at |
| :--- | :--- | :--- | :--- |
| **A. Pre-deploy** | The production image was built and run against a **virgin PostgreSQL 16**: migrations, signup, charges 6/6, CORS, compression, cache, SPA, JSON 404 — all observed (§A). **A1, A3, A5, A6 and A7 are code-closed** | A4, A8, A9; A3/A5 host steps; the host checklist; one real loop on the host | **A4** — a real secret with entropy |
| **B. La Boutique** | **30.1 → 30.8 implemented**, front `/boutique` merged (#42); the real webhook is fixed by #45 (`constructEventAsync`, raw body, success URL, 5 s redirect) | phase 305 QA/e2e; the legal gate | **305** — run the Playwright bench, then the legal checklist |
| **C. L'Assemblage** | The **teaser is shipped**: `/assemblage`, nav entry, content, pure outline module, e2e case | 31.1 → 31.5 — the whole map | **31.1** — precomputed paths in `scripts/import` |

### Shipped — economy and social layer (2026-11-19 → 20)

| Phase | What now exists | PR |
| :--- | :--- | :--- |
| 26 — Le Carnet | `user_scratch_charges`; balance derived from `last_regen_at` (no incrementing counter); 6 charges / 30 min, regeneration suspended at the cap; generation and draw in one transaction under `FOR UPDATE`; `/charges` returns `charges` + `nextChargeAt`, the client ticks locally, no polling | #27 |
| 27 — Les Médailles | `user_achievements`; finite one-time ledger faucet `ACHIEVEMENT:<key>` written in the same transaction as the medal row; **6 000 écus** catalogue (rebalanced 2026-11-20; originally 65 950) locked in `packages/shared`; `ACHIEVEMENT_PAYOUTS_ENABLED` cuts payouts without a migration | #28 |
| 28 — Les Amis | `friendships` (one unordered pair via `least/greatest`), `blocks` (unilateral and silent), daily request cap in `game_config`, only `ACCEPTED` rows count toward medals | #26 |
| 29 — La Vitrine | `user_profiles`; unique `lower(pseudo)` index with a deterministic pre-dedupe; `/players/$playerId` with a strict allow-list and **404** for a private showcase; 3–24 character pseudo validation at signup | #29 |

### Shipped — La Boutique (2026-11-20, dark)

| Step | What now exists | PR |
| :--- | :--- | :--- |
| 30.1 — Schema | `0013_shop`: partial unique index `currency_ledger_purchase_uniq` and `SHOP_DAILY_PURCHASE_CAP` in `game_config` | #36 |
| 30.2 — Economy | 37 medals rebalanced from 65 950 to **6 000 écus**; `packages/shared/src/packs.ts` with four packs and a strictly increasing écus/€ ratio | #37 |
| 30.3 — Checkout | `POST /api/v1/shop/checkout` creates a Stripe Checkout session; nothing is credited there | #38 |
| 30.4 — Webhook | `POST /api/v1/shop/webhook` verifies the raw body, credits once with `PURCHASE:<session.id>`, returns 200 on replay; corrected in #45 to `constructEventAsync` + `parse: 'text'` | #38, #45 |
| 30.5 — Refunds | `charge.refunded` writes a proportional `PURCHASE_REFUND:<session.id>`, capped at the initial credit; balance clamped to 0, `SHOP_REFUND_NEGATIVE` logged | #40 |
| 30.6 — Front | `/boutique`, `/boutique/succes`, four packs, TTC, balance, `PENDING`/`CREDITED`, 5 s return to the shop; nav entry in the `Plus` sheet | #42, #45 |
| 30.7 — Limits | `SHOP_DAILY_PURCHASE_CAP` (12 000 écus/day) checked before Stripe; 3-D Secure via Checkout | #36, #40 |
| 30.8 — Tests | Fake `PaymentProvider`, signature rejection, replay, refund, unknown session, cap, no network in `packages/spec` | #38, #40 |

Contract status: `0009_scratch_charges`, `0010_friendships`, `0011_achievements`,
`0012_profiles` and `0013_shop` are all **Migrée** in `.docs/02-database.md` §2. No table remains
in **Contrat**.

### Maintenance — migrations are replayable

The development database had executed `0011_achievements` before `0009` and `0010` existed on
`main`, so Kysely rejected the sequence. Every `up` now carries `if not exists` /
`on conflict do nothing` guards, and the tracking table can be dropped and the migrations
replayed without losing a row. The rule lives in `.docs/02-database.md` §1 rule 8 and §8 step 8;
the repair is on branch `fix/migrations-rejouables`.

### A. Pre-deploy hardening — verdict on the production image (P0)

**Status:** verified on 2026-11-20, **A1 now fixed**. Findings A2 → A9 are the backlog of this
track; the host checklist is a decision aid, not code. **A3, A6, A7 and the backup script (A5)
are now closed in code**; the column "still host-side" is the runbook `.docs/05-deploiement.md`,
which replaced the plain checklist as the procedure to follow.

What was actually executed on 2026-11-20, in Docker, against a **virgin PostgreSQL 16 volume** —
not against the development database.

| Check | Result |
| :--- | :--- |
| `target: prod` build | green, **180 MB**, runs as `USER bun`, no `node_modules` copied |
| `docker compose -f docker-compose.prod.yml up --build` | `api` healthy, `db` healthy, `0.0.0.0:8080 → 3000` |
| Empty database, no `kysely_migration` | **12/12 migrations applied** by `prod-entrypoint.sh`, 24 tables, 6 `game_config` keys, 0 users |
| Signup on that fresh database | `200`, session cookie set, `user_scratch_charges` created lazily at **6/6** |
| Draw with no reference data | `503 REFERENCE_DATA_MISSING`, and **the charge was not consumed** (still 6/6) |
| SPA served by the API | `/` `200 text/html`, deep links `/cadastre` and `/assemblage` `200 text/html` |
| Unknown API path | `404 {"code":"ROUTE_NOT_FOUND"}` — never HTML |
| Unauthenticated API | `401` |
| Compression | main bundle `260 233` → `81 494` gzip (−68,7 %) / `76 664` br (−70,5 %) |
| Cache | hashed assets `immutable`, `index.html` `no-cache`, `If-None-Match` → `304` |
| CORS | allowed origin echoed; `https://evil.example` receives **no** `Access-Control-Allow-Origin` |
| Better Auth mounted handlers | `/api/auth/get-session` `200`, delegation intact |

**Findings to close before the first player.** A1 and A2 are closed; A3 → A9 are operator
decisions, except A3 and A6 which touch code/config.

| # | Finding | Consequence | Fix |
| :--- | :--- | :--- | :--- |
| A1 | **Closed** — a missing hashed asset used to answer **`200 text/html`**: `GET /assets/nope.js` fell into the SPA fallback | `import()` and `<script>` send `Accept: */*`, so a stale or missing chunk yielded `Unexpected token '<'` behind a `200` — undiagnosable | `static.ts`: an allow-listed extension with no file on disk answers `404 ROUTE_NOT_FOUND` before the fallback. One red case in `static.spec.ts` first, 14 cases green |
| A2 | **Closed 2026-11-22** — Reference data is not shipped in the image — a fresh volume has none. Imported manually in production (owner's declaration); the image still ships without data, so a fresh volume needs a re-import | The game cannot draw a single card (`503`), and no blason loads | Run `scripts/import` once on the host (or seed the two read-only volumes) **before** opening |
| A3 | **Configuration ready, host verification pending** — Better Auth could not resolve the client IP: `session.ipAddress` was `""` and it logged a shared-bucket warning | Every player shares one rate-limit bucket behind a proxy | `advanced.ipAddress` now carries `ipAddressHeaders: ['x-forwarded-for']` and `trustedProxies` fed by `TRUSTED_PROXIES` (empty by default: no header is trusted until the border is known). Still to do on the host: forward `X-Forwarded-For`, set `TRUSTED_PROXIES`, and confirm `session.ipAddress` is not `""` — `.docs/05-deploiement.md` §5 |
| A4 | `BETTER_AUTH_SECRET` was low-entropy; Better Auth warned at boot | Session forgery if leaked | 32+ random bytes per environment, injected by the platform, rotated once |
| A5 | **Script delivered, schedule and drill pending** — no backup existed | One `down -v` loses the whole game | `scripts/backup.sh` dumps the database **and** tars the `blasons` / `importstatus` volumes, with retention. Still host-side: schedule it and run one restore drill — `.docs/05-deploiement.md` §3 |
| A6 | **Closed (code)** — container logs were unbounded (`restart:` was set, `logging:` was not) | A full disk stops the API | `json-file` driver, `max-size: 10m`, `max-file: 5`, on both `db` and `api`; assert with `docker compose -f docker-compose.prod.yml config` |
| A7 | **Closed (code)** — volumes carried explicit names (`hexamap_blasons`, `hexamap_importstatus`) and prod reused the dev ones — compose warned | A host can silently attach the wrong data | Defaults are now `hexamap_prod_blasons` / `hexamap_prod_importstatus`; the three volume variables stay overridable and are documented in `.env.example` |
| A8 | Production forces `Secure` cookies | Over plain HTTP, login appears to succeed and no session ever sticks | Terminate TLS; every public URL is `https://` |
| A9 | No SMTP provider is configured | No password reset, no verification mail | Decide before launch: ship SMTP, or state that password reset is unavailable |

### A.2 Host checklist — what to have ready before choosing a provider

Provider-agnostic on purpose: these are the properties the app needs, not a vendor list.

> **Superseded as a procedure.** The executable version of this list — every command, every
> restore step, and a **[code] / [hôte] / [juridique]** tag per item — is
> `.docs/05-deploiement.md`. This table stays as the decision record; edit both when the
> checklist changes.

**Compute and image**

- [ ] x86_64 host, **or** build with `--platform linux/amd64` (an Apple-silicon workstation
      produces an arm64 image that will not start on most hosts).
- [ ] 2 vCPU / 2 GB RAM / 20 GB disk minimum with PostgreSQL colocated; 1 GB is tight once the
      reference import and the SPA sit in the same container.
- [ ] Image built in CI and pushed to a registry, or built on the host from a checkout — either
      way, `docker compose -f docker-compose.prod.yml up -d` must be reproducible.

**Persistence**

- [ ] A named volume for `hexamap_prod_pgdata`, or a managed PostgreSQL 16 (then drop the `db`
      service and point `DATABASE_URL` at it).
- [ ] Volumes for `blasons` and `import-status`, mounted **read-only** by the API and filled by the
      import job.
- [ ] Disk-usage alerting at 80 % — Postgres plus logs are the only unbounded writers.

**Network and TLS**

- [ ] **One origin** serves the API and the SPA on 443: never `api.example.com` next to
      `example.com` (CORS, cookies and the service worker all assume a single origin).
- [ ] DNS `A`/`AAAA` to the host and automated certificate renewal.
- [ ] `PROD_APP_URL`, `PROD_BETTER_AUTH_URL`, `PROD_FRONTEND_URL` all `https://…`, and
      `TRUSTED_ORIGINS` listing exactly the real origins.
- [ ] The proxy forwards `X-Forwarded-For` and `X-Forwarded-Proto` (see A3).

**Secrets and access**

- [ ] `BETTER_AUTH_SECRET` ≥ 32 random bytes, unique per environment, never in git.
- [ ] `POSTGRES_PASSWORD` changed from the `hexamap` default; the port is never published.
- [ ] Secrets injected by the platform, not baked into the image; SSH limited to an admin key.

**Operations**

- [ ] Health probe on `/api/v1/health` (`start-period` 30 s: boot runs the migrations).
- [ ] Log rotation and a retention window (A6).
- [ ] Uptime monitor on `/api/v1/health` and one error sink (the wide-event log is the only
      observability today).
- [ ] `pg_dump` daily with 7/30-day retention, **and one restore drill** (A5).
- [ ] Know how to disable `RUN_MIGRATIONS` for a blue/green or a two-replica rollout — today the
      boot applies migrations, which assumes exactly one starting container.

**Product and legal**

- [x] Reference data imported (A2) — *fait le 2026-11-22, déclaration du titulaire*: `ref_regions`,
      `ref_departements`, `ref_communes`, `ref_odonymes`, `commune_odonymes`.
- [ ] Blasons imported and attributed (`blason_credit` is served with every card).
- [ ] Mentions légales, CGV, politique de confidentialité, cookie disclosure (a session cookie is
      still a cookie).
- [ ] DPA signed with the host; EU data residency.
- [ ] Rate limiting at the edge in front of `/api/auth/*`, in addition to Better Auth's.
- [ ] SMTP if password reset ships (A9).

**Gate.** Launch is green when A4 → A9 are closed (A1 done, A2 closed on 2026-11-22), the checklist is ticked, `ci:check` is green on
the deployed commit, and one real loop — signup → ticket → scratch → tableau — has been played on
the host, not on a laptop.

### B. Phase 30 — La Boutique (real money) — implemented in the dark; legal gate open

**Status:** 30.1 → 30.8 are implemented and merged; the front is #42; the real webhook is fixed by
#45. Remaining: phase 305 QA/e2e and the legal gate. The shop answers `503 SHOP_DISABLED` without the
six `STRIPE_*` variables.

The code is ready; launching is blocked on legal: CGV, the right of withdrawal and its
digital-content exception, VAT on digital services, and parental consent for minors. The scope is
deliberately **écus packs only** — no cosmetics, no subscription (see the park list). The shop
stays `503 SHOP_DISABLED` until the gate clears.

**Product rules that do not bend**

- **The ticket is never sold.** Selling fixed-value currency is a microtransaction; selling
  randomized tickets is a loot box, and French gambling regulation (ANJ) would apply. The free
  ticket stays the only source of cards, which is what keeps phase 26's charge limit meaningful
  instead of a paywall.
- **Écus never convert back to money.** No cash-out, no transfer between accounts. Buying écus buys
  market liquidity, not a store of value.
- **The server owns every price.** The client sends a pack **key**; the amount and the credited
  quantity are read server-side. A tampered client can only choose a different pack.
- **No client-side credit, ever.** Only the verified webhook writes `currency_ledger`.

**Packs (locked 2026-11-20; the whole medal catalogue is 6 000 écus = one `PACK_6000`)**

| Key | Écus | Price (TTC) | Bonus | Rationale |
| :--- | ---: | ---: | ---: | :--- |
| `PACK_500` | 500 | 4,99 € | — | entry point, one rare card's worth |
| `PACK_1200` | 1 200 | 9,99 € | +20 % | the default choice |
| `PACK_2500` | 2 500 | 19,99 € | +25 % | |
| `PACK_6000` | 6 000 | 44,99 € | +33 % | whale tier, deliberately not infinite |

Stripe fees (~1,5 % + 0,25 € on EU cards) and 20 % VAT are taken out of these numbers, not added
on top: the displayed price is the price. `stripe.tax` computes the VAT if the account is
configured for it.

**Steps**

- [x] **30.1 — Idempotence in the schema first.** Migration `0013_shop` adds the partial unique
      index `currency_ledger_purchase_uniq` on `(user_id, reason) where reason like 'PURCHASE:%'`
      and seeds `SHOP_DAILY_PURCHASE_CAP`. A replayed `PURCHASE:<id>` inserts one row, not two.
- [x] **30.2 — Catalogue in `packages/shared`.** `packs.ts` holds key, écus, price in cents,
      currency and the Stripe env name; `packages/spec` locks écus > 0, price > 0, a strictly
      increasing écus/€ ratio, and `PACK_6000.ecus === ACHIEVEMENT_PAYOUT_TOTAL` (6 000).
- [x] **30.3 — Checkout session, server-side.** `POST /api/v1/shop/checkout { packKey }` creates a
      `mode: 'payment'` session with `client_reference_id = userId`, `metadata.userId`,
      `success_url` / `cancel_url` on the same origin. Nothing is credited here.
- [x] **30.4 — Webhook, raw body.** `POST /api/v1/shop/webhook` verifies the raw body with
      `stripe.webhooks.constructEventAsync` (Bun has no synchronous crypto) and `parse: 'text'`
      (the default JSON parser would consume the stream). On `checkout.session.completed`: one
      transaction under `FOR UPDATE`, `insert … on conflict do nothing` into `currency_ledger`
      with `reason = 'PURCHASE:' || session.id` and `delta = +écus`. `200` on a duplicate.
      Corrected by #45.
- [x] **30.5 — Refunds.** `charge.refunded` writes a proportional `PURCHASE_REFUND:<session.id>`,
      capped at the initial credit, from the cumulative `amount_refunded`. A refund that would
      drive the balance negative is still written, the balance is clamped to 0, and
      `SHOP_REFUND_NEGATIVE` is logged — no new table, no silent drop.
- [x] **30.6 — The shop room.** `La Boutique` in the `Plus` sheet: four packs, price TTC, the écu
      balance, and a success page that **reads** `GET /shop/orders/:id` instead of believing the
      redirect. No "gift", no promotional countdown; the success page returns to the shop after
      **5 s** once `CREDITED`.
- [x] **30.7 — Abuse and limits.** Per-account daily purchase cap in `game_config`
      (`SHOP_DAILY_PURCHASE_CAP`, 12 000 écus), checked before Stripe; 3-D Secure via Checkout;
      no purchase path bypasses the charge system.
- [x] **30.8 — Tests without a network.** `PaymentProvider` + fake in `packages/spec`: signature
      rejection, replay, refund, unknown session, cap, webhook before the row is visible. The real
      Stripe CLI check is manual; the `constructEvent`/Bun failure was caught there and fixed in
      #45.

**New environment variables**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the four
`STRIPE_PRICE_*` ids. All optional at boot; the shop route returns `503 SHOP_DISABLED` when they
are absent, so the rest of the app never depends on Stripe being configured. The daily cap is not
an environment variable: it lives in `game_config` (`SHOP_DAILY_PURCHASE_CAP`, seeded by
`0013_shop`) and is read before the Stripe call.

### C. Phase 31 — L'Assemblage (the map of owned territory)

**Done — the teaser (2026-11-20).** A new room, `L'Assemblage` (`/assemblage`), appears in the
`Plus` sheet and states, in French, that the feature is coming. It shows the empty outline of
France and **no fake progress**: no percentage, no greyed-out region implying data the player
does not have. Marketing by promise, not by mock.

| What exists | File |
| :--- | :--- |
| The room (public, no session guard, no query, no state) | `apps/web/src/routes/assemblage.tsx` |
| Every French string of the room | `apps/web/src/content/assemblage.ts` (`ASSEMBLAGE_ROOM`) |
| The schematic outline, a pure module — **not** the V2 geometry | `apps/web/src/lib/france-outline.ts` |
| Nav entry in `SECONDARY_NAV`, glyph, `SALON_TITLES` | `apps/web/src/components/layout/nav-items.ts` |
| One case: `mobile — la salle de l'Assemblage annonce sa venue` | `packages/e2e/tests/mobile.spec.ts` |

Verified: `ci:check` green (lint, typecheck, PostgreSQL, **303 specs / 18 files**); the teaser case
was green on `Pixel 7` when the room shipped. The outline is deliberately coarse (~4 px)
and is replaced wholesale by step 31.1 — do not "fix" it by fetching a GeoJSON at runtime.

**V2 scope.** A blank map of France where the cards a player owns draw the contour of the zone
they cover: régions, départements and communes fill in as they are collected; rues never do (an
odonym has no polygon). The map is a reading of `user_cards`, not a new source of truth.

**Why this is not a weekend feature — three hard constraints.**

1. **There is no PostGIS.** The image is vanilla `postgres:16-alpine`, so no server-side
   `st_union`, no simplification, no reprojection. Overlapping contours (a commune inside its
   département inside its région) would double-stroke and shimmer.
2. **`geom jsonb` is too heavy to ship per request.** A single region's raw geometry is hundreds of
   kilobytes; a player owning all 18 would pull megabytes for one screen.
3. **Projection is a promise.** The outline must be the same shape on every device, so the
   projection and the viewBox are fixed at import, never derived at render.

**Plan**

- [ ] **31.1 — Precompute at import.** `scripts/import` projects (Lambert-93 → a fixed
      `viewBox=0 0 1000 1000`) and simplifies each entity with a Douglas-Peucker pass, then stores
      an SVG `path` string. New columns `path_d text` (and `path_simplified text`) on
      `ref_regions`, `ref_departements`, `ref_communes` — `.docs/02-database.md` first, then
      migration `0014_assemblage_paths`.
- [ ] **31.2 — Precompute the union per département.** Without PostGIS, the only correct way to
      avoid double-stroking is to store the union's path once, at import, rather than unioning at
      render.
- [ ] **31.3 — The endpoint.** `GET /api/v1/assemblage` returns
      `{ owned: { regions: string[], departements: string[], communes: string[] }, completion }`,
      with `completion` computed from the total reference counts — server-side, like every other
      score.
- [ ] **31.4 — The render.** One inline SVG, one `<path>` per owned entity, `vector-effect:
      non-scaling-stroke`, no per-frame React state (§4.6's spirit: this is a drawing, not a form).
      Budget: the room must stay under 200 Ko of path data for a completionist account.
- [ ] **31.5 — The tease becomes the room.** Same route, same nav entry: the empty outline is
      replaced by the player's map. No second migration of the URL, no redirect.

**Deliberately out of scope for V2**: rues on the map, cross-player comparison, animated progress,
export as an image.

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
| Stripe webhook uses `constructEventAsync` + route-level `parse: 'text'` | `constructEvent` is synchronous and Bun has no synchronous crypto provider; a plugin `onParse` runs after the default JSON parser and would sign an empty body. Locked by #45 |
| The success page returns to the shop after 5 s | The page reads `GET /shop/orders/:id` first; the redirect never credits. The delay is a courtesy, not a confirmation |
| The daily cap is a pre-checkout gate, not a webhook refusal | A payment already made must always be credited; the cap stops a new session before Stripe |

---

## 4. Risk register (re-scored against reality)

| Risk | Status | Notes |
| :--- | :--- | :--- |
| `workbox-build` under Bun | **Disproven** | Build green, `dist/sw.js` emitted, precache populated |
| The two failing `Plan §5.6` specs | **Resolved** | Never a timeout; suite is at 303 / 0 |
| `GET /*` shadowing `/api`, `/api/auth`, `/blasons` | **Covered** | 13 cases in `static.spec.ts`, deny-list evaluated in the handler, not by route order |
| `backend` network `internal: true` blocking the published port | **Covered** | `api` attaches to both `backend` and `public` |
| Removing nginx loses gzip/brotli | **Covered** | in-process gzip + brotli, 13 specs, measured on the production image |
| `navigateFallback` without a precached `index.html` | **Hit and fixed** | Otherwise `non-precached-url` at install; `html` is in `globPatterns` |
| A stale service worker pinning players | **Covered** | `pwa.spec.ts`, 7 cases, on the HTTPS bench: install, precache, offline shell fallback, no `/api/` entry in any cache |
| Any future transform on `<main>` re-breaks every `fixed` overlay | **Covered** | `.enter-salon` runs `animation-fill-mode: backwards`, so `main` carries no transform after the 180 ms entry; `OverlayPortal` renders both route overlays in `document.body`, immune to any transformed ancestor. Asserted in `design-system.spec.ts` |
| A branch executes a later migration before `main` introduces an earlier one | **Covered** | Every `up` is idempotent; `kysely_migration` can be dropped and replayed twice with row counts unchanged. Rule and proof procedure in `.docs/02-database.md` §1 rule 8 / §8 step 8 |
| The production image does not boot against a clean database | **Disproven** | 2026-11-20: virgin `postgres:16-alpine`, `target: prod`, boot applied 12/12 migrations (13 today, with `0013_shop`), signup `200`, charges seeded 6/6, draw rolled back cleanly on `503` |
| A missing hashed asset answers `200` + `index.html` | **Hit and fixed** | `static.ts` answers `404 ROUTE_NOT_FOUND` for any allow-listed extension with no file on disk, before the SPA fallback. Locked red-then-green in `static.spec.ts` (14 cases) |
| A host starts with no reference data | **A2 closed 2026-11-22** | Draw returned `503 REFERENCE_DATA_MISSING` until `scripts/import` ran; the owner declares the import done on 2026-11-22. La donnée n'est pas dans l'image : un volume neuf exige un réimport |
| Rate limiting sees one bucket for the whole world | **Config ready, host pending — A3** | `advanced.ipAddress` is set from `TRUSTED_PROXIES`, empty by default so no header is trusted. The ingress must forward `X-Forwarded-For` and the host must set the CIDR; `session.ipAddress` is the proof, not the code |
| A full disk stops the API | **Covered — A6** | `json-file` with `max-size: 10m` / `max-file: 5` on `db` and `api`, so 50 MiB per service at most. Verified by `docker compose -f docker-compose.prod.yml config` |
| Losing the volume loses the game | **Script covered, drill pending — A5** | `scripts/backup.sh` dumps the database plus both asset volumes with 7-day retention, and fails loudly when prod is down. Scheduling and the one restore drill remain host-side |
| Two environments silently sharing volumes | **Covered — A7** | Prod defaults are `hexamap_prod_*`; the dev project's unprefixed names no longer collide |
| Stripe webhook rejects every event with 400 | **Hit and fixed** | `constructEvent` is synchronous and Bun has no sync crypto; the SDK threw `SubtleCryptoProvider cannot be used in a synchronous context`. #45 switches to `constructEventAsync` and `parse: 'text'`. Verified with a locally signed HMAC: `200 {"received":true}` |
| A replayed purchase credits twice | **Covered** | Partial unique index + `insert … on conflict do nothing` + `FOR UPDATE`; `shop.spec.ts` replay case |
| A refund drives the balance negative | **Covered** | The negative ledger row is written, `user.currency` is clamped to 0, `SHOP_REFUND_NEGATIVE` is logged; no silent loss |
| The success page is trusted as payment proof | **Covered** | The page reads `GET /shop/orders/:id`; only the verified webhook writes `currency_ledger` |

Invariants, unchanged: `import type { App }` is the only cross-boundary import; `scratch-cell.tsx`
has 0 `useState` and 0 mouse/touch handlers; every backend change starts in `packages/spec`; French
UI, English identifiers; no `pg`; every migration `up` is replayable; `currency_ledger` in the
same transaction as any balance change; no external runtime asset or API call. The Stripe webhook
verifies the raw body asynchronously (`constructEventAsync`, `parse: 'text'`); the success page
never credits, it reads `GET /shop/orders/:id` and returns to the shop after 5 s; a paid purchase
is always credited, and the daily cap is a pre-checkout gate.
