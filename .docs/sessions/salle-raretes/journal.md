# Journal — phase 53, la salle des raretés

Branche `feat/v2-53-salle-raretes`, partie de `feat/v2-idees-wave-1` (`bb06ff9`). Migration
réservée : aucune. Retour traité : **I-003** de `.docs/09-idees.md`.
`.docs/03-active-task.md` n'a pas été ouvert.

## 2026-11-25 — Plan (01-plan)

`.docs/sessions/salle-raretes/{plan,phase-1,phase-2,phase-3}.md` écrits avant la première ligne
de code. La question de plan était déjà tranchée par le brief (salle seconde, page publique,
module pur dans `packages/shared`, exemples figés). Deux points ont demandé une vérification :

- **Le « mécanisme de métadonnées de `__root.tsx` » n'existe pas.** `__root.tsx` ne déclare ni
  `head` ni `title`, et aucune ligne de `apps/web` n'écrit `document.title`. Le nom de la salle
  passe donc par `SALON_TITLES` de `nav-items.ts`, seule nomenclature existante. Aucun `seo.ts`
  créé : la phase 54 le fera. Écart consigné dans `review.md`.
- **La feuille « Autres salles » n'est rendue qu'avec une session** (`bottom-tab-bar.tsx:68`,
  `signedIn`). Le parcours « depuis la feuille » suppose donc un compte ; le cas E2E qui prouve
  « sans session » visite `/rarete` directement, avec un contexte vidé de ses cookies.

## 2026-11-25 — Spec d'abord (02-implement)

`packages/spec/src/rarity-examples.spec.ts` écrit **avant** le module, vu rouge :
`SyntaxError: Export named 'COMMUNE_RARITY_BOUNDS' not found in module
'/app/packages/shared/src/index.ts'`. Puis `packages/shared/src/rarity-examples.ts` :
13 cas verts.

Le module porte deux choses distinctes, et la séparation est le contrat :

- les **dix exemples** de §2.4, figés (population → score, nombre de communes → score) ;
- les **douze bornes** de palier (`COMMUNE_RARITY_BOUNDS`, `RUE_RARITY_BOUNDS`), bornes
  **incluses**, qui alimentent le texte des tables de seuils sans que le composant ait à
  reconstruire une seule condition.

La spec ne se contente pas de comparer des nombres : pour chaque bande, elle vérifie
`rarity(min)`, `rarity(max)` **et** `rarity(max + 1) !== rarity`. Une borne fausse d'une unité
(celle que le navigateur afficherait telle quelle) devient donc rouge.

## 2026-11-25 — La salle et son entrée de navigation

`apps/web/src/routes/rarete.tsx` rend sept blocs — six paliers, seuils de commune, seuils de rue,
les deux formules, les dix exemples, la rareté inversée — en `grid` d'une colonne sur mobile,
deux sur desktop. Tout se lit dans `@hexamap/shared` : `RARITY`, `RARITY_LABELS`,
`RARITY_WEIGHTS`, `COMMUNE_RARITY_BOUNDS`, `RUE_RARITY_BOUNDS`, `COMMUNE_SCORE_EXAMPLES`,
`RUE_SCORE_EXAMPLES`. Aucune couleur littérale, aucun libellé de rareté recopié (vérifié par
`grep`), aucune donnée de joueur.

`nav-items.ts` est le **seul** fichier de `components/layout/` touché : `SalonPath`,
`SECONDARY_NAV_BASE` (entrée ajoutée à la fin) et `SALON_TITLES`. La feuille mobile, le rail et
`isSecondaryRoom` en héritent sans qu'aucun d'eux ne change.

## 2026-11-25 — Mesures, dans Docker

`ci:check` sur `hexamap_test_53` : lint, typecheck, base de test (21 migrations), **572
spécifications dans 31 fichiers, 0 échec**, puis mesure de charge (p95 du résumé d'Atlas
20,3 ms pour un seuil de 200 ms). Le compte passe de 559 à 572 : treize cas neufs, aucun cas
existant réécrit.

