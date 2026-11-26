---
status: done
---

# Instruction: les exemples normatifs figés

## Architecture projection

```txt
.
├── packages/shared/src/
│   ├── rarity-examples.ts        ✅
│   └── index.ts                  ✏  `export * from './rarity-examples'` ajouté à la fin
└── packages/spec/src/
    └── rarity-examples.spec.ts   ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | écrire `packages/spec/src/rarity-examples.spec.ts` avant le module | la spec échoue à l'import (`Cannot find module`), donc rouge | cli |
| Happy path | comparer chaque exemple de commune à `communeScore(population)` | les cinq exemples de §2.4 sont égaux, un par un | cli |
| Happy path | comparer chaque exemple de rue à `rueScore(nbCommunes)` | les cinq exemples de §2.4 sont égaux, un par un | cli |
| Edge case | les bornes de `RARITY_BOUNDS` | `communeRarity(borne)` change de palier à chaque seuil, et `rueRarity` de même | cli |
| Edge case | les tables d'exemples | population strictement croissante → score strictement croissant (commune) ; `nbCommunes` strictement décroissant → score strictement croissant (rue) | cli |
| Teardown | aucune écriture | aucune base touchée : le module est pur | cli |

## Tasks to do

### `1)` Écrire la spécification

> Un fichier neuf qui nomme chaque exemple avant que le module n'existe.

1. Créer `packages/spec/src/rarity-examples.spec.ts`.
2. Asserter `COMMUNE_SCORE_EXAMPLES` (100 → 400, 1 000 → 900, 10 000 → 1 600, 100 000 → 2 500, 1 000 000 → 3 600) et `RUE_SCORE_EXAMPLES` (10 000 → 600, 1 000 → 750, 100 → 1 000, 10 → 1 500, 1 → 3 000) contre `communeScore`/`rueScore`.
3. Asserter la parité des bornes de `RARITY_BOUNDS` avec `communeRarity`/`rueRarity`.
4. Lancer la spec seule dans Docker et constater le rouge.

### `2)` Écrire le module

> Aucune dépendance React, aucune couleur, aucune requête.

1. Créer `packages/shared/src/rarity-examples.ts` : `ScoreExample`, `COMMUNE_SCORE_EXAMPLES`, `RUE_SCORE_EXAMPLES`, `RarityBound`, `COMMUNE_RARITY_BOUNDS`, `RUE_RARITY_BOUNDS`.
2. Ajouter `export * from './rarity-examples';` **à la fin** de `packages/shared/src/index.ts`.
3. Rejouer la spec jusqu'au vert, puis `ci:check`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | La spec échoue avant le module et passe après, sans qu'aucune attente existante ne change. |
| 2 | Chaque exemple égale la formule, les bornes sont exactement celles des fonctions, et le module n'importe ni React ni rien de `apps/`. |
