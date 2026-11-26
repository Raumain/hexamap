---
status: done
---

# Instruction: la salle « Les Raretés » et son entrée de navigation

## Architecture projection

```txt
.
└── apps/web/src/
    ├── content/
    │   └── rarete.ts                    ✅  tous les textes français de la salle
    ├── components/layout/
    │   └── nav-items.ts                 ✏  SalonPath, SECONDARY_NAV_BASE, SALON_TITLES
    └── routes/
        └── rarete.tsx                   ✅  la salle
```

`sidebar.tsx`, `bottom-tab-bar.tsx`, `more-sheet.tsx` et `app-shell.tsx` ne changent pas.

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | ouvrir `/rarete` sans session | un seul `<main>`, aucun renvoi vers Le Seuil | browser |
| Happy path | lire la section des paliers | six lignes, chacune sceau + libellé exact + poids, somme à 100 % | browser |
| Happy path | lire les deux tables de seuils | six lignes par table, bornes exactes de `communeRarity`/`rueRarity` | browser |
| Happy path | lire les exemples | les dix exemples normatifs, dont 100 hab. → 400 pts | browser |
| Edge case | 390 px de large | aucun débordement horizontal, une seule colonne | browser |
| Edge case | 1280 px de large | deux colonnes, aucun débordement | browser |
| Teardown | ouvrir la feuille « Autres salles » | « Les Raretés » y figure et mène à `/rarete` | browser |

## Wireframe

```txt
┌───────────────────────────────────────────────┐
│ (1) Les Raretés                               │
│     Pourquoi une commune est « Peu commune »   │
├───────────────────────────────────────────────┤
│ (2) Les six paliers                            │
│  ○ Commune       55,0 %                        │
│  ○ Peu commune   25,0 %                        │
│  ○ Rare          13,0 %                        │
│  ○ Épique         5,0 %                        │
│  ○ Légendaire     1,8 %                        │
│  ○ Mythique       0,2 %                        │
│     Total       100 %                          │
├───────────────────────────────────────────────┤
│ (3) Une commune : la population                │
│  Palier | Population                           │
├───────────────────────────────────────────────┤
│ (4) Une rue : le nombre de communes            │
│  Palier | Communes                             │
├───────────────────────────────────────────────┤
│ (5) Deux formules                              │
│  commune · rue  (écrites en clair)             │
├───────────────────────────────────────────────┤
│ (6) Les exemples                               │
│  100 hab. → 400 pts  ·  1 commune → 3 000 pts  │
├───────────────────────────────────────────────┤
│ (7) La rareté inversée des rues                │
└───────────────────────────────────────────────┘
```

1. Titre et sous-titre de la salle.
2. Paliers : `RaritySeal` + `RARITY_LABELS` + poids de `RARITY_WEIGHTS`, formatés `fr-FR`.
3. Seuils de commune, lus sur `COMMUNE_RARITY_BOUNDS` et confirmés par `communeRarity`.
4. Seuils de rue, lus sur `RUE_RARITY_BOUNDS` et confirmés par `rueRarity`.
5. Les deux formules en clair, jamais réimplémentées.
6. Les dix exemples de `COMMUNE_SCORE_EXAMPLES` / `RUE_SCORE_EXAMPLES`.
7. Le paragraphe de §2.7 avec l'exemple 1 commune → 3 000 pts.

## Tasks to do

### `1)` Les libellés

> Tout texte visible neuf naît dans `content/rarete.ts`.

1. Créer `apps/web/src/content/rarete.ts` : `RARETE`, titres et sous-titres de section, en-têtes de colonnes, légendes des deux formules, paragraphe de la rareté inversée, et les deux formateurs `weightLabel` (`55,0 %`), `pointsLabel` (`1 600 pts`).
2. Aucun libellé de rareté : ils viennent de `RARITY_LABELS`.

### `2)` La salle

> Un composant de page sans état, sans requête, sans session.

1. Créer `apps/web/src/routes/rarete.tsx` : `createFileRoute('/rarete')`, un seul `<main>` rendu par la coquille.
2. Rendre les sept sections du wireframe en CSS grid `grid-cols-1 md:grid-cols-2`, jetons de `styles.css` uniquement.
3. Paliers : `RARITY.map(...)` avec `RaritySeal` et `RARITY_WEIGHTS`. Le total est la somme calculée des poids affichés.
4. Tables de seuils : `COMMUNE_RARITY_BOUNDS` / `RUE_RARITY_BOUNDS`.
5. Exemples : `COMMUNE_SCORE_EXAMPLES` / `RUE_SCORE_EXAMPLES`, formatés `fr-FR`.
6. Paragraphe de la rareté inversée, chiffre lu dans `RUE_SCORE_EXAMPLES`.
7. Aucune section « six éditions » : la phase 56 l'ajoutera.

### `3)` L'entrée de navigation

> Un seul fichier de `components/layout/` change.

1. `SalonPath` : ajouter `| '/rarete'`.
2. `SECONDARY_NAV_BASE` : entrée `{ to: '/rarete', label: 'Les Raretés', short: 'Raretés', glyph }`, ajoutée à la fin de la liste.
3. `SALON_TITLES` : `'/rarete': 'Les Raretés'`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Aucun texte français de la salle n'est écrit dans un composant. |
| 2 | Six paliers avec libellé exact et poids, deux tables de seuils, dix exemples, un paragraphe sur la rareté inversée, aucune couleur littérale, aucune donnée de joueur. |
| 3 | « Les Raretés » apparaît dans la feuille « Autres salles » et ouvre `/rarete` sans session. |
