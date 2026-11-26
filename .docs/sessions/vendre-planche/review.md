# Revue — phase 51, vendre une carte par planches

Passe de relecture hostile, faite sur le diff complet (`git diff v2...HEAD`) après `ci:check`
vert et avant la PR.

## Verdict

**Prêt à livrer.** Deux défauts trouvés, tous deux corrigés et rejoués ; aucun *deal-breaker*
restant.

## Défauts trouvés

| # | Gravité | Constat | État |
| --- | --- | --- | --- |
| 1 | bloquant | La carte choisie peut quitter la liste entre le tap et l'envoi (vendue depuis un autre onglet, donc `locked`). `cardId` restait armé, `formValid` restait vrai et « Mettre en vente » envoyait une carte verrouillée, que l'API refusait en `409`. | Corrigé : `chosenCard` est dérivé de la liste vivante, `formValid` exige sa présence. |
| 2 | suggestion | `cards.find(...)` pour la ligne « Carte choisie » se rejouait à chaque image du défilement de la liste virtualisée, sur une collection plafonnée à 5 000 cartes. | Corrigé : `useMemo([cards, value])`. |
| 3 | suggestion | `fieldClass` est recopié à l'identique dans la route et dans le composant. | Assumé : deux champs, deux contextes ; une extraction créerait un troisième propriétaire pour une seule chaîne. |
| 4 | suggestion | `ROW_ESTIMATE = 86` et non 88 (bordure comprise). | Assumé : valeur identique au tiroir de La Planche, et le virtualiseur remesure chaque ligne (`measureElement`). |
| 5 | suggestion | Une recherche par code de rue fouille `ref_odonymes.id`, un identifiant interne. | Assumé et écrit : le brief demande « nom ou code » ; le Cadastre, lui, borne le code aux codes publics (`.docs/01-architecture.md` §4.9). Divergence consignée au journal. |

## Vérifications faites à la main, fichier par fichier

- `apps/web/src/lib/card-picker.ts` — aucun `import` React, aucune couleur, aucune requête ;
  entrée jamais mutée (`filter` rend un tableau neuf), ordre d'entrée conservé, aucun libellé de
  rareté recopié (`RARITY_LABELS`).
- `apps/web/src/components/card-picker.tsx` — aucun `useEffect`, aucun `filter`, aucun
  `backdrop-filter` dans la liste ; `useVirtualizer` avec `estimateSize`, `getItemKey` et
  `overscan: 8` ; ligne = `Card` `w-14` `decorative` (le châssis porte `aspect-[4/5]`) ; rareté
  rendue par `RarityBadge` ; sélection marquée par `aria-pressed` et `border-brass`.
- `apps/web/src/routes/market.mine.tsx` — plus aucun `<select>` ni `<option>` ; `parsedPrice`,
  `priceValid`, `priceError` et `createMutation.mutate({ userCardId, price })` inchangés ; le prix
  et le bouton suivent la liste dans le document.
- `apps/web/src/content/market.ts` — `selectCard` et `cardLabel` disparaissent avec la liste
  déroulante (vérifié : aucun autre lecteur) ; tous les textes neufs sont en français.
- `packages/spec/src/card-picker.spec.ts` — fichier neuf ; aucune attente existante touchée.
- `packages/e2e/tests/market-sell.spec.ts` — aucun `skip`, aucun `.fixme`, aucun délai ajouté ;
  le cas de vente est neuf (il n'en existait aucun : `grep 'Mettre en vente' packages/e2e/tests`
  ne rendait que la salle secondaire de `mobile.spec.ts`).
- Interdits respectés : `tableau.tsx`, `components/layout/`, `tickets.$ticketId.tsx`,
  `packages/db`, `scripts/import` et `main` ne sont pas touchés ; aucune migration, route, table
  ni champ d'API.

## Défauts trouvés et corrigés *pendant* la phase, sur le banc

Rien n'est passé sous silence : deux mesures du premier jet étaient fausses, et c'est le banc qui
les a vues, pas la relecture.

1. La géométrie du passage à 390 px comparait une boîte mesurée **avant** le défilement à une
   boîte mesurée **après**. Le prix se vérifie désormais par l'ordre du DOM
   (`DOCUMENT_POSITION_FOLLOWING`), insensible au défilement.
2. Le passage à 1280 px lisait le compte avant que le filtre ne soit rendu, et cherchait `E2E`,
   qui retient **toutes** les cartes du banc (leurs codes sont tous `E2E-…`). Il presse
   maintenant la puce « Rare », exige que le compte change, puis exige « 1 carte » sur une
   recherche par code.

## Ce que la revue ne prouve pas

- La livraison d'une poussée de notification, sans rapport avec cette phase.
- Le comportement d'une collection réellement peuplée de plusieurs milliers de cartes : le banc
  en compte 41. Le bornage est prouvé structurellement (≤ 25 lignes rendues, cadre ≤ 360 px,
  compte annoncé supérieur au nombre de lignes quand il dépasse 25), jamais sur 5 000 lignes.
