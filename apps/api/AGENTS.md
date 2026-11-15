# AGENTS.md — API

Lire d'abord `../../.docs/03-active-task.md`, `../../.docs/01-architecture.md` et `../../.docs/02-database.md`.

## Structure

- `src/app.ts` : application Elysia chaînée, export du type `App` pour Eden Treaty.
- `src/index.ts` : point d'entrée, `.listen()` uniquement.
- `src/env.ts` : validation stricte des variables d'environnement.
- `src/db/` : instance Kysely partagée.
- `src/auth.ts` : configuration Better Auth.
- Modules par domaine : `auth`, `tickets`, `cards`, `tableaux`, `market`, `reference`.

## Règles Elysia

- Découper les routes en plugins Elysia. Ne pas créer un fichier géant.
- Déclarer `body`, `params`, `query` et `response` avec TypeBox (`t`).
- Les schémas `response` sont obligatoires : ils alimentent les types Eden.
- Les routes protégées utilisent la macro de session Better Auth.
- Codes HTTP explicites : 201 création, 204 suppression, 401 non authentifié, 403 interdit, 404 introuvable, 409 conflit.
- Les erreurs ont un code stable en anglais et un message en français.
- Ne pas exposer de données internes : jamais `grid`, `treasure_index`, ni le contenu de cases non révélées.

## Better Auth

- Better Auth est la seule source d'identité.
- Montage : `app.mount(auth.handler)` ; basePath `/api/auth`.
- Lire la session avec `auth.api.getSession({ headers })`.
- Les appels directs `auth.api.*` pour des mutations nécessitent une vérification d'origine/CSRF.
- CORS : origine exacte + `credentials: true`.
- Ne pas écrire à la main le schéma Better Auth.

## Kysely

- Toutes les requêtes métier sont typées via `Kysely<Database>` (`@hexamap/db`).
- Pas de SQL brut dans les services, sauf health check ou import massif.
- Les transactions critiques utilisent `db.transaction()` et `SELECT ... FOR UPDATE`.
- Ne jamais interroger une table absente ou non migrée dans `.docs/02-database.md`.
- Toute évolution de schéma commence par `.docs/02-database.md` et une migration.

## Tickets et marché

- Le tirage est serveur-autoritaire et utilise un RNG injectable.
- Le grattage est atomique : verrou du ticket, décrément, effet, insertion de carte, révélation.
- Le marché V1 est limité à la vente à prix fixe et à l'achat direct.
- Un achat verrouille la carte et la ligne d'annonce.

## Tests

- Les specs de comportement vont dans `../../packages/spec`.
- Les tests d'intégration utilisent un vrai PostgreSQL et un schéma isolé.
- Vérifier les effets de bord en base, pas seulement les réponses HTTP.

## Commandes

```sh
docker compose --profile tools run --rm dev bun run --cwd apps/api typecheck
docker compose --profile tools run --rm dev bun run --cwd apps/api build
```
