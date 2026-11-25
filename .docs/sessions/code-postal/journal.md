# Journal — Phase 55, code postal

Branche `feat/v2-55-code-postal`, partie de `feat/v2-idees-wave-2` (`4054ca1`). Migration
réservée : `0022_postal_code`.

## Ce qui a été livré

- **Contrat** : `.docs/02-database.md` §2 (ligne `0022_postal_code`), §5 (colonne `code_postal`,
  index `ref_communes_code_postal_idx`, règle du code principal), §6 (`RefCommuneTable`).
- **Migration** `0022_postal_code` : `add column if not exists code_postal text`,
  `create index if not exists`, aucun `NOT NULL`, aucun défaut.
- **Règle pure** `packages/shared/src/postal.ts` : `principalPostalCode`,
  `POSTAL_CODE_PATTERN`, exportés par l'index du paquet.
- **Import** : `codesPostaux` demandé à `geo.api.gouv.fr`, `code_postal` dans `RefCommuneRow`,
  écrit à l'insert **et** au `do update set` de `--merge`.
- **API** : `codePostal` dans `cardSchema`, résolu par `resolveCardPostalCodes` (une requête au
  plus, et seulement s'il y a des communes dans la page), `null` pour les trois autres catégories.
- **Cadastre** : 8<sup>e</sup> colonne « Code postal » triable entre le score et les exemplaires,
  tiret pour l'absence, code postal dans la ligne de métadonnées mobile.
- **Banc E2E** : trois cas (tri croissant puis décroissant, tiret pour un non-commune, aucun
  débordement à 390 px), et des codes postaux sur les communes `E2E-*`.

## Vérifications, dans l'ordre où elles ont été faites

1. Spec `postal.spec.ts` écrite seule, vue **rouge** (`Export named 'POSTAL_CODE_PATTERN' not
   found`), puis module pur : 8 cas verts.
2. Migration appliquée, puis **rejouabilité** : `drop table kysely_migration,
   kysely_migration_lock`, deux `db:migrate` complets (22 migrations rejouées), et
   `ref_communes` / `user_cards` recomptés à l'identique (34 917 / 441). Colonne vérifiée en
   `information_schema` : nullable, sans défaut ; index présent.
3. Cas de route ajouté à la spec et vu **rouge** (`Received: undefined`), puis
   `resolveCardPostalCodes` et le champ de réponse : 10 cas verts.
4. `ci:check` (lint, typecheck, base de test, spécifications) : **582 spécifications, 32 fichiers,
   0 échec**.
5. Banc E2E complet : **127 cas, 0 échec** sur `chromium`, `pwa`, `Pixel 7`, `iPhone 13`.

## Deux pièges rencontrés

- **L'image `seed` du banc n'a pas de volume.** Modifier `scripts/import/src/e2e-seed.ts` ne suffit
  pas : `docker compose -f docker-compose.e2e.yml run --rm seed` réutilise l'image construite à la
  dernière phase, donc l'ancien semis (sans code postal). Il faut `build seed` — le premier
  passage a produit 12 communes à `NULL`, et deux cas E2E rouges, avant que la cause soit vue.
- **`docker compose run` a recréé l'API depuis une image périmée** un moment donné, et le
  démarrage a échoué en `corrupted migrations: previously executed migration 0022_postal_code is
  missing`. Reconstruit (`up -d --build api`), tout est rentré dans l'ordre.

## Revue

Un *deal-breaker* trouvé par la capture, pas par la mesure : à 1280 px, `4 exemplaires` chevauchait
la date dans la grille à huit pistes, alors que `scrollWidth === clientWidth` restait vrai.
Corrigé (`md:gap-4`, pistes rééquilibrées), re-capturé. Voir `review.md`.

## Ce qui n'est pas fait

- Le **filtre par tranche de code postal** est différé : aucune entrée de `.docs` ne tranche les
  tranches (département ? région ? 01–95 ?), et une décision produit ne s'invente pas ici.
- Le tableau complet des codes postaux n'est pas stocké : une colonne, un code principal.
- `GET /cards/:id` ne porte pas `codePostal` : hors périmètre du brief.
- L'import n'a pas été rejoué contre l'API Open Data (pas de réseau, et il écraserait le
  référentiel de développement) : le contrat est vérifié au code et au type, pas sur une base
  réelle.
