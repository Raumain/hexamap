---
objective: "À la fin de cette phase, chaque entité métropolitaine des trois tables de référentiel porte un `path_d` SVG projeté dans le `viewBox` partagé `0 0 1000 1000`, calculé une seule fois à l'import, rejouable à l'identique, et le navigateur n'a plus jamais à projeter ni à simplifier une géométrie."
status: pending
---

# Plan: Phase 33 — L'Assemblage, la donnée

Source : brief de session « Phase 33 — L'Assemblage, la donnée » (`.docs/07-roadmap-v2.md` §4
« Phase 33 »), `.docs/01-architecture.md` §4.7, `.docs/02-database.md` §5 et §8.

## Ce que l'audit a changé au plan

L'audit jetable (`.docs/sessions/assemblage-donnees/journal.md` §1) a montré que **`geom` est
vide sur les trois tables** : 0/18 régions, 0/99 départements, 0/34 509 communes. Aucun module du
dépôt n'écrit cette colonne — `scripts/import/src/gouv.ts` pose `geom: null` en dur sur trois
sites, et `scripts/import/src/blasons.ts`, seul détenteur d'une vraie géométrie (WFS IGN
`data.geopf.fr`), la projette directement en SVG 100 × 100 pour `contour_url` sans jamais la
persister.

Conséquence : « dériver `path_d` de `geom` » exige d'abord que **quelque chose écrive `geom`**.
La phase porte donc aussi l'acquisition de la géométrie, dans le pipeline d'import, sans nouvelle
colonne ni nouvelle dépendance.

## Phases

