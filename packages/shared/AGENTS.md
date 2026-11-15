# AGENTS.md — Domaine partagé

Ce package contient les règles pures du jeu, partagées entre le serveur et le front.

## Règles

- Uniquement des fonctions pures et des constantes.
- Aucune dépendance à la base, au réseau, à l'environnement ou à Bun.
- Les formules doivent reproduire exactement `.docs/01-architecture.md` (GDD).
- Les types exportés sont la référence pour les cartes, raretés, catégories et scores.
- Ne pas dupliquer une formule côté serveur ou côté web : importer depuis `@hexamap/shared`.
- Les modifications de formule nécessitent une mise à jour de la spec et de la documentation.

## Vérifications

```sh
docker compose --profile tools run --rm dev bun run --cwd packages/shared typecheck
docker compose --profile tools run --rm dev bun test packages/spec
```
