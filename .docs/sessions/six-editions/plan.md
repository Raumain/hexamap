---
objective: "Verrouiller par une spécification la règle « une région et un département portent le palier tiré », et rendre l'édition lisible sur /rarete, dans le Cartel et dans le bandeau d'une case révélée."
status: done
---

# Plan : phase 56 — Une région, six éditions

Source : `.docs/09-idees.md` I-006 · brief de session phase 56 · `.docs/01-architecture.md` §2.1, §2.2, §2.6

## Constat de départ, vérifié dans le code

- `apps/api/src/services/draw.ts:79-105` : `drawRegion(exec, rarity, rng)` écrit
  `card.rarity = rarity` et `score = editionScore(rarity)`. `:107-134` fait de même pour un
  département, plus `departementPopulationBonus(row.population)`.
- Aucune spécification n'asserte ce comportement : `packages/spec/src/tickets.spec.ts` ne couvre
  que le cas inverse pour les communes. **Le trou est un trou de preuve, pas un bug de tirage.**
- `packages/shared/src/rarity.ts` ne contient **aucune** constante `TREASURE_RARITIES` ni
  `CARD_RARITIES` (inventaire refait : `grep` sur tout `packages/shared/src`). L'idée I-006 les
  cite ; ils n'existent pas. Écart à consigner, aucune constante inventée.

## Ce que la phase ne fait pas

- Aucune migration, aucune table, aucune colonne, aucun index, aucune route.
- `apps/api/src/services/draw.ts` n'est **pas** touché : le tirage est correct.
- Aucun cas existant de `packages/spec` n'est réécrit ; on ajoute.
- Aucun pourcentage écrit à la main : les six poids viennent de `RARITY_WEIGHTS`, les six scores
  de `EDITION_SCORE`.

## Étapes

| # | Étape | Fichiers | Vérification |
| --- | --- | --- | --- |
| 1 | Le cas de spécification, avant l'interface | `packages/spec/src/tickets.spec.ts` (+2 imports, 1 cas dans `describe('Plan §5.6 — robustesse du tirage')`) | `bun test packages/spec/src/tickets.spec.ts` — voir le cas rouge par une assertion volontairement fausse en local (non commitée), puis vert |
| 2 | Les textes neufs | `apps/web/src/content/rarete.ts` (objet `editions`, `editionLabel`, `editionNote`) et `apps/web/src/content/card-detail.ts` (`editionLabel`, `editionLink`) | typecheck web |
| 3 | La section de `/rarete` | `apps/web/src/routes/rarete.tsx` | lecture du diff + E2E |
| 4 | Le Cartel d'une région / d'un département | `apps/web/src/routes/card.$cardId.tsx` (`CartelSheet`) | typecheck + capture navigateur |
| 5 | Le bandeau de la case révélée | `apps/web/src/components/revealed-cell.tsx` (`CellStrip`) | capture navigateur, aucun `h-*` ajouté |
| 6 | Le cas E2E | `packages/e2e/tests/rarete.spec.ts` (+1 cas) | banc E2E |
| 7 | Mesure et livraison | `ci:check` en Docker sur `hexamap_test_56`, banc E2E, journal, commits, PR brouillon vers `feat/v2-idees-wave-3` | voir ci-dessous |

## Détail des décisions d'interface

1. **`/rarete`** : nouvelle planche `RARETE.editions` dans la grille, après « Une rue ».
   Tableau à deux colonnes (Édition / Score) alimenté par `RARITY.map` + `EDITION_SCORE[rarity]` ;
   la phrase « posséder deux fois la même région dans deux éditions n'est pas un doublon, c'est
   deux cartes. » et la distinction avec la commune (« sa rareté ne change jamais »).
   Le titre accessible du tableau (`aria-label`) est le titre de la section, pour que le banc le
   trouve par rôle.
2. **Le Cartel** : pour `REGION` et `DEPARTEMENT` seulement, la ligne « Rareté » devient
   « Édition » (même sceau, même libellé), et une note sous la liste porte
   « Édition <libellé> — une région peut être tirée dans les six éditions ; sa valeur est celle de
   l'édition, pas du lieu. » suivie d'un lien vers `/rarete`. Pour une `COMMUNE` ou une `RUE`,
   rien ne change : la ligne reste « Rareté » et aucune note n'apparaît.
3. **Le bandeau d'une case révélée** : `CellStrip` affiche « Édition <libellé> » à gauche pour
   `REGION` / `DEPARTEMENT` (au lieu de rien), « Jumelé » reste pour `TWIN`, la distance reste à
   droite. Le bandeau garde son `h-4` : le texte passe en `truncate` pour ne pas déborder une
   case de 78 px sur mobile, et porte son libellé complet en `title`. La géométrie n'est pas
   touchée.
4. **Vocabulaire** : « édition » pour région/département, « rareté » pour commune/rue. Les
   libellés viennent de `RARITY_LABELS`, en minuscule dans la phrase (« Édition mythique »).

## Vérification de chaque critère

| Critère du brief | Comment il est prouvé |
| --- | --- |
| 1. Le cas de spec (région et département, `EDITION_SCORE`, bonus) | le cas ajouté, vert sur la suite complète |
| 2. `/rarete` porte la section, les six scores, la phrase « deux cartes » | le cas E2E ajouté + capture |
| 3. Le Cartel région/département, commune/rue inchangées | comparaison des deux rendus dans le navigateur |
| 4. Le bandeau nomme l'édition | capture d'un ticket dont une case est une région |
| 5. Aucun pourcentage à la main | `grep` sur le diff : aucune valeur `%` littérale ajoutée |
| 6. Aucune migration, aucun changement de tirage | `git diff --stat` |
| 7. `ci:check` vert + E2E `/rarete` | sortie collée dans le journal |

## Risques identifiés avant d'écrire

- **Le cas de spec sera vert du premier coup** : c'est le résultat attendu et c'est le constat
  d'I-006. La preuve qu'il n'est pas vide se fait en inversant l'assertion une fois, en local,
  sans la committer.
- **Largeur du bandeau sur mobile** : « Édition mythique » dépasse la largeur d'une case
  `aspect-[3/5]` en `grid-cols-4`. `truncate` + `title` borne le dégât ; à vérifier à 390 px.
- **Deux comptes s'appuient sur `CATEGORY_LABELS`** : inchangé.