Banc E2E complet, image `api` de production reconstruite et **vérifiée dans l'image** (`ls
/app/public/assets | grep rarete` avant de lancer, pour ne pas rejouer la pépite sur un bundle
périmé) : **124 cas, 0 échec** sur `chromium`, `pwa`, `Pixel 7` et `iPhone 13`. Les trois cas
neufs de `rarete.spec.ts` sont verts.

## 2026-11-25 — Deux défauts que seul le banc a vus

1. **Un libellé de rareté inaccessible au test, et mal nommé.** Le sceau et son libellé
   partageaient un `span`, donc le `textContent` valait `"CCommune"` : l'assertion exacte ne
   trouvait rien, et un lecteur d'écran aurait annoncé « Rareté : Commune, Commune ». Corrigé
   dans le composant (libellé dans son propre élément, sceau `aria-hidden`), pas dans le test.
2. **`core-loop.spec.ts` était instable depuis la phase 52.** Le premier passage du banc complet
   l'a laissé *flaky* : quand le tirage place la Pépite parmi les cases découvertes avant
   épuisement du ticket, sa modale recouvre la grille et intercepte le clic du pas « case
   révélée » ajouté par la 52. Le cas passait donc **selon le hasard du tirage**. Le cas referme
   maintenant la modale comme le ferait le joueur ; aucune assertion retirée, aucun délai
   relâché. Deux passages complets consécutifs sont verts après le correctif.

## 2026-11-25 — Vérification visuelle (règle 10)

Sonde Playwright temporaire contre le banc, **retirée du dépôt avant le commit**
(`packages/e2e/tests/zz-visual-probe.spec.ts` supprimé, `test-results/` et
`playwright-report/` nettoyés). Elle se joue sans cookie et écrit captures et lectures sur le
disque monté.

À **390 px** (`scrollWidth = clientWidth = 390`, `overflow = 0`) : une seule colonne — les six
articles commencent à 315, 851, 1307, 1762, 2132 et 2547 px. On lit, de haut en bas : « Le
barème » / « Les Raretés » ; « Les six paliers » avec `C Commune 55,0 %`, `P Peu commune 25,0 %`,
`R Rare 13,0 %`, `É Épique 5,0 %`, `L Légendaire 1,8 %`, `M Mythique 0,2 %` et la ligne
`Total 100,0 %` ; « Une commune : sa population » de « moins de 1 000 habitants » à « 250 000
habitants et plus » ; « Une rue : le nombre de communes » de « plus de 500 communes » à
« 1 commune » ; les deux formules `round(100 × log₁₀(max(P, 10))²)` et
`round(3 000 ÷ (1 + log₁₀(max(N, 1))))` ; les dix exemples — dont `100 habitants … 400 pts` et
`1 commune … 3 000 pts` ; enfin « La rareté inversée des rues » avec « … vaut 3 000 pts, le
sommet du barème. La même voie, présente dans dix mille communes, n'en vaut plus que 600 pts. »
Aucun débordement horizontal, aucune colonne coupée.

À **1280 px** (`scrollWidth = clientWidth = 1280`, `overflow = 0`) : deux colonnes — les deux
premiers articles partagent la même origine verticale (233 px), puis la paire suivante (770 px) ;
« Les exemples du barème » et « La rareté inversée des rues » occupent toute la largeur. Les
cartes prennent la hauteur de leur contenu (`items-start`), donc aucun panneau vide.

## Écarts assumés

- **Aucun bloc « Régions et départements : six éditions »** — la phase 56 l'ajoutera. Un premier
  jet affichait les poids des quatre **catégories** (`CATEGORY_WEIGHTS`), donc nommait Région et
  Département ; la décision 5 du brief l'interdit sur cette page. Bloc retiré, pas remplacé.
- **Aucun titre de document** : le mécanisme annoncé par le brief (`__root.tsx`) n'existe pas.
  Le nom de la salle passe par `SALON_TITLES`, et la 54 généralisera.
- **Les noms accessibles des tables répètent le titre de section** (`aria-label` = texte du
  `h2`). Choisi : la table est nommable, au prix d'une répétition.
- **`packages/e2e/tests/core-loop.spec.ts` est modifié**, alors que la phase n'en est pas
  propriétaire. Motif : le cas était instable depuis la phase 52 et faisait tomber la porte ;
  la correction ajoute une précondition, elle n'enlève aucune assertion.
- **Aucune écriture de mémoire projet** : `.docs/10-retours-v2.md` n'en exige aucune pour
  I-003, et le `p95` de l'Atlas n'est pas concerné.