| # | Phase | Fichiers | Dépend de |
| --- | --- | --- | --- |
| 1 | Contrat de données | `.docs/02-database.md` | none |
| 2 | Migration `0015_atlas_paths` | `packages/db/migrations/0015_atlas_paths.ts`, `packages/db/src/migrator.ts`, `packages/db/src/schema.ts` | 1 |
| 3 | Projection pure (spec d'abord, rouge) | `packages/spec/src/atlas.spec.ts` (cas purs), `scripts/import/src/atlas-projection.ts`, `packages/spec/package.json` | none |
| 4 | Étape atlas (lecture `geom`, écriture `path_d`) | `scripts/import/src/atlas.ts`, `scripts/import/src/args.ts`, `scripts/import/src/index.ts` | 2, 3 |
| 5 | Acquisition de la géométrie | `scripts/import/src/atlas-ign.ts` | 4 |
| 6 | Semis E2E porteur de géométrie | `scripts/import/src/e2e-seed.ts` | 3 |
| 7 | Cas d'intégration + idempotence | `packages/spec/src/atlas.spec.ts` (cas base) | 2, 4 |
| 8 | Mesures et rejeu national | aucun fichier (journal) | 5, 7 |

### Phase 1 — Contrat de données d'abord

Écrire dans `.docs/02-database.md`, **avant que la migration existe** :

- §2 : une ligne de statut **Contrat** pour `0015_atlas_paths` — `path_d text` sur les trois
  tables de référentiel. Elle passera à **Migrée** après `bun run db:migrate`.
- §5 : `path_d text` dans les trois DDL (`ref_regions`, `ref_departements`, `ref_communes`), avec
  la raison d'être — dérivée de `geom`, écrite à l'import, jamais lue ni calculée au runtime,
  `NULL` quand la géométrie manque ou sort du `viewBox` —, et le rappel du contrat partagé
  **projection Mercator sphérique (EPSG:3857) cadrée sur l'emprise métropolitaine, `viewBox="0 0 1000 1000"`**.
- §6 : `path_d: string | null;` dans les trois interfaces Kysely documentées.
- §7.1 : deux invariants — `path_d` ne se calcule jamais au runtime ; l'outre-mer vaut `NULL`.

Vérification : le document décrit la colonne **avant** que `0015` existe (gel du commit : la
migration est écrite en phase 2 du plan, pas avant).

### Phase 2 — Migration

`packages/db/migrations/0015_atlas_paths.ts`, sur le modèle de `0014_ref_integrity.ts` :

```sql
alter table ref_regions      add column if not exists path_d text;
alter table ref_departements add column if not exists path_d text;
alter table ref_communes     add column if not exists path_d text;
```

`down()` : `drop column if exists` sur les trois. Aucun index, aucun `CHECK` (la colonne ne se
filtre pas), aucun `NOT NULL`.

`packages/db/src/migrator.ts` : import et clé **en fin de liste**.
`packages/db/src/schema.ts` : `path_d: string | null;` en fin de chacune des trois interfaces.

### Phase 3 — Projection pure, sans base

`packages/spec/src/atlas.spec.ts` **écrit d'abord**, vu rouge, puis
`scripts/import/src/atlas-projection.ts`.

Le module est pur, sans entrée-sortie, sans dépendance. Il porte en tête, en commentaire, les deux
valeurs figées :

- projection **Mercator sphérique (EPSG:3857)** cadrée sur l'emprise métropolitaine
  (lon −5,5 → 9,9 ; lat 41,2 → 51,3), `R = 6 378 137` ;
- `viewBox` **`0 0 1000 1000`**, `y` inversé, échelle uniforme, centrage.

Exporte :

| Symbole | Rôle |
| --- | --- |
| `ATLAS_VIEWBOX` | `1000` |
| `ATLAS_EPSILON` | `{ REGION: 0.6, DEPARTEMENT: 0.35, COMMUNE: 0.2 }` |
| `ATLAS_COMMUNE_MAX_POINTS` | `700` |
| `projectLonLat(lon, lat)` | WGS84 → unités `viewBox`, deux décimales |
| `simplifyPath(points, epsilon)` | Douglas-Peucker, polyligne ouverte |
| `simplifyRing(ring, epsilon)` | anneau fermé ; **sous 3 points, garde l'original** |
| `geometryToPathD(geom, level)` | GeoJSON (`Polygon`, `MultiPolygon`, `Feature`, `GeometryCollection`) → `path_d` ou `null` |
| `pathPointCount(pathD)` | nombre de sommets, pour le plafond communal |
| `classifyGeometry(geom, level)` | `ok` \| `invalid` \| `out_of_viewbox` — le compteur du critère 6 |

Règles verrouillées par les cas de spec :

1. `métropole dans le viewBox` — Brest, Lille, Menton, Ajaccio, Perpignan projettent dans
   `[0, 1000]²`.
2. `outre-mer hors viewBox` — Réunion, Guadeloupe, Martinique, Guyane, Mayotte renvoient `null`
   et sont classées `out_of_viewbox`. La règle est **géométrique**, pas une liste de codes : un
   `viewBox` métropolitain rend l'outre-mer naturellement hors cadre.
3. `arrondi à deux décimales` — toute coordonnée du `path_d` vérifie `^-?\d+(\.\d{1,2})?$`, et
   jamais `-0`.
4. `déterminisme` — deux appels sur la même géométrie rendent la même chaîne.
5. `anneau dégénéré` — un anneau qui tombe sous 3 points conserve sa version non simplifiée.
6. `plafond communal` — un anneau de 5 000 points rend un `path_d` de ≤ 700 sommets, epsilon
   doublé jusqu'à tenir.
7. `géométrie invalide` — `null`, `{}`, `coordinates: []`, coordonnées `NaN` → `null` classé
   `invalid`, **sans lever**.

`packages/spec/package.json` gagne `"@hexamap/import": "workspace:*"` : le module pur vit dans
`scripts/import` comme l'exige le brief, et la spec doit pouvoir l'importer sans base. Dépendance
interne au monorepo, justifiée ici ; `bun install` est rejoué.

### Phase 4 — L'étape atlas

`scripts/import/src/atlas.ts`, couche d'entrée-sortie, aucune géométrie calculée hors du module
pur :

- `computeAtlasPaths(db, level, options)` : lit par lots `code` (ou `code_insee`), `geom`,
  `path_d` ; calcule ; écrit par **`update … from (values …)`** par lots de 500. Un `path_d`
  déjà non nul n'est pas recalculé (`--force` pour l'imposer).
- Compteurs rendus et journalisés en français : `scanned`, `computed`, `alreadySet`,
  `missingGeom`, `invalidGeom`, `outOfViewbox`, `written`. Les trois derniers alimentent le
  critère 6.
