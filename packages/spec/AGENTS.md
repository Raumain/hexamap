# AGENTS.md — Spécifications

`packages/spec` est la **source de vérité exécutable**. Le code doit passer la spec, jamais l'inverse.

## Règles

- Une PR d'implémentation ne modifie pas un test de spec pour le faire passer.
- Toute évolution de comportement commence par une PR de spec dédiée, avec la référence GDD.
- Chaque test nomme sa source : `GDD §3.B.1`, `GDD §4.C`, etc.
- Les tests de formules sont table-driven et reprennent les exemples chiffrés du GDD.
- Les tests statistiques injectent un RNG seedé (`createRng(seed)`) pour être déterministes.
- Les tests d'intégration utilisent un vrai PostgreSQL et un schéma isolé par worker.
- Les specs non implémentées peuvent être marquées `skip` avec une issue liée, mais restent la cible.
- La CI exécute toute la suite et bloque le merge en cas d'échec.

## Commandes

```sh
docker compose --profile tools run --rm dev bun test packages/spec
docker compose --profile tools run --rm dev bun run --cwd packages/spec typecheck
```
