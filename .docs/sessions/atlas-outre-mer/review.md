# Revue — Phase 50 · L'Atlas accueille l'outre-mer

Passe de relecture hostile sur le diff complet (contrat, migration, projection, backfill, API,
web, specs, banc).

## Verdict : prêt à livrer

Aucun défaut de gravité *deal-breaker*. Les sept critères d'acceptation sont tenus et prouvés
ci-dessous ; les quatre réserves sont des suggestions, pas des blocages.

## Critères

| # | Critère | Preuve |
| - | --- | --- |
| 1 | 139 lignes d'outre-mer avec `path_d`, cadre d'une commune = celui de son département | `path_d` non nul : 5/5 régions, 5/5 départements, 129/129 communes. `select count(*) … where c.view_box <> d.view_box` → **0**. |
| 2 | Seconde exécution : zéro tracé réécrit | `Outre-mer : 5 groupe(s) · 139 lignes · 0 tracés écrits · 139 déjà écrits · 0 cadres mis à jour`. |
| 3 | Métropole inchangée | MD5 identiques avant/après sur 21 régions, 104 départements et 34 788 communes ; 0 ligne métropolitaine hors du `view_box` par défaut. |
| 4 | Cadre porté avec le tracé, schémas fermés | `viewBox` déclaré dans `regionSchema`, `summaryDepartementSchema` et `communeSchema` (`additionalProperties: false`) et dans le modèle de `@hexamap/shared` ; le détail lit `d.view_box`. |
| 5 | Un encart par DROM, même chemin d'ouverture | `atlas-outre-mer.spec.ts` : encart `data-map-frame="groupe"` avec un `viewBox` ≠ `0 0 1000 1000`, chaque tracé contenu dans le cadre (`getBBox`), puis ouverture du département depuis l'encart → même titre, même table, même `viewBox` de détail. |
| 6 | `view_box` sur les trois tables, documenté, migration rejouable | `.docs/02-database.md` §2/§5/§6/§7.1 ; `0021_view_box` en `add column if not exists` ×3, rejouée deux fois sur `hexamap_test_50` (`already exists, skipping`). |
| 7 | `ci:check` et banc E2E verts | Voir la section « Mesures » ci-dessous. |

## Mesures

- `ci:check` sur `postgres://hexamap:hexamap@db:5432/hexamap_test_50` : `1/5 Lint` et
  `2/5 Typecheck` verts, `3/5 Base de données` vert, `4/5 Spécifications` **565 pass · 0 fail ·
  3 342 `expect()` · 30 fichiers**, `5/5 Mesure de charge` **2 pass · 0 fail** (`p95` du résumé
  **20,6 ms**, charge d'un département de 900 communes **360 907 octets**), *Gatekeeper vert*.
- Banc E2E complet sur `docker-compose.e2e.yml` (`hexamap_e2e`) : **116 pass · 0 fail**, dont les
  deux cas neufs. Rejeu ciblé de `tests/atlas` : **12 pass · 0 fail** (2 neufs + 10 existants).
  Le service `seed` a dû être **reconstruit** (`docker compose -f docker-compose.e2e.yml build
  seed`) : son image porte le code source et `up -d --build db api proxy` ne la reconstruit pas —
  sans cela, `Module not found "packages/e2e/fixtures/drom-fixture.ts"`.

## Réserves (non bloquantes)

1. **`viewBox` est dupliqué sur chaque commune.** Le contrat (décisions 9 et 10 du brief) veut que
   le cadre voyage avec le tracé ; il est donc répété sur les 129 lignes d'un département
   d'outre-mer, et sur les ~900 d'un département métropolitain. Mesure du banc de charge : la
   charge d'un département de 900 communes passe à **360 907 octets** (les 337 527 octets de la
   phase 34 avaient été relevés sur un autre passage), soit **≈ 26 octets par commune**, très
   au-dessous du garde-fou de 512 Kio. Le champ ne varie jamais à l'intérieur d'un département :
   une colonne au niveau du département suffirait, mais elle contredirait « le cadre voyage avec le
   tracé » ligne par ligne.
2. **`splitByFrame` s'appuie implicitement sur `summary.viewBox` = cadre métropolitain.** C'est le
   contrat de l'API (`ATLAS_VIEWBOX`), mais si un jour le résumé renvoyait un autre cadre de tête,
   toutes les entités métropolitaines deviendraient des « groupes ». Un commentaire le dit ; une
   assertion de spec ne le verrouille pas côté service (il faudrait une base pour tester
   `loadAtlasSummary`).
3. **`atlas.spec.ts` change de compte (`2` → `3` régions/départements).** C'est la fixture qui
   grandit d'un DROM, pas une assertion qu'on relâche : aucune attente n'est supprimée, aucun délai
   n'est touché, et le compte reste exact. Consigné au journal.
4. **Le groupe est identifié par « région `out_of_viewbox` »**, pas par un code de département.
   C'est la règle de R-006 et cela évite une liste à maintenir, mais une région métropolitaine
   dont la géométrie serait corrompue au point de sortir du cadre serait traitée comme un groupe.
   Le cas est invérifiable sans donnée corrompue ; il est écrit ici plutôt que silencieux.

## Ce qui n'a pas été touché, volontairement

- `0015_atlas_paths` et les migrations livrées : intactes. Un seul numéro, `0021_view_box`.
- Aucun `path_d` métropolitain recalculé, aucun `geom` réécrit, aucun réimport.
- Aucune projection au runtime : ni `apps/api`, ni `apps/web` n'importe `atlas-projection`.
- Aucun fichier de `packages/spec` existant modifié ; `packages/spec/src/atlas-frames.spec.ts` est
  un fichier neuf.
- `apps/web/src/routeTree.gen.ts` et `packages/db/src/types.generated.ts` non édités à la main.
- Aucune dépendance ajoutée, aucune bibliothèque de clipping.
