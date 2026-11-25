# Revue — phase 53, la salle des raretés

Passe de relecture hostile, faite **après** `ci:check` vert et le banc complet, sur le diff
`feat/v2-idees-wave-1...HEAD` (9 fichiers, +734/−1).

## Verdict

**Prêt à livrer.** Six défauts trouvés, tous corrigés et rejoués. Un septième, hors périmètre de
la phase, a été trouvé par le banc et corrigé : il rendait le parcours critique instable.

## Défauts trouvés et corrigés

| # | Gravité | Constat | Correction |
| - | - | - | - |
| 1 | **deal-breaker** | Dans les trois tables à sceau, le sceau et le libellé vivaient dans le **même** `span`. Le glyphe du sceau (`C`, `P`, `R`…) est du texte : le `textContent` valait `"CCommune"`, aucune assertion exacte ne pouvait viser le libellé, et le nom accessible de la ligne se lisait « Rareté : Commune, Commune ». | Le libellé est dans son propre `span`, le sceau est enveloppé dans un `aria-hidden` : il est décoratif à côté du libellé qui porte seul le nom de la ligne. Le cas E2E vise désormais le libellé exact dans chaque table. |
| 2 | **haute** | Un bloc « Les quatre catégories » affichait `CATEGORY_WEIGHTS`, donc **Région** et **Département**. La décision 5 du brief dit « ni de mention des régions/départements : c'est la 56 », et la liste des sections à produire n'inclut pas ce bloc. | Bloc supprimé, avec `CATEGORY`/`CATEGORY_WEIGHTS`/`CATEGORY_LABELS` : la page ne parle plus que des paliers, des seuils, des formules, des exemples et de la rareté inversée. L'introduction des paliers rappelle seulement que la catégorie est tirée avant le palier, sans la nommer. |
| 3 | moyenne | Le paragraphe de la rareté inversée était conditionné aux deux exemples de référence : si l'un disparaissait du barème, la section ne gardait qu'un titre, sans corps. | `RARETE.inverted.fallback` porte la phrase sans chiffres ; le paragraphe chiffré reste rendu depuis `RUE_SCORE_EXAMPLES`. |
| 4 | moyenne | La colonne des poids s'intitulait « Chance au tirage ». C'est un excès de promesse : la catégorie est tirée **avant** le palier, donc `RARITY_WEIGHTS` est la part du palier dans son tirage, pas la probabilité globale d'obtenir un Mythique. | En-tête « Poids de tirage », le terme de `.docs/01-architecture.md` §2.2. |
| 5 | basse | Le tracé de navigation de « Les Raretés » était une étoile pleine, déjà employée par « Les Médailles » : deux salles voisines de la même feuille, deux glyphes identiques. | Losange facetté (`M12 3l7 9-7 9-7-9zM5 12h14`). |
| 6 | basse | Les cartes d'une même rangée s'étiraient à la hauteur de la plus longue : « Une commune » et « Les deux formules » laissaient un grand panneau vide sous leur contenu. | `items-start` sur la grille : chaque carte prend la hauteur de son contenu. |

## Défaut trouvé par le banc, hors phase 53

| # | Gravité | Constat | Correction |
| - | - | - | - |
| 7 | **haute** | `core-loop.spec.ts` (pas de cette phase) : le pas « case révélée » cliquait un bouton de la grille. Quand le tirage place la Pépite parmi les cases découvertes avant épuisement du ticket, sa modale reste ouverte et intercepte le clic. Le cas passait ou échouait **selon le hasard du tirage** — le premier passage du banc complet l'a laissé *flaky*, le second était vert. | Le cas referme la modale de la Pépite comme le ferait le joueur, avant d'ouvrir la case. Aucune assertion retirée, aucun délai relâché, aucun `skip`. |

## Vérifications faites à la main, fichier par fichier

- `packages/shared/src/rarity-examples.ts` — aucune dépendance (hors `type Rarity`), aucun accès
  réseau, aucune couleur. `RarityBand.min`/`max` sont **inclus** et documentés comme une donnée
  d'affichage, jamais une seconde formule : la spec vérifie chaque borne contre
  `communeRarity`/`rueRarity`, **y compris la valeur qui la franchit**, donc une bande fausse
  d'une unité est rouge.
- `packages/shared/src/index.ts` — un `export *` ajouté dans l'ordre alphabétique du barrel.
- `packages/spec/src/rarity-examples.spec.ts` — fichier neuf, 13 cas, aucune attente existante
  touchée. Il recoupe volontairement `scoring.spec.ts` sur les cinq exemples : `scoring.spec.ts`
  verrouille les **fonctions**, celui-ci verrouille les **données publiées par la page**. Un
  changement de formule casse les deux, ce qui est le but.
- `apps/web/src/content/rarete.ts` — module de libellés pur, **sans aucun import** ; aucun
  libellé de rareté, aucune couleur. Les bornes deviennent des phrases (« moins de 1 000
  habitants », « 1 commune ») par deux formateurs qui ne recalculent aucun palier.
- `apps/web/src/routes/rarete.tsx` — aucun `useState`, aucun `useEffect`, aucune requête, aucune
  donnée de joueur, aucune couleur littérale (vérifié : ni `#`, ni `text-[#`, ni `filter`, ni
  `backdrop-blur`). Un seul `h1`, la coquille possède le `main`. Les six paliers sont rendus par
  `RARITY.map`, leurs poids par `RARITY_WEIGHTS`, leurs libellés par `RARITY_LABELS`, leur marque
  par `RaritySeal` : rien n'est recopié.
- `apps/web/src/components/layout/nav-items.ts` — **seul** fichier de `components/layout/` touché :
  `SalonPath`, `SECONDARY_NAV_BASE` (entrée à la fin), `SALON_TITLES`. `sidebar.tsx`,
  `bottom-tab-bar.tsx`, `more-sheet.tsx`, `app-shell.tsx` : intacts. `mobile.spec.ts` n'est pas
  modifié et reste vert.
- `packages/e2e/tests/rarete.spec.ts` — trois cas, aucun `skip`, aucun `.fixme`, aucun délai
  ajouté. Aucun ne dépend du référentiel : le premier se joue **sans cookie** (la salle est
  publique), le deuxième passe par la feuille « Autres salles », le troisième mesure le cadre
  large.

## Écarts assumés

- **Aucun titre de document.** Le brief parle du « mécanisme de métadonnées que le routeur expose
  déjà (`__root.tsx`) » : il n'existe pas — `__root.tsx` n'a ni `head`, ni `<title>`, et rien
  dans `apps/web` n'écrit `document.title`. Le nom de la salle passe donc par `SALON_TITLES`,
  seule nomenclature existante, et la phase 54 généralisera. Aucun module `seo.ts` n'est créé.
- **Les noms accessibles des tables répètent le titre de section** (`aria-label` = texte du `h2`).
  C'est voulu : Playwright et les lecteurs d'écran nomment la table, au prix d'une répétition.
- **`items-start` laisse les bas de cartes non alignés** entre deux rangées. C'est préféré à un
  panneau vide, visible sur la première version.
- **Le paragraphe de la rareté inversée n'énonce pas le multiplicateur d'alignement.** §2.9 des
  idées le range dans le tableau, pas dans la rareté : la page s'arrête au barème des cartes.

## Ce que la revue ne prouve pas

- Rien sur la livraison d'une poussée de notification, sans rapport avec cette phase.
- Le rendu sous un lecteur d'écran réel : la structure est assertée (rôles, noms), pas écoutée.
