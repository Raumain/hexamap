# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.
> Ne pas y stocker de connaissances durables : elles vont dans `01-architecture.md` ou `02-database.md`.

---

## Statut

- **Phase** : 2 — Schéma PostgreSQL & spike Better Auth
- **État** : Terminé
- **Priorité** : P0
- **Mis à jour** : 2026-11-15
- **Branche conseillée** : `feat/phase-2-schema-auth`

---

## Objectif

Créer les migrations réelles correspondant au contrat `.docs/02-database.md`, les appliquer, puis valider le montage de Better Auth dans Elysia avec une session lisible côté API.

À la fin de cette tâche :

- toutes les tables du contrat existent dans PostgreSQL ;
- les types Kysely sont alignés sur la base réelle ;
- `POST /api/auth/sign-up/email` et `POST /api/auth/sign-in/email` fonctionnent ;
- une route protégée de démonstration lit la session via `auth.api.getSession` ;
- les tests de spécification existants passent toujours.

---

## À lire avant de coder

1. `.docs/01-architecture.md` — règles du jeu et d'architecture.
2. `.docs/02-database.md` — DDL exact et types Kysely.
3. `packages/spec/src/scoring.spec.ts` — exemple de style de spécification.
4. `apps/api/src/auth.ts` — configuration Better Auth existante.

---

## Étapes

### 1. Migration Better Auth

- [x] Générer le SQL Better Auth avec les champs `pseudo` et `currency`.
- [x] Créer `packages/db/migrations/0002_auth.ts` à partir du SQL généré.
- [x] Ne pas modifier les noms de tables/colonnes Better Auth.

### 2. Migrations applicatives

- [x] Créer `packages/db/migrations/0003_game.ts` : `user_cards`, `tickets`, `ticket_reveals`, `tableaux`, `market_listings`, `currency_ledger`.
- [x] Créer `packages/db/migrations/0004_reference.ts` : `ref_regions`, `ref_departements`, `ref_communes`, `ref_odonymes`, `commune_odonymes`.
- [x] Conserver exactement les contraintes, index et clés étrangères de `.docs/02-database.md`.
- [x] Enregistrer les migrations dans `packages/db/src/migrator.ts`.

### 3. Application et vérification

- [x] Lancer les migrations dans le conteneur.
- [x] Vérifier les tables et index dans PostgreSQL.
- [x] Lancer `bun run db:types` ou mettre à jour `packages/db/src/schema.ts` si un écart est détecté.
- [x] Passer le statut des tables à **Migrée** dans `.docs/02-database.md`.

### 4. Spike Better Auth

- [x] Monter `auth.handler` dans `apps/api/src/app.ts` via `app.mount(auth.handler)`.
- [x] Vérifier `baseURL`, `trustedOrigins`, CORS avec credentials.
- [x] Ajouter une macro `auth` qui expose `user`/`session` ou une route de démonstration protégée.
- [x] Tester inscription, connexion, `GET /api/auth/get-session`, déconnexion.
- [x] Vérifier qu'aucune donnée sensible n'est renvoyée.

### 5. Qualité

- [x] `bun run lint`
- [x] `bun run typecheck`
- [x] `bun test packages/spec`
- [x] `bun run build`
- [x] Vérifier `GET /api/v1/health` et `GET /api/v1/health/db`.

---

## Critères d'acceptation

1. `bun run db:migrate` s'exécute sans erreur sur une base vide.
2. Les 16 tables du contrat existent avec leurs index et contraintes.
3. `packages/db/src/schema.ts` correspond au SQL (aucune table inventée).
4. L'inscription et la connexion Better Auth fonctionnent via HTTP.
5. Une route protégée renvoie 401 sans session et 200 avec session.
6. `lint`, `typecheck`, `test`, `build` passent.
7. `.docs/02-database.md` reflète le statut réel des tables.

---

## Commandes (toujours via Docker)

```sh
docker compose --profile tools run --rm dev bun run db:migrate
docker compose --profile tools run --rm dev bun run typecheck
docker compose --profile tools run --rm dev bun run lint
docker compose --profile tools run --rm dev bun test packages/spec
docker compose --profile tools run --rm dev bun run build

docker compose up -d --build
docker compose logs -f api
```

---

## Interdits

- Ne pas lancer Bun/npm sur la machine hôte.
- Ne pas créer de table ou colonne absente de `.docs/02-database.md`.
- Ne pas modifier les tests de `packages/spec` pour faire passer l'implémentation.
- Ne pas exposer `grid` ou `treasure_index` dans une réponse API.
- Ne pas implémenter le troc ou les enchères (hors V1).
- Ne pas ajouter d'i18n.

