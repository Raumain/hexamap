---
status: pending
---

# Instruction: Service d'agrégation

## Architecture projection

```txt
apps/api/src/services/
    atlas.ts                                  ✅ create
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Compter les événements `level === 'query'` d'un `createDb(url, { log })` | Compteur à zéro | cli |
| Happy path | `loadAtlasSummary(base, userId)` | Une seule instruction émise, `payload` avec deux listes | cli |
| Happy path | `loadAtlasDepartement(base, code, userId)` | Une seule instruction émise, `communes` complet | cli |
| Edge case | Code inconnu ou `path_d` nul | La fonction rend `null` | cli |
| Teardown | `afterAll` supprime les fixtures par préfixe et ferme le handle de comptage | Base au niveau d'avant la spec | cli |

## Tasks to do

### `1)` Les signatures

> Le handle Kysely est un argument, comme `loadPlayerProfile(db, …)` : c'est ce qui rend le compte d'instructions mesurable.

1. Dans `apps/api/src/services/atlas.ts`, exporter `loadAtlasSummary(database: Kysely<Database>, userId: string): Promise<AtlasSummary>` et `loadAtlasDepartement(database: Kysely<Database>, code: string, userId: string): Promise<AtlasDepartementDetail | null>`.
2. Importer les types de `@hexamap/shared` et `Database` de `@hexamap/db` en `import type` uniquement.

### `2)` Le résumé, une instruction

> CTE pour chaque agrégat, un `json_build_object` pour la charge.

1. Composer `database.selectNoFrom([sql<…>`…`.as('payload')])`, puis `executeTakeFirstOrThrow()`.
2. CTE `region_owned` : `count(distinct uc.ref_code)::int` sur `user_cards` joint à `ref_communes`, `where uc.user_id = ${userId} and uc.category = 'COMMUNE'`, `group by c.code_region`.
3. CTE `region_totals` : `count(*)::int` sur `ref_communes` groupé par `code_region`.
4. CTE `region_cards` : `select distinct ref_code from user_cards where user_id = ${userId} and category = 'REGION'` — le filtre `user_id` est **obligatoire** : sans lui, `hasRegionCard` refléterait les cartes d'autrui.
5. Répéter pour les départements (`dept_owned`, `dept_totals`, `dept_cards`), chacune filtrée par `user_id = ${userId}`.
6. `json_agg(json_build_object(…)) order by r.code` en `left join` sur les CTE, `coalesce(… , '[]'::json)` sur chaque liste, `coalesce(x, 0)` sur chaque compteur, `rc.code is not null` pour `hasRegionCard`.
7. Même forme pour les départements avec `codeRegion: d.code_region` et `hasDepartementCard`, `order by d.code`.

### `3)` Le détail, une instruction

> L'en-tête et ses communes dans le même aller-retour.

1. CTE `owned` : `select ref_code as code_insee, count(*)::int as owned_cards from user_cards where user_id = ${userId} and category = 'COMMUNE' group by ref_code`.
2. `select json_build_object('code', d.code, 'nom', d.nom, 'communesOwned', (sous-requête `count(*)::int` sur `owned` joint à `ref_communes` filtré par `d.code`), 'communesTotal', (sous-requête `count(*)::int` sur `ref_communes` filtré par `d.code`), 'communes', (json_agg ordonné par `c.nom, c.code_insee` en `left join owned`)) from ref_departements d where d.code = ${code} and d.path_d is not null`.
3. `communesOwned` compte les lignes de `owned` déjà groupées par `ref_code` : c'est le distinct ; `ownedCards` est `coalesce(o.owned_cards, 0)` ; `hasCommuneCard` est `coalesce(o.owned_cards, 0) > 0`.
4. `executeTakeFirst()` et rendre `null` quand il n'y a pas de ligne (code inconnu ou hors carte).

### `4)` Les règles de lecture

> Ce qui fait échouer le typecheck ou le critère 1 si on l'oublie.

1. `count(*)::int` partout : sans cast, `pg` rend un `int8` en chaîne.
2. `viewBox` est ajouté en TypeScript avec `ATLAS_VIEWBOX`, jamais par le SQL.
3. Aucune jointure vers `ref_odonymes` ni `commune_odonymes` ; aucune colonne `geom` ; aucun `select *` ; aucune boucle sur les entités.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `bun run typecheck` passe et les deux fonctions sont importables depuis la spec. |
| 2 | Un `createDb(url, { log })` compte exactement **1** événement `query` autour de `loadAtlasSummary`. |
| 3 | Le même compteur vaut exactement **1** autour de `loadAtlasDepartement`, et la fonction rend `null` sur un code inconnu. |
| 4 | Les cas de contenu de `atlas-api.spec.ts` passent ; les cas HTTP restent rouges parce que la route n'est pas encore montée. |
