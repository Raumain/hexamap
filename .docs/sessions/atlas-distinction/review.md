# Revue — Phase 49 · L'Atlas distingue ses niveaux

Passe de relecture hostile sur le diff (`apps/web/src/routes/atlas.tsx`,
`apps/web/src/content/atlas.ts`, `packages/e2e/tests/atlas.spec.ts`).

## Verdict : prêt à livrer

Aucun défaut de gravité *deal-breaker*. Les critères 1 à 9 sont tenus ; les deux réserves
ci-dessous sont des suggestions, pas des blocages.

## Critères

| # | Critère | Preuve |
| - | --- | --- |
| 1 | Région = contour, département = fond coloré | `fill-none` / `fill-verdigris` ; cas E2E « une région et un département n’ont pas le même style » lit `getComputedStyle(...).fill` (`none` contre `rgb(...)`). |
| 2 | Clic carte = ligne de table | même `setOpenDepartement` passé à `AtlasMap` et à `NationalTable` ; cas E2E « le clic d’un département fait ce que fait sa ligne de table » compare statut et codes rendus. |
| 3 | Communes possédées = contour | `stroke-verdigris` 2 px, aplat neutre constant (`0.06`) pour toutes les communes. |
| 4 | Sens de la couleur écrit | journal + corps de PR : le fond des départements porte la **couverture**. |
| 5 | Aucune couleur littérale | `fill-none`, `fill-verdigris`, `fill-vellum-2`, `stroke-foil-hi`, `stroke-verdigris`, `stroke-brass`, `stroke-veil-strong` : tous des jetons `@theme`. |
| 6 | SVG `aria-hidden` / non focusable / aucun mouvement | attributs inchangés l. 285-291 ; seul `onClick` ajouté ; `hover:stroke-brass` est du CSS pur. |
| 7 | Cas E2E de distinction vert, sur styles calculés | 20/20 avec `--repeat-each=2` sur `atlas.spec.ts`. |
| 8 | Huit cas existants verts | `atlas.spec.ts` : 8 cas d’origine passent, y compris mouvement réduit et contraste du laiton. |
| 9 | `ci:check` + banc E2E verts | 555 spécifications / 29 fichiers ; 114 cas E2E. |

## Suggestions (non bloquantes)

1. `coverage` est calculée pour les régions mais n’est jamais rendue (seul le département porte
   l’aplat). Le champ reste homogène au modèle `MapEntity` ; le retirer pour la région
   demanderait un type discriminé, pour un gain nul.
2. Le cas E2E de clic vise un `<path>` de ~2,6 px dans le `viewBox` du banc. Le clic au centre
   du quadrilatère est déterministe (formes rectangulaires, départements rendus au-dessus des
   régions) ; il a été rejoué 2× sans échec. Si le banc semait un jour des tracés concaves, il
   faudrait viser une position explicite.

## Ce qui n’a pas été fait, volontairement

- Aucun jeton `@theme` ajouté (les cinq teintes existaient).
- Aucun cas de `packages/spec` touché : le contrat de la carte est un contrat de navigateur.
- Aucun `onMouseEnter` / `onPointerMove`, aucun état React par case.
- Le SVG reste non focusable : la table est le seul chemin clavier.
