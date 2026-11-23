---
objective: "Séparer visuellement les trois niveaux de L'Atlas (région = contour, département = fond coloré, commune possédée = contour distinct) et rendre le département ouvrable depuis la carte via la même action que la table, avec un cas E2E qui compare les styles calculés."
status: pending
---

# Plan : Phase 49 — L'Atlas distingue ses niveaux

Source : `.docs/10-retours-v2.md` entrée **R-005**, et le brief de phase 49.

## Phases

| #   | Phase                        | File                                  | Depends on |
| --- | ---------------------------- | ------------------------------------- | ---------- |
| 1   | Cas E2E (rouge d'abord)      | `packages/e2e/tests/atlas.spec.ts`     | none       |
| 2   | Modèle de niveau et rendu    | `apps/web/src/routes/atlas.tsx`        | 1          |
| 3   | Légende fidèle               | `apps/web/src/content/atlas.ts`        | 2          |
| 4   | Vérification                 | `ci:check` + banc E2E                 | 1, 2, 3    |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none  | none              |

## Impact

| Category       | Verdict and evidence                                                                                                   | Handled in |
| -------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------- |
| runtime        | Le SVG reste `aria-hidden`/`role="presentation"`/non focusable ; un `onClick` par `<path>` département n'ajoute aucun état React par mouvement. | 2 |
| regression     | Les 8 cas E2E existants de `atlas.spec.ts` restent verts : compte tracé/ligne, descente, liens Cadastre, 320 px, mouvement réduit, contraste du laiton. | 4 |
| architecture   | Aucun jeton nouveau : `veil-strong`, `foil-hi`, `verdigris`, `vellum-2`, `brass` existent déjà dans `styles.css`. | 2 |
| documentation  | Le journal de session porte le sens de la couleur et sa justification ; la légende visible est mise à jour. | 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Aucune couleur littérale (§4.9) | Toute teinte vient d'un jeton `@theme` de `apps/web/src/styles.css`. |
| Aucun état React par mouvement (§4.6) | Un `onClick` est permis ; `onMouseEnter`/`onPointerMove` sont exclus. |
| SVG décoratif, table accessible (phase 35) | On ne rend pas 96 `<path>` focusables ; le département reste un bouton de table et la carte délègue à la même action. |
| Ne pas toucher `packages/spec` | Le contrat de la carte se vérifie dans le banc E2E. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Le fond des départements porte la **couverture** (0,06 → 0,45), la teinte `verdigris` le distingue de l'absence d'aplat des régions. | `fillOpacity` était déjà une couverture ; garder un seul sens évite que la carte raconte deux choses. La légende « Remplissage : part des communes couvertes » reste vraie. |
| Régions : `fill="none"`, filet `stroke-foil-hi` (1,25 px), laiton 2 px si possédée. | Le contour doit se lire sur `cabinet-sunk` sans se confondre avec le laiton de possession. |
| Communes : aplat neutre `vellum-2` à 0,06 pour toutes, contour `verdigris` 2 px si possédée. | La possession cesse d'être une densité d'aplat ; le contour vert se distingue du contour gris des régions (les deux niveaux ne sont jamais rendus ensemble, mais la règle visuelle reste unique). |
