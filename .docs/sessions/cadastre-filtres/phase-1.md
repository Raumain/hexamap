---
status: pending
---

# Instruction: Module pur d'URL + spec rouge

`apps/web/src/lib/collection-search.ts` existe, ne dépend ni du routeur ni de React, et
`packages/spec/src/collection-search.spec.ts` le prouve **avant** que la salle ne s'en serve.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
packages/spec/src/
  collection-search.spec.ts        ✅
apps/web/src/lib/
  collection-search.ts             ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | écrire la spec complète, lancer `bun test packages/spec/src/collection-search.spec.ts` | échec de résolution du module — le cas est rouge avant le code | cli |
| Happy path | `parseCollectionSearch({categorie:'RUE,COMMUNE,RUE'})` | `['COMMUNE','RUE']` — dédoublonné, trié par l'ordre du domaine, pas l'alphabétique | cli |
| Edge case | `parseCollectionSearch({rarete:'ANANAS'})`, `{departement:'2a'}`, `{commune:'X'}` | `rarete: []`, `departement: '2A'`, `commune` conservé tel quel ; aucune exception levée | cli |
| Edge case | `serializeCollectionSearch(EMPTY_COLLECTION_FILTERS)` | `{}` — jamais `q=` ni `rarete=` dans l'URL | cli |
| Edge case | `parse(serialize(x))` puis `serialize(parse(w))` | égalité stricte dans les deux sens (idempotence) | cli |
| Teardown | aucun état écrit | dépôt inchangé hors les deux fichiers | cli |

## Tasks to do

### `1)` Contrat du module

> Deux représentations, un seul pont, aucune dépendance au routeur.

1. Déclarer `CollectionFilters` (`categorie: Category[]`, `rarete: Rarity[]`, `departement: string | null`, `q: string`) et `CollectionSearchWire` (`categorie?`, `rarete?`, `departement?`, `q?`, `commune?`).
2. Exporters exigés par le brief : `parseCollectionSearch`, `serializeCollectionSearch`.
3. Exporters complémentaires : `parseCollectionWire` (= `serialize ∘ parse`, ce que reçoit `validateSearch`), `isDepartementCode`, `normalizeSearchText`, `collectionCardMatches`, `filterCollectionCards`, `EMPTY_COLLECTION_FILTERS`.

### `2)` Règles de normalisation

> Une URL est éditable à la main : l'inconnu s'écarte, rien ne lève.

1. `categorie` / `rarete` : liste séparée par virgules, `trim`, `toUpperCase`, dédoublonnage, tri par `CATEGORY` / `RARITY` de `@hexamap/shared`.
2. Accepter défensivement une valeur déjà tabulaire (`string[]`) : un paramètre répété forgé ne lève pas, il se replie sur la liste.
3. `departement` retenu seulement si `^(\d{2,3}|2[AB])$` après `toUpperCase`.
4. `q` : `trim` ; vide ⇒ omis de la forme de transport.
5. `serialize` omet toute clé vide.
6. `filterCollectionCards` : catégorie et rareté en appartenance, `departement` par `refCode` (`DEPARTEMENT` égal, `COMMUNE` préfixe), `q` en sous-chaîne insensible à la casse et aux accents sur `nom` **ou** `refCode`.

### `3)` Couverture

> La spec est le contrat exécutable, elle est écrite en premier.

1. Écrire `packages/spec/src/collection-search.spec.ts` avec `describe`/`it`/`expect` de `bun:test`, en important le module par chemin relatif (`../../../apps/web/src/lib/collection-search`).
2. Vérifier que l'import relatif typecheck : `packages/spec/tsconfig.json` n'a ni `rootDir`, ni `composite`, ni `references`, et `moduleResolution: bundler`.
3. Ne modifier aucune spec existante.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `parseCollectionSearch` et `serializeCollectionSearch` sont exportés et appelables sans routeur ni React ; le module n'importe que `@hexamap/shared`. |
| 2 | Une valeur inconnue rend une liste vide sans exception ; l'ordre de sortie suit le domaine ; aucune clé vide n'est sérialisée. |
| 3 | `bun test packages/spec/src/collection-search.spec.ts` passe, et le cas a été vu rouge avant l'écriture du module. |
