# AGENTS.md — Base de données

Lire d'abord `../../.docs/02-database.md`. C'est le contrat absolu.

## Règles

- Ne jamais inventer une table ou une colonne.
- Toute évolution : mettre à jour `.docs/02-database.md` **avant** d'écrire la migration.
- Les migrations appliquées sont immuables. Créer une nouvelle migration.
- Enregistrer chaque migration dans `src/migrator.ts`.
- `src/schema.ts` doit rester le miroir exact du SQL documenté.
- Les tables de jeu sont en `snake_case`.
- Les tables Better Auth (`user`, `session`, `account`, `verification`) sont générées par Better Auth. Ne pas les écrire à la main.
- Les clés étrangères utilisateur sont `text` et référencent `"user"("id")`.
- `bigserial` est typé `Generated<string>` côté Kysely (comportement du driver `pg`).
- Les index `(rarete, draw_bucket)` sont requis pour le tirage.
- Les migrations doivent être idempotentes autant que possible et sûres sur base vide.

## Vérifications

```sh
docker compose --profile tools run --rm dev bun run db:migrate
docker compose --profile tools run --rm dev bun run --cwd packages/db typecheck
docker compose --profile tools run --rm dev bun run db:types
```

Après migration, passer le statut de la table à **Migrée** dans `.docs/02-database.md`.
