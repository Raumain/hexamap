---
objective: "Une salle publique « Les Raretés » sur /rarete expose les six paliers avec leurs poids, les deux tables de seuils, les deux formules et les dix exemples normatifs, tous lus dans `packages/shared` et verrouillés par une spec."
status: done
---

# Plan: Phase 53 — la salle des raretés

Source: `.docs/09-idees.md` I-003, brief de la phase 53, `.docs/01-architecture.md` §2.2, §2.4, §2.7, §4.9.

## Phases

| #   | Phase | File | Depends on |
| --- | ----- | ---- | ---------- |
| 1   | exemples figés et spec | [`phase-1.md`](./phase-1.md) | none |
| 2   | la salle `/rarete` et son entrée de nav | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | banc E2E, revue et mémoire de session | [`phase-3.md`](./phase-3.md) | 2 |

## External sources

| URL   | What it settled |
| ----- | --------------- |
| none  | Aucune source externe : les valeurs sont dans `.docs/01-architecture.md` §2.2/§2.4 et dans `packages/shared` |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| runtime | Une route web nouvelle, `/rarete`, publique (hors du groupe `authPlugin` côté API : elle ne fait aucune requête). `apps/web/src/routes/mentions-legales.tsx` est le patron d'une page publique sans session. Aucune route d'API, aucune migration, aucune table. | 2 |
| regression | `apps/web/src/components/layout/nav-items.ts` est partagé par `sidebar.tsx`, `bottom-tab-bar.tsx` et `more-sheet.tsx` : ajouter un `SalonPath` et une entrée `SECONDARY_NAV_BASE` suffit à faire apparaître la salle dans la feuille mobile et le rail sans toucher ces trois fichiers. `more-sheet.tsx:50` boucle sur `SECONDARY_NAV`, `isSecondaryRoom` hérite de `SECONDARY_NAV`. Le cas `mobile.spec.ts` énumère des salles fixes (`ROOMS`) : il n'est pas modifié. | 2 |
| architecture | La rareté reste un domaine partagé (§4.9) : `RARITY`, `RARITY_LABELS`, `RARITY_WEIGHTS`, `communeRarity`, `rueRarity`, `communeScore`, `rueScore` sont importés de `@hexamap/shared`, jamais recopiés. Les exemples normatifs passent dans un module pur neuf `packages/shared/src/rarity-examples.ts`, exporté par `src/index.ts` (`export * from './rarity-examples'`, ajouté à la fin). Le sceau reste `RaritySeal`, aucune planche n'est redessinée. Le bloc « six éditions » (régions/départements) appartient à la phase 56 : il est **absent**, pas provisoire. | 1, 2 |
| documentation | `.docs/10-retours-v2.md` n'exige aucune écriture de mémoire projet pour cette phase. Seul le dossier de session est écrit : `.docs/sessions/salle-raretes/{plan,phase-1,phase-2,phase-3,review,journal}.md`. | 3 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| `AGENTS.md` règle 2 — spec-first | `packages/spec/src/rarity-examples.spec.ts` est écrit et vu rouge (`Cannot find module`) avant `packages/shared/src/rarity-examples.ts`. |
| `AGENTS.md` règle 3 — français uniquement | Tous les textes de la salle vivent dans `apps/web/src/content/rarete.ts`, en français. |
| `.docs/01-architecture.md` §4.9 — aucun composant n'écrit un libellé de rareté ni une couleur | `RARITY_LABELS` du domaine, `RaritySeal` comme seule marque de rareté, jetons de `styles.css` seulement. |
| `.docs/01-architecture.md` §4.9 — pas de `tailwind.config.ts`, jetons dans `styles.css` | Aucun jeton nouveau n'est nécessaire : la salle n'emploie que `cabinet*`, `vellum*`, `ink*`, `brass*`. |
| `AGENTS.md` règle 1 — tout dans Docker | `ci:check` et le banc E2E passent par `docker compose`. |
| Brief — fichiers partagés | `nav-items.ts` est le **seul** fichier de `components/layout/` touché ; `packages/shared/src/index.ts` reçoit son export à la fin ; `packages/spec` ne reçoit qu'un fichier neuf. |
| `.docs/01-architecture.md` §2.7 — la rareté inversée est une mécanique centrale | Un paragraphe écrit la règle avec l'exemple 1 commune → 3 000 pts, lu dans `RUE_SCORE_EXAMPLES`. |

## Decisions

| Decision | Why |
| -------- | --- |
| Les exemples vivent dans `packages/shared/src/rarity-examples.ts`, pas dans `apps/web` | La page ne peut pas mentir : la spec assert que chaque exemple égale `communeScore`/`rueScore`. Un module de `apps/web` serait invisible à `packages/spec`, qui est la source de vérité exécutable. |
| Les seuils affichés sont **lus** par `communeRarity`/`rueRarity` sur les bornes, pas écrits en dur | Le brief l'impose : aucune formule recopiée. Le libellé de borne (« 1 000 à 4 999 habitants ») est composé dans le composant à partir des bornes d'un `RARITY_BOUNDS` du module pur, lui aussi asserté par la spec — les bornes sont donc une donnée, pas une prose. |
| Une seule colonne sur mobile, deux sur desktop, en `grid` | Le brief le demande ; aucune planche n'est rendue, donc aucun budget DOM de §4.9 n'est en jeu. |
| Le titre de la salle passe par `SALON_TITLES` | Mécanisme existant de `nav-items.ts`, lu par la coquille ; aucun module `seo.ts` (phase 54). |
