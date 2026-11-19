# Hexamap

Monorepo du jeu de cartes à collectionner géographique français Hexamap.

## Prérequis

- Docker
- Docker Compose

Toutes les commandes Bun sont exécutées **dans un conteneur**. Aucun outil n'est requis sur la machine hôte.

## Démarrage

```sh
./scripts/bootstrap.sh
```

Le script crée `.env` si nécessaire, installe les dépendances dans le conteneur, démarre PostgreSQL, applique les migrations, puis construit et démarre l'API et le web.

**Le développement reste à deux conteneurs, par choix** : `api` (Elysia) et `web`
(serveur de développement Vite) séparés, pour conserver le HMR et le proxy `/api`
de Vite. La production fait l'inverse : **un seul conteneur** sert l'API et le SPA
construit (voir « Déploiement »). Les deux services de développement sont bâtis
depuis le `Dockerfile` racine, `target: dev`.

- Web (Vite, HMR) : http://localhost:5174
- API : http://localhost:3000
- Documentation OpenAPI : http://localhost:3000/api/docs

## Commandes (toujours via le conteneur)

```sh
docker compose --profile tools run --rm dev bun install
docker compose --profile tools run --rm dev bun run lint
docker compose --profile tools run --rm dev bun run typecheck
docker compose --profile tools run --rm dev bun run test
docker compose --profile tools run --rm dev bun run db:migrate
docker compose --profile tools run --rm dev bun run build
docker compose --profile tools run --rm dev bun run ci:check
```

## Vérification avant PR

```sh
docker compose --profile tools run --rm dev bun run ci:check
```

`bun run ci:check` (`scripts/ci-check.ts`) est le garde-fou unique : quatre étapes
séquentielles, arrêt à la première en échec.

| Étape | Commande |
| :--- | :--- |
| `1/4 Lint` | `biome check .` |
| `2/4 Typecheck` | `bun run typecheck` |
| `3/4 Base de données` | `bun run --cwd packages/db ping` |
| `4/4 Spécifications` | `bun test packages/spec` |

La suite de spécifications tourne **toujours sur une base de test dédiée**, jamais
sur la base de développement. Le script impose `TEST_DATABASE_URL` et refuse de
démarrer dans trois cas :

1. `NODE_ENV=production` ;
2. `TEST_DATABASE_URL` absent ;
3. `TEST_DATABASE_URL` identique à `DATABASE_URL`.

```sh
# .env
TEST_DATABASE_URL=postgres://hexamap:hexamap@db:5432/hexamap_test
```

C'est exactement ce qu'exécute la CI (`.github/workflows/ci.yml` :
`oven-sh/setup-bun@v2`, service `postgres:16-alpine`, `bun install --frozen-lockfile`,
puis un unique `bun run ci:check`), et la seule case à cocher de la pull request.

## Déploiement (production)

`docker-compose.prod.yml` décrit la pile définitive : PostgreSQL et **un unique
conteneur applicatif**. L'API sert elle-même le SPA construit : `apps/web/dist` est
embarqué dans l'image sous `/app/public`. Il n'y a plus de conteneur web, plus de
Nginx, plus de proxy inverse interne. La base n'est joignable que sur le réseau
interne Docker ; seul le conteneur `api` publie un port.

| Conteneur | Image | Rôle | Port publié |
| :--- | :--- | :--- | :--- |
| `api` | `Dockerfile`, `target: prod` | API Elysia **et** SPA statique | `${WEB_HOST_PORT:-8080}` → `3000` |
| `db` | `postgres:16-alpine` | PostgreSQL | aucun (réseau `backend`, `internal: true`) |

`api` est rattaché à **deux** réseaux : `backend` (interne, pour joindre `db`) et
`public` (pour publier le port). Un rattachement au seul réseau `internal`
interdit la publication de port ; la séparation reste néanmoins réelle, `db`
n'étant jamais exposée.

### `Dockerfile` — quatre étapes

| Étape | Contenu |
| :--- | :--- |
| `deps` | manifestes des workspaces + `bun install --frozen-lockfile` |
| `dev` | image des deux services de développement (`api` et Vite `web`) |
| `build` | build API, build web, et `packages/db/src/migrate.ts` groupé en `dist-db/migrate.js` |
| `prod` | `oven/bun:alpine` ; `dist/index.js`, `db-migrate.js`, `apps/web/dist` monté en `/app/public` |

L'image finale tourne en `USER bun`, avec
`ENV WEB_DIST_DIR=/app/public SERVE_WEB=true` et un `HEALTHCHECK` doté d'un
`--start-period=30s` (le temps des migrations). Le bundle API est autonome : aucun
`node_modules` n'est copié dans l'étape `prod`.

```sh
# 1. Secrets et origine publique (32 caractères minimum pour le secret)
cp .env.example .env
#   BETTER_AUTH_SECRET=<secret de production>
#   PROD_FRONTEND_URL=https://hexamap.example.com
#   PROD_APP_URL=https://hexamap.example.com
#   PROD_BETTER_AUTH_URL=https://hexamap.example.com

# 2. Démarrage (migrations appliquées par l'API)
docker compose -f docker-compose.prod.yml up -d --build
```

