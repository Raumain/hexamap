# AGENTS.md — Web

Lire d'abord `../../.docs/03-active-task.md`, `../../.docs/01-architecture.md` et `../../.docs/02-database.md`.

## Stack

- React 19 + TypeScript + Vite.
- TanStack Router (file-based), TanStack Query, TanStack Table, TanStack Form.
- TailwindCSS. Pas de CSS-in-JS.
- Client API : Eden Treaty (`@elysia/eden`).

## Règles

- **Tout le texte visible est en français.** Aucune dépendance i18n.
- Centraliser les libellés réutilisables dans `src/content/`.
- Utiliser `Intl.NumberFormat('fr-FR')` et `Intl.DateTimeFormat('fr-FR')`.
- Ne jamais éditer `src/routeTree.gen.ts` à la main : il est généré par TanStack Router.
- TanStack Query gère tout état serveur. Pas de `useEffect` pour fetcher.
- Les routes sont des fichiers dans `src/routes/`.
- Les types API viennent de `@hexamap/api/app` via `import type { App }` uniquement. Ne jamais importer du code serveur à l'exécution.
- Les composants sont accessibles : rôles ARIA, labels, `aria-live` pour les révélations.
- Tailwind uniquement pour le style ; les assets procéduraux sont en SVG/CSS.

## Règle stricte du Canvas

- **Interdiction de piloter le Canvas de grattage avec l'état React.**
- Utiliser un contrôleur impératif : `ref`, `requestAnimationFrame`, événements natifs.
- React ne gère que les états grossiers : ticket chargé, case révélée, ticket épuisé, erreur.
- Ne pas re-render à chaque mouvement de souris/doigt.
- La révélation est une mutation serveur ; le Canvas affiche le résultat.

## Données

- Le client Eden est initialisé sur `treaty(window.location.origin)` : `/api` est relayé par Vite vers l'API Docker. Pas d'URL absolue côté navigateur, et surtout **jamais `treaty('')`** (Eden le préfixe `https://` → `https://api/v1/health`).
- Ne pas appeler les API Open Data depuis le navigateur.
- Ne pas dupliquer les formules de score : importer depuis `@hexamap/shared`.

## Commandes

```sh
docker compose --profile tools run --rm dev bun run --cwd apps/web typecheck
docker compose --profile tools run --rm dev bun run --cwd apps/web build
docker compose --profile tools run --rm dev bun run --cwd apps/web generate
```
