---
status: pending
---

# Instruction: le tiroir de planches et la route

## Architecture projection

```txt
.
└── apps/
    └── web/
        └── src/
            ├── components/
            │   └── card-picker.tsx ✅
            ├── content/
            │   └── market.ts ✏
            └── routes/
                └── market.mine.tsx ✏
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | ouvrir `/market/mine` avec une collection chargée | le tiroir liste les cartes déverrouillées, sans `<select>` | browser |
| Happy path   | filtrer par rareté, chercher « e2e », cliquer une planche | la planche porte `aria-pressed="true"` et un filet de laiton | browser |
| Edge case    | filtre sans résultat | « Aucune carte ne correspond à ces filtres. » s'affiche, le bouton de vente reste désactivé | browser |
| Edge case    | 390 px de large | aucun débordement horizontal, le prix reste sous la liste bornée | browser |
| Teardown     | recharger la page | l'état de sélection revient à vide, aucun prix conservé | browser |

## Wireframe

```txt
┌─────────────────────────────────────────┐
│ (1) Mettre une carte en vente            │
│  (2) Recherche : nom ou code…            │
│  (3) Puces catégorie · Toutes            │
│  (4) Puces rareté · Toutes               │
│  (5) N cartes                            │
│  ┌─────────────────────────────────────┐ │
│  │ (6) planche · nom · rareté · score   │ │
│  └─────────────────────────────────────┘ │
│ (7) Prix  [            ]  Mettre en vente│
└─────────────────────────────────────────┘
```

1. La section existante garde son titre.
2. La recherche filtre en mémoire, accents et casse ignorés.
3. Quatre puces de catégorie plus « Toutes », exclusives entre elles par puce.
4. Six puces de rareté plus « Toutes ».
5. Compte des cartes retenues, annoncé en `aria-live`.
6. Ligne virtualisée : planche décorative, nom, catégorie et code, `RarityBadge`, score ; le bouton porte `aria-pressed`.
7. Prix au-dessus du clavier, collé au bouton de vente, jamais sous la liste.

## Tasks to do

### `1)` Ajouter les libellés

> Tout texte visible neuf naît dans `src/content/market.ts`.

1. Ajouter `searchLabel`, `searchPlaceholder`, `filterCategoryLabel`, `filterRarityLabel`, `allValues`, `emptyFilters`, `cardsCountLabel`.
2. Retirer `selectCard`, que la liste déroulante emporte.

### `2)` Écrire le tiroir

> Un composant contrôlé, sans requête, qui reçoit ses cartes.

1. Créer `apps/web/src/components/card-picker.tsx` : recherche, deux groupes de puces `aria-pressed`, compte en `aria-live`, liste virtualisée `@tanstack/react-virtual` (`estimateSize`, `getItemKey`, `overscan: 8`).
2. Rendre chaque ligne en planche `Card` `w-14` `aspect-[4/5]` `variant="compact"` `decorative`, plus nom, catégorie, `RarityBadge` et score.
3. Câbler l'état vide et la sélection contrôlée (`value`, `onChange`, `aria-pressed`, filet de laiton).

### `3)` Brancher la route

> La liste déroulante disparaît, la mutation et la validation de prix ne bougent pas.

1. Remplacer le bloc `<select>` de `market.mine.tsx` par `<CardPicker>`.
2. Garder `parsedPrice`, `priceValid`, `priceError`, `createMutation.mutate({ userCardId, price })` à l'identique, et `disabled={!formValid}` : sans carte choisie, le bouton reste inerte.
3. Vérifier `ci:check` dans Docker.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1... | Tous les textes visibles de la section viennent de `content/market.ts`, en français. |
| 2... | Les trois filtres agissent ensemble, l'état vide et le compte sont annoncés, le nombre de lignes rendues ne suit pas la taille de la collection. |
| 3... | Plus aucune `<select>` de carte, la planche se marque à la sélection, le corps envoyé reste `{ userCardId, price }` avec la borne 1..1 000 000. |
