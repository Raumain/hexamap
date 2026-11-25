# Journal — phase 51, vendre une carte par planches

Branche `feat/v2-51-vendre-planche`, partie de `v2` (`7f114fb`). Migration réservée : aucune.
Retour traité : I-001 de `.docs/09-idees.md`. `.docs/03-active-task.md` n'a pas été touché.

## 2026-11-25 — un seul écran, un tiroir neuf

**Le choix.** I-001 laissait ouverte la question « un écran ou deux ». Tranché pour **un seul** :
`/market/mine` garde sa section de vente, le tiroir remplace la `<select>`, le prix et le bouton
restent juste dessous. Une route `/comptoir/vendre` aurait ajouté une navigation, donc un retour à
gérer, pour un formulaire qui tient dans une section. Le tiroir a une hauteur bornée
(`min(22rem, 42vh)`), donc le prix n'est jamais enfoui sous 400 lignes.

**Le composant est neuf, `CardDrawer` n'est pas touché.** `routes/tableau.tsx` est couplé aux
emplacements (`TABLEAU_CANDIDATE_LINKS`, `rankCardsByCompatibility`) : le réutiliser aurait mis La
Planche en risque pour rien, et le brief l'interdit. Ce qui est partagé, c'est la **planche** et le
vocabulaire — pas le tiroir.

**Spec d'abord.** `packages/spec/src/card-picker.spec.ts` (15 cas) écrit avant
`apps/web/src/lib/card-picker.ts`, vu rouge (`Cannot find module … card-picker`), puis vert. Aucune
attente existante n'a été modifiée ; la suite est passée de 544 à **559 spécifications**.

**Mesures, dans Docker.** `ci:check` vert aux cinq étapes : lint, typecheck, base de test
(21 migrations), **559 spécifications dans 30 fichiers**, 0 échec, puis charge (p95 du résumé
d'Atlas 19,7 ms pour un seuil de 200 ms). Banc E2E complet vert : **121 cas**, 0 échec, sur
`chromium`, `pwa`, `Pixel 7` et `iPhone 13` — dont les trois cas neufs de `market-sell.spec.ts`.

**La surface a été regardée, pas supposée.** Captures jointes par le banc à 390 px et 1280 px. À
390 px : recherche, puces « Catégorie » et « Rareté » sur deux lignes, **« 41 cartes »** annoncées,
deux planches rendues dans un cadre borné, aucun débordement horizontal. À 1280 px : recherche
`E2E-C-RARE-0`, puce « Rare » pressée, **« 1 carte »**, une planche (commune, code, sceau `RARE`,
750), puis « Aucune carte choisie pour la vente. », le champ prix et le bouton, inerte tant que
rien n'est choisi.

**Deux défauts trouvés par le banc, pas par la relecture.** (1) La géométrie du cas à 390 px
comparait une boîte mesurée avant le défilement à une boîte mesurée après : remplacée par une
assertion d'ordre du DOM. (2) Le cas à 1280 px lisait le compte avant le rendu du filtre et
cherchait `E2E`, qui retient **toutes** les cartes du banc (leurs codes sont tous `E2E-…`) : il
presse désormais la puce « Rare » et exige que le compte change, puis « 1 carte ».

**Deux défauts trouvés en relecture.** Le bouton restait armé quand la carte choisie quittait la
liste (vendue ailleurs) : il se ferme. La recherche de la carte retenue se rejouait à chaque image
du défilement : mémoïsée.

## Écarts assumés

- **`CATEGORY_LABELS` n'est pas dans `@hexamap/shared`** mais dans
  `apps/web/src/content/tickets.ts`. Le module pur n'importe donc que `RARITY_LABELS` du domaine ;
  les libellés de catégorie restent lus par le composant, là où ils sont déjà définis.
- **`refCode` est cherché pour toutes les catégories, rue comprise.** Le brief demande « nom ou
  code » ; le Cadastre, lui, borne le code aux codes publics, parce qu'une rue porte
  `ref_odonymes.id`. Dans le tiroir, la recherche reste un filtre de texte sur la collection du
  joueur : aucune jointure, aucune heuristique de nom.
- **`aspect-[4/5]` n'est pas écrit dans la ligne** : `decorative` le porte déjà
  (`card-shell.ts:45`), et la ligne ne déclare ni `aspect-*` ni hauteur — c'est le contenu qui la
  dimensionne, comme le tiroir de La Planche.
- **Le virtualiseur est prouvé structurellement**, pas sur 5 000 cartes : le banc en compte 41, et
  le cas assert ≤ 25 lignes rendues, un cadre ≤ 360 px, et un compte annoncé supérieur au nombre
  de lignes dès qu'il dépasse 25.

## Incident de mesure, consigné

Un passage d'`ci:check` a rendu `BUG-002 — nomme les cartes dont le référentiel n'existe pas` en
timeout de 5 s, alors que le fichier `ref-integrity.spec.ts`, `packages/db` et `scripts/` sont
**identiques** à `v2` (`git diff v2 -- …` vide). Le cas repasse seul en 26 ms, puis la suite
entière repasse à 559/559. C'est la contention déjà connue de la campagne (le test de charge de
l'Atlas a expiré une fois de la même façon), pas un effet de cette phase. À surveiller.
