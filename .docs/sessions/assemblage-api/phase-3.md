---
status: pending
---

# Instruction: Routes, montage et preuve

## Architecture projection

```txt
apps/api/src/
    app.ts                                    ✏️ modify
    routes/
        atlas.ts                              ✅ create
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Semer un département dense de 900 communes et 2 000 cartes pour un compte | Fixtures en place, préfixe unique | api |
| Happy path | `GET /api/v1/atlas/summary` avec cookie | `200`, schéma complet, `viewBox` présent | api |
| Happy path | `GET /api/v1/atlas/departements/<code>` avec cookie | `200`, `communes` complet, `ownedCards` par commune | api |
| Edge case | `GET` sans cookie, sur les deux routes | `401 UNAUTHORIZED` | api |
| Edge case | Code inconnu, puis code du département `path_d` nul | `404 DEPARTEMENT_NOT_FOUND`, message français | api |
| Edge case | Vingt appels chronométrés avec 2 000 cartes | p95 sous 200 ms | cli |
| Teardown | `afterAll` supprime les fixtures par préfixe et ferme les handles | Base au niveau d'avant la spec | api |

## Tasks to do

### `1)` Les schémas TypeBox

> Chaque champ du contrat est déclaré, aucun objet ouvert.

1. Dans `apps/api/src/routes/atlas.ts`, déclarer `regionSchema`, `departementSchema` et `communeSchema` avec `additionalProperties: false`, `pathD: t.Union([t.String(), t.Null()])`, compteurs en `t.Integer()`, booléens en `t.Boolean()`.
2. Déclarer `summarySchema` et `departementDetailSchema`, eux aussi fermés.
3. Déclarer `errorSchema` (`code`, `message`) et la constante `unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' }`.

### `2)` Les deux handlers

> Une délégation de deux lignes au service, rien de plus.

1. `export const atlasRoutes = new Elysia({ name: 'routes.atlas' }).use(authPlugin)`.
2. `GET /atlas/summary` : `if (!user) return status(401, unauthorized)`, puis `return loadAtlasSummary(db, user.id)`.
3. `GET /atlas/departements/:code` : garde `401`, puis `const detail = await loadAtlasDepartement(db, params.code, user.id)` ; si `null`, `set.status = 404` et `{ code: 'DEPARTEMENT_NOT_FOUND', message: 'Ce département est introuvable ou hors de la carte.' }`.
4. `params: t.Object({ code: t.String({ minLength: 1 }) })`, `response` déclarant `200`, `401` et `404`. Aucun `403`, aucun `t.Any()`.

### `3)` Le montage

> Le groupe protégé existant, pas un nouveau groupe.

1. Dans `apps/api/src/app.ts`, ajouter `import { atlasRoutes } from './routes/atlas';` à la fin du bloc d'imports.
2. Ajouter `.use(atlasRoutes)` dans `buildProtectedRoutes`, à la fin de la chaîne, après `.use(shopCheckoutRoutes(provider))` et avant le `.get('/me', …)`.

### `4)` Les preuves de mesure

> Les trois critères qui ne se lisent pas dans la forme de la réponse.

1. Compter les instructions : `createDb(url, { log })`, collecter les événements `level === 'query'`, attendre **1** pour le résumé et **1** pour le détail.
2. Mesurer le temps : un `insert into user_cards … select … generate_series(1, 2000)` en une instruction, 20 appels à la route résumé, p95 asserté `<= 200` ms.
3. Mesurer la charge : département semé de 900 communes avec `path_d` de longueur réaliste (moyenne mesurée en base : 233 octets), assert du nombre de communes, `console.log` de la taille sérialisée. Le plafond asserté est un garde-fou anti-régression, **pas** les 60 Ko : ils ne sont pas tenables, le chiffre réel va au journal.

### `5)` La vérification complète

> La seule preuve acceptée.

1. Lancer `ci:check` dans le conteneur avec `TEST_DATABASE_URL=postgres://hexamap:hexamap@db:5432/hexamap_test_34`.
2. Relever le nombre de spécifications et de fichiers tel qu'affiché, sans l'arrondir ni l'anticiper.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le typecheck passe : un champ rendu par le service et absent du schéma fait échouer la compilation. |
| 2 | `401` sans session sur les deux routes ; `404 DEPARTEMENT_NOT_FOUND` sur un code inconnu et sur un département `path_d` nul ; `200` sur un département valide sans aucune carte possédée. |
| 3 | `GET /api/v1/atlas/summary` répond sous le groupe authentifié et `App` expose les deux routes à Eden. |
| 4 | Le compte d'instructions vaut 1 et 1 ; le p95 est cité et sous 200 ms ; la taille de la charge dense est citée. |
| 5 | `ci:check` vert aux quatre étapes, nombre de spécifications et de fichiers cité au journal. |
