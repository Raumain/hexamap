---
status: pending
---

# Instruction: Libellés français

Aucun texte du panneau de filtres n'est écrit dans le JSX : tout vient de
`apps/web/src/content/collection.ts`.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
apps/web/src/content/
  collection.ts                    ✏️  bloc COLLECTION_FILTERS, COLLECTION_FILTERED_EMPTY, filteredCardsLabel
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | lire `content/collection.ts` (déjà lu : bloc `COLLECTION`, `cardsShownLabel`, `collectionTotalLabel`) et `content/tickets.ts` (`CATEGORY_LABELS`, réexport de `RARITY_LABELS`) | les libellés de catégorie et de rareté existent déjà et ne sont pas redéfinis | cli |
| Happy path | importer `COLLECTION_FILTERS`, `COLLECTION_FILTERED_EMPTY`, `filteredCardsLabel` depuis le fichier | les trois symboles se résolvent et `tsc` les accepte | cli |
| Edge case | `filteredCardsLabel(0, 42)` | rend une phrase française qui distingue le compte affiché du total, sur le modèle de `cardsShownLabel` | cli |
| Teardown | aucun état écrit | aucun autre fichier de `content/` modifié | cli |

Le rendu du panneau, lui, se vérifie en phase 3 : cette phase-ci ne crée que du texte.

Bloc existant à compléter, tel quel :

```ts
export const COLLECTION = {
  eyebrow, title: 'Ma collection', subtitle, loading, retry, emptyTitle,
  searchLabel, searchPlaceholder, rarityLabel, categoryLabel,
  allValues: 'Toutes', scrollAriaLabel, locked,
  columns: { nom: 'Carte', category: 'Catégorie', rarity: 'Rareté', score: 'Score', acquiredAt: 'Acquise le', state: 'État' },
} as const;

export function cardsShownLabel(shown: number, total: number): string;
export function collectionTotalLabel(total: number): string;
```

## Wireframe

```txt
┌─ Le Cadastre ───────────────────────────────────────────────┐
│ (1) N cartes affichées sur M cartes        [aria-live]      │
├─────────────────────────────────────────────────────────────┤
│ (2) ▸ Filtres                         [Réinitialiser]       │
│     (3) Catégorie : [Région] [Département] [Commune] [Rue]  │
│     (4) Rareté    : ⬚ Commune ⬚ Peu commune ☑ Rare ⬚ Épique │
│     (5) Département : (Tous les départements ▾)             │
│     (6) Recherche : [nom ou code de carte             ]     │
├─────────────────────────────────────────────────────────────┤
│ (7) table virtualisée, une seule barre de défilement        │
└─────────────────────────────────────────────────────────────┘
```

1. Compte annoncé : la seule information que le repli ne doit jamais masquer.
2. Panneau : un `details`, ouvert en `md`, repliable sous `md`.
3. Catégorie : quatre bascules `aria-pressed`.
4. Rareté : six cases `role="checkbox"` `aria-checked`.
5. Département : un `select` alimenté par le résumé d'Atlas.
6. Recherche : la saisie libre, anti-rebondie, en `replace`.
7. La liste : une ligne reçoit sa hauteur de son contenu, rien de plus.

## Tasks to do

### `1)` Bloc de libellés

> Un seul propriétaire du texte.

1. Ajouter `COLLECTION_FILTERS` : `summary`, `categorie`, `rarete`, `departement`, `recherche`, `departementAll`, `recherchePlaceholder`, `reset`.
2. Ajouter `COLLECTION_FILTERED_EMPTY` : `title`, `description`.
3. Ajouter `filteredCardsLabel(shown, total)`, dans l'esprit de `cardsShownLabel` déjà présent.
4. Ajouter à la fin du fichier, sans réordonner l'existant.

### `2)` Réemploi, pas duplication

> La rareté et la catégorie appartiennent au domaine.

1. Réutiliser `CATEGORY_LABELS` (`content/tickets.ts`) et `RARITY_LABELS` (`@hexamap/shared`, réexporté par `content/tickets.ts`).
2. N'introduire aucun dictionnaire concurrent.
3. N'introduire aucun texte visible sous 10 px.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | Les trois symboles sont exportés et `bun run --cwd apps/web typecheck` les résout ; `filteredCardsLabel(0, 42)` rend une phrase française non vide. |
| 2 | Aucun nouveau dictionnaire de catégorie ni de rareté n'existe dans le dépôt après la phase (contrôle statique : un seul `CATEGORY_LABELS`, un seul `RARITY_LABELS`, tous deux réutilisés). |

La vérification que le panneau n'écrit aucun littéral français appartient à la phase 3 : c'est elle
qui crée le `JSX`, et une phase ne peut pas vérifier un fichier qu'elle ne produit pas.
