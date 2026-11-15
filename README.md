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

- Web : http://localhost:5174
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
```

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

## Architecture

```text
apps/
  api/                Elysia + Kysely + Better Auth, exposé via Eden Treaty
  web/                React + Vite + TanStack Router/Query/Table/Form + Tailwind
packages/
  shared/             scoring, rareté, constantes partagées
  db/                 création Kysely, migrations, codegen
  spec/               tests de spécification issus du GDD
scripts/
  import/             pipeline Open Data (Phase 3)
```

## Méthode

Les tests de `packages/spec` sont la source de vérité. Une implémentation doit faire passer la spécification, jamais l'inverse.

## Données

Les données géographiques proviennent de sources ouvertes : `geo.api.gouv.fr`, Base Adresse Nationale / FANTOIR, IGN / Etalab et Wikidata. L'attribution sera documentée avec le pipeline d'import.
