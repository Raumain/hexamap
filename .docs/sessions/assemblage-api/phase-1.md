---
status: pending
---

# Instruction: Contrat partagé et spec rouge

## Architecture projection

```txt
packages/
  shared/src/
    atlas.ts                                  ✅ create
    index.ts                                  ✏️ modify
  spec/src/
    atlas-api.spec.ts                         ✅ create
.docs/sessions/assemblage-api/
    plan.md                                   ✏️ modify
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Semer une région, deux départements (un avec `path_d`, un avec `path_d = null`), trois communes et huit cartes pour un compte | Référentiel et cartes en place, préfixe unique par exécution | api |
| Happy path | `GET /api/v1/atlas/summary` avec cookie de session | `200`, `viewBox` = `0 0 1000 1000`, deux listes plates | api |
| Edge case | `GET` sans cookie | `401`, `code: 'UNAUTHORIZED'` | api |
| Edge case | `GET /atlas/departements/<code inconnu>` | `404`, `code: 'DEPARTEMENT_NOT_FOUND'` | api |
| Edge case | `GET /atlas/departements/<code du département sans path_d>` | `404`, `code: 'DEPARTEMENT_NOT_FOUND'` | api |
| Edge case | Trois exemplaires de la même commune | `ownedCards: 3`, `communesOwned: 1` | api |
| Teardown | `afterAll` supprime les lignes par préfixe, puis `db.destroy()` | Base au niveau d'avant la spec | api |

## Tasks to do

### `1)` Le module partagé

> Un seul fichier pour le `viewBox` et les types, importé par l'API comme par la salle.

1. Créer `packages/shared/src/atlas.ts` : `export const ATLAS_VIEWBOX = '0 0 1000 1000';` puis `AtlasSummaryRegion` (`code`, `nom`, `pathD: string | null`, `hasRegionCard`, `communesOwned`, `communesTotal`), `AtlasSummaryDepartement` (idem plus `codeRegion`, `hasDepartementCard`), `AtlasSummary` (`viewBox`, `regions`, `departements`), `AtlasCommune` (`codeInsee`, `nom`, `pathD`, `ownedCards`, `hasCommuneCard`), `AtlasDepartementDetail` (`viewBox`, `code`, `nom`, `communesOwned`, `communesTotal`, `communes`).
2. Aucune dépendance, aucun `process.env`, aucun re-export de `@hexamap/import`.
3. Ajouter `export * from './atlas';` dans `packages/shared/src/index.ts`, à sa place alphabétique (entre `./achievements` et `./charges`).

### `2)` La spec, écrite avant le code

> Neuf cas qui décrivent le contrat de la phase 35, tous rouges avant la phase 2.

1. Créer `packages/spec/src/atlas-api.spec.ts` avec le harnais du dépôt : `app.handle`, `POST /api/auth/sign-up/email` avec `origin: 'http://localhost:5174'`, cookie rejoué via `response.headers.getSetCookie()`, préfixe `crypto.randomUUID().slice(0, 8)`, `afterAll` supprimant les fixtures par préfixe.
2. Cas `401` : les deux routes sans cookie rendent `401` et `code: 'UNAUTHORIZED'`.
3. Cas `404` : code inconnu (`ZZZ-404`) et département semé avec `path_d = null` rendent `404` et `code: 'DEPARTEMENT_NOT_FOUND'`, message en français.
4. Cas `200` département sans aucune carte : `communesOwned: 0`, `communes` liste complète du département.
5. Cas exemplaires : trois cartes de la même commune donnent `ownedCards: 3` et `hasCommuneCard: true`.
6. Cas distinct : les mêmes trois exemplaires donnent `communesOwned: 1` sur le département **et** sur la région du résumé.
7. Cas `pathD` nul : la région semée sans `path_d` rend `pathD: null` (ni `undefined`, ni `''`).
8. Cas vie privée : la charge utile sérialisée ne contient ni `locked`, ni `currency`, ni `email`, ni `session`, ni `password`, et aucune catégorie `RUE`.
9. Ajouter les fixtures de référentiel au `beforeAll` : `ref_regions`, `ref_departements` (dont un `path_d = null`), `ref_communes` avec `rarete`, `score_base` et `population` valides.

### `3)` Constater le rouge

> Un rouge pour la bonne raison, pas pour une fixture cassée.

1. Lancer la spec seule et vérifier que les cas échouent parce que la route n'existe pas (`404 ROUTE_NOT_FOUND` là où `200`/`401` est attendu).

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `import { ATLAS_VIEWBOX, type AtlasSummary } from '@hexamap/shared'` résout, et `ATLAS_VIEWBOX === '0 0 1000 1000'`. |
| 2 | `bun test packages/spec/src/atlas-api.spec.ts` liste neuf cas et les voit échouer sur la route absente, aucune erreur de fixture. |
| 3 | La sortie du rouge est citée au journal, avec le code d'échec observé. |
