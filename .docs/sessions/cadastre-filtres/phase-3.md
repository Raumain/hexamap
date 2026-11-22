---
status: pending
---

# Instruction: La salle — panneau, URL, virtualiseur

L'URL est la **seule** source des filtres de `apps/web/src/routes/collection.tsx`. Le composant
n'en tient aucun.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
apps/web/src/routes/
  collection.tsx                   ✏️  validateSearch, panneau, virtualiseur
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | charger `/collection` connecté | quatre `fieldset` avec `legend`, compte annoncé, panneau ouvert en `md` | browser |
| Happy path | cocher une rareté | l'URL porte `?rarete=…`, les lignes se réduisent, `aria-live` annonce le compte, la hauteur de ligne est inchangée | browser |
| Happy path | saisir dans la recherche | l'URL porte `?q=…` en `replace` après 250 ms, aucune entrée d'historique ajoutée | browser |
| Edge case | catégorie + rareté sans intersection | l'état vide filtré s'affiche avec le bouton de réinitialisation, la collection elle-même n'est pas vide | browser |
| Edge case | `atlasSummaryQueryOptions()` en échec | le `select` département reste rendu avec la seule option neutre ; la salle ne casse pas | browser |
| Edge case | redimensionnement sous `md` | le panneau se replie, le compte annoncé reste visible hors du `details` | browser |
| Teardown | aucun état écrit | aucun `localStorage`, aucun filtre en `useState` hormis l'anti-rebond et l'ouverture du panneau | cli |

## Wireframe

```txt
┌─ LE CADASTRE ───────────────────────────────────────────────┐
│ (1) N cartes affichées sur M cartes          [aria-live]    │
├─────────────────────────────────────────────────────────────┤
│ (2) ┌ Filtres ────────────────────────────────────────────┐ │
│     │ (3) Catégorie : [Région] [Département] [Commune]    │ │
│     │ (4) Rareté    : ⬚ Commune ⬚ Peu commune ☑ Rare …    │ │
│     │ (5) Département : (Tous les départements ▾)         │ │
│     │ (6) Recherche : [nom ou code de carte          ]    │ │
│     │                         [Réinitialiser les filtres] │ │
│     └─────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ (7) lignes virtualisées, une seule barre (fenêtre)          │
└─────────────────────────────────────────────────────────────┘
```

1. Le compte, hors du `details` : le repli ne masque jamais l'information.
2. Le panneau, un `details` ouvert en `md`.
3. Catégorie : quatre bascules `aria-pressed`, chacune pousse une entrée d'historique.
4. Rareté : six cases `role="checkbox"` `aria-checked`.
5. Département : un `select` du résumé d'Atlas, replié sur l'option neutre si la requête échoue.
6. Recherche : `input type="search"`, anti-rebond 250 ms, remplace au lieu de pousser.
7. La liste : la hauteur vient du contenu de la ligne, jamais d'une classe.

## Tasks to do

### `1)` Lecture unique de l'URL

> Une seule source, un seul site d'appel.

1. `Route.validateSearch` devient `parseCollectionWire`, importé du module de la phase 1.
2. `CollectionPage` lit une fois `const search = Route.useSearch()` et transmet `search`.
3. `CollectionBody` dérive `filters = useMemo(() => parseCollectionSearch(search), [search])`.
4. Aucun autre `Route.useSearch()` dans le fichier.

### `2)` Consommation des liens entrants

> `commune` est un point d'entrée, jamais un état.

1. `useEffect` : si `search.commune` est défini, naviguer `replace: true` vers la forme de transport sans `commune`, avec `q = commune`.
2. Garde anti-boucle : la condition est la présence de `commune`, qui disparaît après la navigation.

### `3)` Panneau de filtres

> `fieldset`/`legend`, état exposé, annonce vocale.

1. Catégorie : `<button type="button" aria-pressed={…}>` par catégorie.
2. Rareté : `<button type="button" role="checkbox" aria-checked={…}>` par palier.
3. Département : `<select>` alimenté par `atlasSummaryQueryOptions()`, option neutre « Tous les départements ». **La valeur courante est injectée comme option si la liste ne la contient pas** — sans quoi un lien `?departement=29` vers un département où le joueur ne possède rien n'aurait aucun `option` à sélectionner. En échec de requête, le `select` reste rendu (option neutre + valeur courante injectée).
4. Recherche : `<input type="search">`, anti-rebond 250 ms. La valeur en cours de frappe vit dans un `useState` local : le brief l'autorise explicitement (« seuls l'anti-rebond de la saisie et l'état de focus restent locaux »). Ce n'est pas un état de filtre — le filtre appliqué est celui de l'URL, et la frappe ne l'atteint qu'après le délai.
5. Repli `<details open={isDesktop}>` sous `md` ; le compte annoncé reste **hors** du `details`. `isDesktop` existe déjà dans le fichier (`useState` initialisé par `window.matchMedia('(min-width: 768px)')` + `useEffect` sur `change`) : le réutiliser, ne pas ajouter de hook média.
6. Zone `aria-live="polite"` avec `filteredCardsLabel(visible.length, total)`.
7. Bouton « Réinitialiser les filtres ».

### `4)` Historique explicite

> Le retour défait un filtre, jamais une frappe.

1. Catégorie, rareté, département et réinitialisation : `replace: false`.
2. Recherche libre : `replace: true` après 250 ms.

### `5)` Ordre contractuel et virtualiseur

> Mesurer après les données, remettre à zéro seulement si la longueur change.

1. Une seule clé de requête : `collectionQueryOptions` inchangée, aucun filtre n'entre dans la clé.
2. `visible = useMemo(() => filterCollectionCards(items, filters), [items, filters])`.
3. `CollectionTable` ne reçoit que `items` (filtrés) et `total`.
4. Supprimer `globalFilter`, `columnFilters`, `applyColumnFilter`, `getFilterValue`, `activeCategory`, `onGlobalFilterChange`, `onColumnFiltersChange`. `sorting` reste local : ordre d'affichage, pas filtre, et il n'entre pas dans l'URL.
5. `count: rows.length`, `estimateSize` **inchangé** (`isDesktop ? 220 : 192`), `getItemKey` inchangé.
6. Remise à zéro du défilement seulement si `rows.length` diffère de la longueur précédente (`useRef`).
7. Aucun `h-*` ni `min-h-*` ajouté sur une ligne virtualisée.

### `6)` États vides distincts

> Une collection vide et un filtre trop étroit ne disent pas la même chose.

1. Collection entière vide : état vide actuel conservé.
2. Collection non vide et `visible` vide : `COLLECTION_FILTERED_EMPTY` + bouton de réinitialisation.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `Route.useSearch()` n'apparaît qu'une fois ; aucun filtre n'est lu depuis un `useState`. |
| 2 | `/collection?commune=E2E-C-RARE-0` devient `/collection?q=E2E-C-RARE-0` et la ligne correspondante est visible. |
| 3 | Les quatre groupes sont des `fieldset` avec `legend` ; catégorie expose `aria-pressed`, rareté expose `aria-checked` ; le compte est dans une zone `aria-live="polite"`. |
| 4 | `goBack()` après deux filtres revient à un filtre ; `goBack()` après une frappe quitte la salle. |
| 5 | La hauteur d'une même ligne est identique sous deux jeux de filtres ; aucun `h-*`/`min-h-*` sur une ligne. |
| 6 | Un filtre sans intersection affiche « Aucune carte ne correspond à ces filtres », pas l'état vide de collection. |
