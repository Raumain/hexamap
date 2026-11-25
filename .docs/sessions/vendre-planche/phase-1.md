---
status: pending
---

# Instruction: le module pur de choix de carte

## Architecture projection

```txt
.
├── apps/
│   └── web/
│       └── src/
│           └── lib/
│               └── card-picker.ts ✅
└── packages/
    └── spec/
        └── src/
            └── card-picker.spec.ts ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | écrire `card-picker.spec.ts` avant `card-picker.ts` | la spec échoue à l'import, donc rouge | cli |
| Happy path   | `filterPickableCards` avec catégorie, rareté et texte | seules les cartes des trois filtres restent, ordre d'entrée stable | cli |
| Edge case    | requête sans accent, en capitales, avec espaces superflus | la carte accentuée est trouvée de la même façon | cli |
| Edge case    | filtres vides | toutes les cartes sont rendues, entrée jamais mutée | cli |
| Teardown     | aucune écriture | la base de test reste intacte | cli |

## Tasks to do

### `1)` Écrire la spécification du module

> Un fichier neuf qui nomme chaque règle avant que le code n'existe.

1. Créer `packages/spec/src/card-picker.spec.ts` avec des fixtures de carte (`COMMUNE` accentuée, `RUE`, `REGION`).
2. Verrouiller : filtre catégorie, filtre rareté, texte sur le nom, texte sur `refCode`, combinaison des trois, accents et casse ignorés, espaces compactés, entrée jamais mutée, ordre stable, libellé « Nom — Peu commune — 1 200 pts ».
3. Lancer la spec seule dans Docker et constater le rouge (`Cannot find module`).

### `2)` Écrire le module pur

> Aucune dépendance React, aucune requête, aucune couleur.

1. Créer `apps/web/src/lib/card-picker.ts` : `PickerFilters`, `PickableCardLike`, `EMPTY_PICKER_FILTERS`, `normalizePickerText`, `matchesPickerFilters`, `filterPickableCards`, `pickableCardLabel`.
2. Réutiliser `RARITY_LABELS` de `@hexamap/shared` et le formateur `Intl.NumberFormat('fr-FR')` ; ne recopier aucun libellé de rareté. `CATEGORY_LABELS` n'existe que dans `apps/web/src/content/tickets.ts` (pas dans `@hexamap/shared`) : il est consommé par le composant, pas par le module pur.
3. Rejouer la spec jusqu'au vert, puis `ci:check`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1... | La spec échoue avant le module et passe après, sans qu'aucune attente existante ne change. |
| 2... | `filterPickableCards` ne mute jamais son entrée, garde l'ordre d'entrée, et `pickableCardLabel` emploie les libellés du domaine. |