---

## Journal

- **2026-11-15** : monorepo initialisé (API, web, shared, db, spec, import), Docker opérationnel, 39 specs de scoring vertes, documentation `.docs` créée, schéma cible documenté, types Kysely définis.
- **2026-11-15** : **Phase 2 terminée.** Migrations créées et appliquées : `0002_auth.ts` (Better Auth camelCase, `pseudo`/`currency`), `0003_game.ts` (6 tables de jeu, 4 PK `uuid` en `gen_random_uuid()`), `0004_reference.ts` (5 tables référentiels). Driver base : **postgres.js + `PostgresJSDialect`** (aucun `pg`). Les 3 index `(…, created_at desc)` passent désormais `sql\`created_at desc\`` pour un SQL valide (`created_at DESC`). Montage auth : `auth.handler` monté, macro `auth` (session via `auth.api.getSession`), route `GET /api/v1/me` → 401 sans cookie / 200 avec. Spike HTTP validé : sign-up/sign-in 200 + cookie, `get-session` renvoie la session, aucun hash de mot de passe exposé. Vérifications base : 16 tables présentes, 4 PK uuid avec `gen_random_uuid()`, index `desc` corrects. Qualité : lint, typecheck, 39 specs, build OK (corrections : macro `error`→`status` Elysia 1.4, exclusion `types.generated.ts` du lint, formatage biome des migrations).
- **2026-11-15** : **Correctif accès réseau (LAN).** Cause racine : le serveur allait bien (ports `0.0.0.0` + `[::]`, curl 200 sur localhost/IP) ; c'est le navigateur, hors de la machine, qui appelait l'API en dur sur `http://localhost:3000` — un port qui ne mène nulle part depuis le poste. Solution : le navigateur ne parle plus qu'à l'origine du web (`treaty('')`, base relative → `/api/...`) et **Vite relaye `/api` vers l'API Docker** (`API_INTERNAL_URL=http://api:3000`, `server.proxy` dans `vite.config.ts`). CORS et `trustedOrigins` Better Auth acceptent désormais l'origine réelle (localhost + IP LAN en dev, wildcards IPv4 uniquement ; liste `TRUSTED_ORIGINS` surchargable) ; permissivité conditionnée à `NODE_ENV !== 'production'`. `VITE_API_URL` supprimé. `dev.sh` affiche l'URL LAN. Vérifié : 200 sur `/api/v1/health` et `/api/v1/health/db` via `192.168.1.30:5174` avec `Origin` LAN, cycle sign-in + `/api/v1/me` via le proxy, plus aucun `localhost:3000` dans la page ni les sources servies.
- **2026-11-15** : **Durcissement réseau Docker.** Topologie en deux réseaux dans `compose.yml` : `frontend` (bord) et `backend` (`internal: true`). `db` est sur `backend` uniquement et son port `5432:5432` a été supprimé (PostgreSQL n'est plus exposé au LAN). `api` et `dev` sont sur les deux réseaux, `web` sur `frontend` uniquement. Accès psql : `docker compose exec db psql -U hexamap -d hexamap`. `internal: true` n'empêche ni le healthcheck de `db` (exécuté dans le conteneur), ni `dev` (rattaché au `backend`), ni la résolution DNS `db`. Documentation `01-architecture.md` mise à jour (section 6.1).
- **2026-11-15** : **Correctif réel du client API — `treaty('')` produisait `https://api/v1/health`.** Le front appelait une URL invalide : le navigateur affichait `https://api/v1/health`, où `api` était interprété comme le **nom de domaine**. Cause : dans `@elysia/eden` 1.4.10 (`treaty2`), la normalisation fait `e = (hosts.includes(e) ? 'http://' : 'https://') + e` quand la base ne contient pas `://` ; une chaîne vide devient donc `https://`, puis `https:///api/v1/health` est normalisé par le navigateur en `https://api/v1/health`. Correction : `treaty<App>(window.location.origin)` dans `apps/web/src/lib/api.ts`. Vérifié en exécutant réellement le client (fetch instrumenté) : URL appelée = `http://192.168.1.30:5174/api/v1/health`, réponse 200. Le proxy Vite, le durcissement réseau et CORS n'étaient pas en cause. Règle « ne jamais passer une chaîne vide à `treaty` » consignée dans `01-architecture.md` et `apps/web/AGENTS.md`.