- `runAtlas(db, options)` : les trois niveaux, dans l'ordre régions → départements → communes.

`scripts/import/src/args.ts` gagne `--paths-only` (l'étape atlas seule, sans référentiel ni BAN)
et `--force` pour l'étape atlas ; `--help` les documente.

`scripts/import/src/index.ts` : l'étape atlas tourne **à la fin de `main()`**, après le bloc BAN,
sur le même handle `db`. `--paths-only` court-circuite le reste.

### Phase 5 — Acquisition de la géométrie

`scripts/import/src/atlas-ign.ts` : flux WFS paginé sur `https://data.geopf.fr/wfs/ows`,
`TYPENAMES` `ADMINEXPRESS-COG-CARTO.LATEST:{region,departement,commune}`, `SRSNAME=CRS:84`,
`OUTPUTFORMAT=application/json`, `COUNT`/`STARTINDEX` — la même source que
`blasons.ts:1339-1350`, jamais un appel par entité (loi §4.7 « pas d'appel externe au runtime » :
l'appel vit dans le pipeline).

Il remplit `geom` (`update … set geom = $::jsonb where code = $ and geom is null`), donc le
pipeline devient la source de vérité de `geom` qu'il prétendait déjà être. Un lot sans
correspondance en base est ignoré, un `geom` déjà écrit n'est pas réécrit.

### Phase 6 — Semis E2E

`scripts/import/src/e2e-seed.ts` : les 2 régions, 2 départements et 12 communes reçoivent une
`geom` polygonale réelle **métropolitaine** (petits quadrilatères autour de 2,0 °E / 47,0 °N), et
la spec calcule leur `path_d` avec le module pur, dans le même script. Idempotence conservée :
suppression `E2E-%` puis réinsertion.

### Phase 7 — Cas d'intégration

Dans `packages/spec/src/atlas.spec.ts`, sur le harnais maison du dépôt (`createDb(process.env.DATABASE_URL ?? '')`,
`runMigrations`, préfixe uuid sur les codes) :

1. une commune semée avec un polygone réel obtient un `path_d` non nul, dans `[0,1000]²` ;
2. `computeAtlasPaths` rejoué ne change pas la chaîne et rend `alreadySet` non nul ;
3. `geom = NULL` → `path_d` reste `NULL`, `missingGeom` incrémenté, aucune exception ;
4. `geom` invalide → `path_d` `NULL`, `invalidGeom` incrémenté, aucune exception ;
5. un polygone d'outre-mer → `path_d` `NULL`, `outOfViewbox` incrémenté ;
6. nettoyage par préfixe en `afterAll`.

### Phase 8 — Mesures et rejeu

1. `bun run db:migrate` deux fois.
2. `bun run --cwd scripts/import start --merge --skip-ban` **deux fois** (commande déclarée par
   `scripts/import/package.json` : `start` = `bun src/index.ts`, avec les drapeaux documentés).
3. Empreintes de la décision 7 par table, avant et après chaque passe.
4. Charge utile : `select sum(length(path_d))` par table et au total ; comparaison au plafond de
   250 Ko.
5. `ci:check` avec `TEST_DATABASE_URL=…hexamap_test_33`.

## Fichiers touchés

| Fichier | Nature |
| --- | --- |
| `.docs/02-database.md` | §2 statut, §5 DDL, §6 types, §7.1 invariants |
| `packages/db/migrations/0015_atlas_paths.ts` | **nouveau** |
| `packages/db/src/migrator.ts` | ajout en fin de liste |
| `packages/db/src/schema.ts` | `path_d` en fin des trois interfaces |
| `scripts/import/src/atlas-projection.ts` | **nouveau**, pur |
| `scripts/import/src/atlas-ign.ts` | **nouveau**, WFS |
| `scripts/import/src/atlas.ts` | **nouveau**, lecture/écriture |
| `scripts/import/src/args.ts` | `--paths-only`, `--force` |
| `scripts/import/src/index.ts` | branchement de l'étape |
| `scripts/import/src/e2e-seed.ts` | `geom` + `path_d` |
| `packages/spec/src/atlas.spec.ts` | **nouveau** |
| `packages/spec/package.json` | dépendance interne `@hexamap/import` |
| `.docs/sessions/assemblage-donnees/{plan,review,journal}.md` | session |

Aucun fichier de `apps/`, aucun test existant modifié, aucune autre migration.

## Impact

| Catégorie | Verdict et preuve | Traité en |
| --- | --- | --- |
| documentation | `.docs/02-database.md` décrit la colonne avant la migration ; statut exact après. `03-active-task.md` volontairement **non** modifié (journal de session à la place). | phase 1 |
| runtime | Aucune lecture de `geom` ni de `path_d` hors du pipeline : rien dans `apps/`. `packages/spec` seul lit les colonnes. | phase 4 |
| régression | Le pipeline d'import est modifié : `--merge` et `--lite` doivent rester verts, le semis E2E garde ses codes et ses compteurs (2 régions, 2 départements, 12 communes). | phases 5, 6, 8 |
| architecture | Une colonne dérivable stockée est un choix assumé : elle supprime la projection au runtime, et `geom` reste `jsonb` lourd jamais envoyé. | décision 4 |

## Rules

| Règle | Pourquoi elle s'applique |
| --- | --- |
| `.docs/02-database.md` est le seul contrat de données | Toute colonne commence ici, puis une migration |
| Tout s'exécute dans Docker | `bun`, `tsc`, `ci:check` jamais sur l'hôte |
| Spec-first | `packages/spec/src/atlas.spec.ts` rouge avant `atlas-projection.ts` |
| Serveur autoritaire / aucun appel externe au runtime | l'appel IGN vit dans `scripts/import` uniquement |
| Migrations rejouables | `add column if not exists`, `drop column if exists` |
| Numéro de migration réservé | `0015_atlas_paths`, aucun autre |
| Fichiers partagés édités en ajout | `migrator.ts`, `schema.ts` en fin de liste |

## Decisions

| Décision | Pourquoi |
| --- | --- |
| Mercator sphérique EPSG:3857, emprise métropolitaine, `viewBox 0 0 1000 1000` | Quatre lignes sans dépendance, formes conservées, une seule emprise documentée ; Lambert-93 exigerait une reprojection inverse et écraserait l'outre-mer |
| L'outre-mer vaut `path_d = NULL`, décidé **géométriquement** | Un `viewBox` qui contiendrait la Réunion et les Antilles multiplierait l'emprise par dix ; la règle géométrique évite une liste de codes à maintenir |
| Le pipeline acquiert `geom` (WFS IGN en masse) | L'audit prouve qu'aucun écrivain n'existe ; sans cela la phase coche des critères sur du vide |
| `path_d` stocké, jamais recalculé au runtime | C'est la promesse vendue par la phase : le navigateur ne projette plus |
| `@hexamap/import` dépendance de `packages/spec` | Le module pur vit dans `scripts/import` (brief) et doit être testé sans base |

## Risque principal, et son traitement

Une `geom` absente, une enclave cassée par la simplification ou un territoire hors `viewBox`
produit un trou dans la carte. Traitement : trois compteurs distincts (`missingGeom`,
`invalidGeom`, `outOfViewbox`) écrits dans le rapport, l'anneau de moins de 3 points qui garde sa
version non simplifiée, et un rejeu à empreintes identiques qui prouve l'absence de dérive.

## Contradiction signalée, non résolue en silence

Le critère 2 (« somme des `path_d` des trois tables sous 250 Ko ») est **arithmétiquement
incompatible** avec le critère 1 (« 100 % des entités métropolitaines », soit ≈ 34 500 communes).
À deux décimales de `viewBox`, un `path_d` communal pèse au mieux quelques centaines d'octets :
250 Ko laisseraient ≈ 7 octets par commune, soit moins qu'un triangle. La phase mesure les deux
nombres — le total des trois tables et le total régions + départements, qui est la charge utile
réellement chargée par la phase 35 — et rapporte le critère 2 comme **non tenu** si la mesure le
confirme, plutôt que de le cocher sur une lecture favorable.