Les variables de production propres au frontend utilisent le préfixe `PROD_`
pour ne pas hériter des valeurs de développement de `.env` :
`PROD_FRONTEND_URL`, `PROD_APP_URL`, `PROD_BETTER_AUTH_URL`
(défaut : `http://localhost:${WEB_HOST_PORT}`).

> **Avant toute mise en production réelle** : remplacer `BETTER_AUTH_SECRET`,
> `POSTGRES_PASSWORD` et `PROD_FRONTEND_URL` (les valeurs par défaut de `.env`
> sont celles du développement local).

- Application (API + web) : http://localhost:8080 (`WEB_HOST_PORT`).
- L'API applique les migrations au démarrage (`RUN_MIGRATIONS=0` pour désactiver).
- Sonde de santé du conteneur : `GET /api/v1/health`.
- Le SPA est servi dès que `SERVE_WEB=true` **ou** `NODE_ENV=production` ;
  `WEB_DIST_DIR` (défaut `./public`) désigne le dossier des fichiers construits.
- **Cache** : `/assets/*` (noms hachés) est servi `public, max-age=31536000,
  immutable` ; `index.html` est `no-cache` ; le reste est `public, max-age=0,
  must-revalidate`. Les réponses portent un ETag fort (`If-None-Match` → `304`).
- **CORS** : en production (`NODE_ENV=production`), seules les origines de
  `FRONTEND_URL` et de `TRUSTED_ORIGINS` obtiennent un en-tête CORS ; toute autre
  origine est refusée. `credentials: true` est nécessaire aux cookies Better Auth.
- **Cookies** : `Secure` est forcé en production. Le banc E2E le désactive
  explicitement via `AUTH_COOKIE_SECURE=false` (HTTP simple dans Docker).

## Tests de bout en bout (Playwright)

Le banc E2E utilise **sa propre base** (`hexamap_e2e`, volume dédié) : il ne touche
jamais `hexamap_pgdata` ni aux référentiels importés en développement.

```sh
docker compose -f docker-compose.e2e.yml up -d --build db api
docker compose -f docker-compose.e2e.yml run --rm playwright
docker compose -f docker-compose.e2e.yml down -v
```

Comme en production, le banc E2E n'a **qu'un conteneur applicatif** : `api` sert
l'API et le SPA, et porte l'alias `hexamap.test`. Il écoute sur **`3000`** — Nginx
écoutait sur `80` avant la Phase 12 —, donc l'origine du banc est
`http://hexamap.test:3000` pour `E2E_BASE_URL`, `FRONTEND_URL`, `APP_URL` et
`BETTER_AUTH_URL`. Playwright attend qu'il soit `healthy` et que la tâche `seed`
soit terminée avant de démarrer.

Le parcours couvert est `packages/e2e/tests/core-loop.spec.ts` : inscription,
génération d'un ticket, grattage complet, inventaire, marché. Les sélecteurs sont
orientés utilisateur (`getByRole`, `getByLabel`) : aucun sélecteur CSS fragile.

## Inspecter la base de données

- **pgAdmin** (web) : `docker compose --profile admin up -d pgadmin` → http://localhost:5050
  Identifiants : `admin@hexamap.dev` / `hexamap` (variables `PGADMIN_DEFAULT_EMAIL` et
  `PGADMIN_DEFAULT_PASSWORD`). Le serveur « Hexamap (local) » est déjà configuré ; le mot de
  passe PostgreSQL à saisir est celui de `.env` (`hexamap` par défaut).
- **DBeaver / psql** (client local) : `postgres://hexamap:hexamap@localhost:5432/hexamap`
  (ou `127.0.0.1`). Si ton client refuse la connexion, force l'hôte à `127.0.0.1` :
  `localhost` résout parfois uniquement en `::1`, mais le port est publié sur les deux.

Ces deux accès sont publiés **sur la boucle locale uniquement** (`127.0.0.1` et `::1`), jamais sur
le LAN. `POSTGRES_BIND`, `POSTGRES_HOST_PORT` et `PGADMIN_HOST_PORT` (dans `.env`) permettent d'ajuster.

> `LOG: invalid length of startup packet` dans les logs de `db` = un client non PostgreSQL
> (navigateur, `curl`, sonde HTTP) a contacté le port 5432. PostgreSQL rejette la connexion,
> ce n'est ni un problème de Docker ni de la base.

## Données de référence (import Open Data)

L'import **n'est pas exécuté au démarrage de l'API** : c'est un batch one-shot, et les données
persistent dans le volume PostgreSQL `pgdata`. Aucun appel aux API gouvernementales n'a lieu au
runtime.

- `./scripts/bootstrap.sh` et `./dev.sh --fresh` lancent automatiquement un import
  `--lite --if-empty` (Bretagne), donc **rien n'est réimporté** si le référentiel est déjà complet.
