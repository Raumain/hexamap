# AGENTS.md — Hexamap

## Rôle de ce fichier

Instructions permanentes pour tout agent travaillant sur Hexamap. Ce fichier est chargé automatiquement : il doit rester court et pointer vers la mémoire projet.

## Lecture obligatoire au début de chaque session

1. `.docs/03-active-task.md` — la tâche en cours (ordres du jour).
2. `.docs/01-architecture.md` — GDD, stack et règles d'architecture.
3. `.docs/02-database.md` — contrat SQL et types Kysely.

Ne pas commencer à coder avant d'avoir lu ces trois fichiers.

## Règles non négociables

1. **Tout s'exécute dans Docker.** Ne jamais lancer `bun`, `npm`, `tsc`, `vite` ou un build sur la machine hôte. Utiliser `docker compose --profile tools run --rm dev <commande>` ou les services `api`/`web`.
2. **Spec-first.** `packages/spec` est la source de vérité. Une PR d'implémentation ne modifie pas les tests de spécification pour les faire passer.
3. **Français uniquement.** Aucune dépendance i18n. Les textes visibles sont en français.
4. **Aucune table inventée.** Le seul contrat de données est `.docs/02-database.md`. Toute évolution commence par ce document, puis une migration.
5. **Serveur autoritaire.** Le tirage, la Pépite, les récompenses et les combos sont validés côté serveur. Ne jamais exposer `grid` ou `treasure_index`.
6. **Pas d'état React pour le Canvas.** Le grattage est piloté par un contrôleur impératif (`ref`, `requestAnimationFrame`). React ne gère que les états grossiers.
7. **Pas d'appel externe au runtime.** Les API Open Data sont réservées au pipeline d'import.
8. **Ne pas commiter** sauf demande explicite.

## Stack et conventions

- API : Bun + Elysia + TypeBox + Kysely + Better Auth.
- Base : PostgreSQL 16, migrations versionnées, `snake_case` pour les tables de jeu, colonnes Better Auth en `camelCase`.
- Client API : Eden Treaty (`@elysia/eden`), import de type uniquement.
- Front : React 19 + Vite + TanStack Router/Query/Table/Form + TailwindCSS.
- Tests : `bun:test` pour la spec, PostgreSQL réel pour l'intégration, Playwright pour l'E2E.
- Pas de CSS-in-JS, pas de commentaires inutiles.

## Arborescence

```text
apps/api/          Elysia, Kysely, Better Auth, export du type App
apps/web/          React, TanStack, Tailwind, client Eden
packages/shared/   formules pures, rareté, constantes
packages/db/       schéma Kysely, migrations, codegen
packages/spec/     tests de spécification (source de vérité)
scripts/import/    pipeline Open Data
.docs/             mémoire projet (architecture, DB, tâche active)
```

Des `AGENTS.md` locaux complètent ces règles dans `apps/api`, `apps/web`, `packages/db`, `packages/spec`, `packages/shared` et `scripts/import`.

## Commandes

```sh
docker compose --profile tools run --rm dev bun run lint
docker compose --profile tools run --rm dev bun run typecheck
docker compose --profile tools run --rm dev bun test packages/spec
docker compose --profile tools run --rm dev bun run build
docker compose --profile tools run --rm dev bun run db:migrate
docker compose up -d --build
```

## Workflow attendu

1. Lire `.docs/03-active-task.md` et les documents liés.
2. Vérifier que la tâche ne viole aucun contrat (surtout la DB).
3. Écrire ou ajuster la spec avant l'implémentation si le comportement change.
4. Implémenter.
5. Exécuter lint, typecheck, spec, build dans le conteneur.
6. Mettre à jour `.docs/03-active-task.md` (statut, journal) et, si nécessaire, `.docs/02-database.md` ou `.docs/01-architecture.md`.
7. Ne pas commiter sans demande explicite.

## Git et publication

Règle unique, sans exception : **une phase se livre toujours sur une branche dédiée, jamais directement sur `main`.** (Les phases 1 à 3 ont été commitées sur `main` : ce n'est plus le cas.)

1. Partir de `main` à jour : `git switch main && git pull`.
2. Créer la branche annoncée dans `.docs/03-active-task.md` (`feat/phase-N-...`).
3. Commits atomiques, un par sujet cohérent, au format `type(scope): impératif en français` — `feat`, `fix`, `test`, `docs`, `chore`, `refactor`, `build`.
4. Avant de pousser : `bun test packages/spec`, `bun run typecheck`, `bun run lint` dans Docker.
5. Pousser : `git push -u origin <branche>`, puis ouvrir une PR vers `main`. Ne pas fusionner sans demande.
6. `main` ne reçoit que des merges de PR, jamais de commit direct.

Si une phase n'a pas de branche annoncée, la créer avec le même format.

## Hygiène de contexte

- Ne pas lire `node_modules/`, `dist/`, `.bun/`, `bun.lock`, `apps/web/src/routeTree.gen.ts`, `packages/db/src/types.generated.ts`, les logs ou les fichiers de build.
- Utiliser `.ignore` et `.gitignore` pour exclure ces fichiers de la recherche.
- Préférer `rg`/recherche ciblée et les fichiers de mémoire `.docs` aux explorations larges.
- Ne pas dupliquer dans le contexte ce qui est déjà dans `.docs` : y référer.

## Mise à jour de la mémoire

| Information | Fichier |
| :--- | :--- |
| Décision durable, règle de jeu, stack | `.docs/01-architecture.md` |
| Table, colonne, index, type Kysely | `.docs/02-database.md` |
| Tâche du jour, statut, journal | `.docs/03-active-task.md` |
| Règle locale d'un dossier | `AGENTS.md` du dossier |
| Comportement attendu | `packages/spec` |
