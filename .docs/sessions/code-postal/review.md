# Revue — Phase 55, code postal

Round 1, sur `feat/v2-55-code-postal` (5 commits, base `feat/v2-idees-wave-2` à `4054ca1`).

Verdict : **prêt à livrer**, avec quatre écarts assumés (aucun *deal-breaker*).

## Ce qui est relu

Diff complet : 15 fichiers, +479 / −5. Contrat (`.docs/02-database.md`), migration, type Kysely,
module pur et sa spec, import, route, Cadastre, banc E2E.

## Défauts trouvés, et leur sort

| # | Gravité | Défaut | Sort |
| :--- | :--- | :--- | :--- |
| 1 | **deal-breaker** | À huit colonnes, `4 exemplaires` débordait sur la date à 1280 px (capture 1) : les pistes en `fr` étaient sous-dimensionnées et le texte, en `whitespace-nowrap`, chevauchait la colonne voisine. `scrollWidth === clientWidth` restait vrai — le débordement était **dans** la grille, pas hors de la page, donc indétectable par la seule mesure. | Corrigé : `md:gap-6` → `md:gap-4` et rééquilibrage des huit pistes. Re-capturé à 1280 px : plus aucun chevauchement. |
| 2 | suggestion | Le tiret seul dans la ligne de métadonnées mobile se lisait mal (« badge — 3 exemplaires »). | Le tiret n'est rendu que pour une `COMMUNE` ; les trois autres catégories n'affichent rien sur mobile. Le critère 8 porte sur la commune, et la colonne de bureau porte le tiret pour tout le monde. |
| 3 | suggestion | `ref_communes_code_postal_idx` ne sert aucune requête aujourd'hui : le tri est local au tableau, et aucune route ne filtre par code postal. | Conservé : il est exigé par le brief, il ne coûte rien à l'écriture et il servira la tranche différée. Consigné comme dette, pas comme défaut. |
| 4 | suggestion | `GET /cards/:id` ne porte pas `codePostal` : le Cartel ne peut pas l'afficher. | Hors périmètre du brief (« aucun autre champ nouveau »). Consigné pour une phase ultérieure si le Cartel doit le montrer. |

## Écarts assumés

- **`md:gap-4` au lieu de `md:gap-6`** sur la grille du Cadastre. Huit colonnes ne tiennent pas à
  1280 px avec les gouttières d'origine. Le changement est mesuré à la capture (aucun
  chevauchement, `scrollWidth === clientWidth` à 1280 et 390 px) et ne touche aucune autre route.
- **Le mode `--merge` réécrit `code_postal` avec `excluded.code_postal`.** Si un jour un
  import tournait avec un `COMMUNE_FIELDS` sans `codesPostaux`, il effacerait les codes existants.
  La liste de champs est constante dans `gouv.ts` et les demande toujours ; le risque est écrit,
  pas latent.
- **Codes postaux du banc inversés par rapport à la rareté** (`95000` pour `COMMUNE`, `84000` pour
  `MYTHIQUE`) : c'est ce qui rend le réordonnancement visible dans le cas E2E. Le banc n'est pas
  un référentiel réel.
- **`ref_communes` n'est pas rejouée en production** : la colonne naît `NULL` sur les 34 917
  lignes de développement et ne se remplit qu'au prochain `--merge`. C'est le comportement demandé
  (colonne nullable, sans défaut), et la capture du banc le montre avec des données semées.

## Critères du brief

| # | Critère | État |
| :--- | :--- | :--- |
| 1 | Migration appliquée et rejouable, données intactes | **Vérifié** : table de migrations supprimée, deux `db:migrate`, 34 917 communes et 441 cartes inchangées |
| 2 | `.docs/02-database.md` (colonne, index, type) | **Vérifié** au diff |
| 3 | `principalPostalCode` verrouillé par la spec | **Vérifié** : 8 cas, vus rouges puis verts |
| 4 | `--merge` remplit les lignes existantes | **Vérifié** au diff (`do update set`) |
| 5 | `GET /cards` : `codePostal` commune / `null` ailleurs | **Vérifié** : 2 cas d'intégration |
| 6 | Cadastre : colonne, tri, « — », aucun débordement | **Vérifié** : 3 cas E2E + captures 1280 et 390 px, débordement mesuré à 0 |
| 7 | `ci:check` vert, cas E2E vert | **Vérifié** : 582 spécifications / 32 fichiers, 127 cas E2E |

## Ce que la revue ne prouve pas

- Le remplissage réel de `code_postal` sur les ~35 000 communes : l'import n'a pas été rejoué
  contre `geo.api.gouv.fr` (pas de réseau dans la session, et un import complet écraserait les
  référentiels de développement). La preuve est celle du code et du type, pas d'une base réelle.
- La livraison `--merge` sur une base existante : même raison.
