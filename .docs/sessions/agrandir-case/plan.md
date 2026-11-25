---
objective: "Une case révélée du ticket s'ouvre au clic et au clavier dans un dialogue rendu hors de `<main>`, montrant la planche détaillée ou le texte du panneau, sans aucune requête, Échap ferme et le focus revient à la case."
status: done
---

# Plan: Agrandir une case grattée (phase 52, I-004)

Source: `.docs/09-idees.md` I-004 (lignes 76–96), brief de phase 52.

## Phases

| #   | Phase            | File                         | Depends on |
| --- | ---------------- | ---------------------------- | ---------- |
| 1   | agrandir-case    | [`phase-1.md`](./phase-1.md) | none       |

## External sources

| URL | What it settled |
| --- | --------------- |
| none | `none` |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| runtime | none. La modale ne lit que `TicketCell`, déjà rendu par `maskedCellSchema` (`apps/api/src/routes/tickets.ts:59-69`), qui porte `nom`, `distance`, `kind`, et `card.{category,refCode,rarity,score,nom,blasonUrl,blasonCredit}`. Aucun champ ajouté, aucune route, aucune requête : observation directe du schéma. | none |
| regression | medium. `packages/e2e/tests/mobile.spec.ts:428` localise la planche par `plate.locator('xpath=../..')` et attend la case comme **grand-mère** de la planche ; `mobile.spec.ts:392` compte les `article` de la grille ; `core-loop.spec.ts:75` fait de même. Le tableau DOM de la case ne doit donc pas gagner un niveau entre la case et la planche. Filet : ces trois cas existent et restent verts. | phase 1 |
| architecture | La case révélée devient une cible d'ouverture ; le dialogue appartient à `document.body` par `OverlayPortal` (§4.9, BUG-007) et l'état React reste une transition grossière, hors du champ de §4.6 qui ne vise que le Canvas. Aucun changement de la coquille ni du canvas de grattage. | phase 1 |
| documentation | `.docs/01-architecture.md` §4.9 est le seul document qui décrit la lecture d'une case ; le brief de campagne n'autorise une écriture de mémoire que si `.docs/10-retours-v2.md` l'exige, et I-004 ne l'exige pas. **Aucune modification de mémoire projet.** Le dossier de session porte le journal. | none |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `.docs/01-architecture.md` §4.6 — pas d'état React pour piloter le Canvas | Le canvas et ses pointeurs ne sont pas touchés ; l'état de la modale est une transition grossière explicitement autorisée par le brief, décision 6. |
| `.docs/01-architecture.md` §4.9 — overlay hors de `<main>` (BUG-007) | La modale passe par `OverlayPortal`, et `getComputedStyle(main).transform` doit rester `none`. |
| `.docs/01-architecture.md` §4.9 — BUG-008, aucune hauteur déclarée sur une ligne de liste | La case garde son `aspect-[3/5]` et n'ajoute ni `h-*` ni `min-h-*` ; le bandeau reste `h-4`. |
| `AGENTS.md` règle 4 — aucune table inventée | Aucune migration, aucun champ, aucun index : la phase ne touche pas `packages/db`. |
| `AGENTS.md` règle 2 — spec-first | Le cas E2E est écrit et vu rouge avant que la modale n'existe. |
| `apps/web/AGENTS.md` — libellés centralisés dans `src/content/` | Les textes de la modale et le détail des panneaux vont dans `content/tickets.ts`. |
| Brief phase 52 — seul le serveur juge la révélation | Aucun gestionnaire de clic sur `ScratchCell`, `LockedCell`, ni sur l'ancêtre de la grille. |

## Decisions

| Decision | Why |
| --------- | --- |
| La cible cliquable est un `<button type="button">` superposé (`absolute inset-0`) à l'intérieur de la case, et non un remplacement de la racine `<div>` | Un `<button>` ne peut contenir que du contenu phrasé : la planche `Card` rend un `<article>`, et l'imbriquer dans un bouton serait invalide et confondrait le nom accessible. Le bouton superposé garde le DOM de la case intact, donc `plate.locator('xpath=../..')` et les `article` de `mobile.spec.ts` restent vrais, et la géométrie ne bouge pas. |
| Le détail d'un panneau est un champ `detail` **ajouté** à `PANEL_CONTENT`, pas une réécriture de `description` | `description` est déjà rendu en `line-clamp-3` dans la case ; le réécrire changerait la case elle-même. `detail` porte le texte complet de §2.6 (le Belvédère y gagne la carte Commune, que la case omet). |
| Échap, focus initial et restitution du focus vivent dans le composant de modale, pas dans la route | Le composant est monté exactement quand le dialogue est ouvert : le nettoyage de l'effet est le point de restitution, sans second `useState` dans la route. `onClose` doit être stable (`useCallback`) pour que l'effet ne se rejoue pas. |
| Le cas E2E vit dans `core-loop.spec.ts`, en `test.step` après « grattage complet » | Ce fichier est `serial`, possède déjà la session et le bordereau soldé avec ses 16 cases révélées : aucune fixture, aucun second compte, et la preuve « la planche reste à l'écran » du cas existant n'est pas dupliquée. |