- Import national complet, une seule fois :
  `docker compose --profile tools run --rm dev bun run scripts/import/index.ts`
- Import développement (Bretagne, ~20 s) :
  `docker compose --profile tools run --rm dev bun run scripts/import/index.ts --lite`
- Le script est idempotent (TRUNCATE des tables de référence avant insertion) ; `--if-empty`
  sort en code 0 si `ref_communes` / `ref_odonymes` sont déjà remplis.

Détail des options : [`scripts/import/README.md`](scripts/import/README.md).

## Mentions légales et Open Data

Hexamap exploite des données publiques ouvertes. Leur réutilisation est soumise à
attribution, conformément à la **Licence Ouverte v2.0 (Etalab)**.

> **Attribution obligatoire.** Les données d'adressage proviennent de la **Base Adresse
> Nationale (BAN)**, produite par l'IGN, La Poste et Etalab/DINUM, et diffusée sous
> **Licence Ouverte v2.0 (Etalab)**. Les données administratives et démographiques
> (régions, départements, communes, populations, codes officiels géographiques)
> proviennent de l'**Institut National de la Statistique et des Études Économiques
> (INSEE)**, via l'API Découpage administratif `geo.api.gouv.fr`, également diffusée sous
> **Licence Ouverte v2.0 (Etalab)**. Les contours administratifs proviennent de
> **IGN Admin Express** (Licence Ouverte v2.0). Les blasons et armoiries proviennent de
> **Wikimedia Commons** et de **Wikidata** : leurs licences sont hétérogènes
> (CC BY-SA, CC0, domaine public…) et chaque visuel conserve son auteur, sa licence et
> l'URL de sa page source (`blason_credit`).

| Donnée | Source | Licence / attribution |
| :--- | :--- | :--- |
| Régions, départements, communes, population, centroïde | [INSEE](https://www.insee.fr) via [`geo.api.gouv.fr`](https://geo.api.gouv.fr) | Licence Ouverte v2.0 (Etalab) — « © Etalab / INSEE, base des codes officiels géographiques » |
| Voies et adresses | [Base Adresse Nationale](https://adresse.data.gouv.fr) | Licence Ouverte v2.0 (Etalab) — « © Base Adresse Nationale (BAN) / IGN / Etalab » |
| Contours, formes de secours | [IGN Admin Express](https://geoservices.ign.fr) | Licence Ouverte v2.0 (Etalab) — « © IGN » |
| Blasons, armoiries | [Wikimedia Commons](https://commons.wikimedia.org) / [Wikidata](https://www.wikidata.org) | Licences Commons hétérogènes, attribution par visuel |

Hexamap n'est ni affilié à l'IGN, ni à l'INSEE, ni à Etalab. Les données sont
retraitées (normalisation, agrégation, calcul de rareté et de score) et ne doivent pas
être considérées comme une source officielle.

## Architecture

```text
apps/
  api/                Elysia + Kysely + Better Auth, exposé via Eden Treaty
  web/                React + Vite + TanStack Router/Query/Table/Form + Tailwind
packages/
  shared/             scoring, rareté, constantes partagées
  db/                 création Kysely, migrations, codegen
  spec/               tests de spécification issus du GDD
  e2e/                parcours Playwright (banc Docker dédié)
scripts/
  import/             pipeline Open Data (Phase 3)
```

### Design system

L'interface suit un parti pris unique, **le cabinet de cartographie** : une pièce sombre où
les cartes sont des planches exposées, sur vélin, avec du laiton et de la cire.

- Les jetons (couleurs, ombres, rayons, durées, polices) vivent dans un seul bloc `@theme`
  de `apps/web/src/styles.css` — Tailwind v4 CSS-first, jamais de `tailwind.config.ts`.
- Trois familles **auto-hébergées** dans `apps/web/public/fonts/`, sans CDN : **Fraunces**
  (éditorial), **Instrument Sans** (interface), **JetBrains Mono** (données).
- La rareté est un **métal**, pas une pastille : `RARITY_ACCENT_HEX` dans
  `packages/shared/src/rarity.ts` porte les six valeurs (étain, cuivre, argent, émail, or,
  électrum) et `RARITY_LABELS` les libellés français ; `apps/web/src/lib/rarity-theme.ts`
  n'ajoute que l'initiale, l'épaisseur et l'encre du sceau.
- Quatre planches (`region-card`, `departement-card`, `commune-card`, `rue-card`) partagent le
  châssis `cards/card-shell.ts` ; la vue communale est générée de façon déterministe depuis
  le code INSEE. Budget : **≤ 18 nœuds non-SVG par planche** (les internes d'un `<svg>` ne
  comptent pas).
- Effets autorisés sur les surfaces (lumière, grain, fibre du vélin), **interdits dans les
  listes virtualisées et autour du canvas de grattage**.

La référence complète est `DESIGN_SYSTEM.md`.

## Méthode

Les tests de `packages/spec` sont la source de vérité. Une implémentation doit faire passer la spécification, jamais l'inverse.
