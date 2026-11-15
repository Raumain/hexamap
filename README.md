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
