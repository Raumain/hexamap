# Journal — Phase 50 · L'Atlas accueille l'outre-mer

Source : `.docs/10-retours-v2.md` entrée **R-006** (route B retenue le 2026-11-22).

## Ce qui est livré

1. **`.docs/02-database.md` d'abord** : `view_box text not null default '0 0 1000 1000'` sur
   `ref_regions`, `ref_departements` et `ref_communes`, sa sémantique (le cadre d'affichage SVG du
   **groupe**, recopié sur la région, son département et ses communes), le statut de la migration
   au §2, les trois champs Kysely au §6 et trois invariants au §7.1. Aucune autre colonne, aucune
   table.
2. **Migration `0021_view_box`** : trois `alter table … add column if not exists` en SQL brut,
   rien d'autre. Aucune donnée lue ni écrite par la migration.
3. **Backfill `scripts/import/src/atlas-overseas.ts`**, exposé par `bun run --cwd scripts/import
   start --overseas`. Le groupe est identifié **géométriquement** (une région classée
   `out_of_viewbox` contre le cadre métropolitain) : aucune liste de codes `971`/`974` à
   maintenir. Le cadre est la bbox rembourrée des points projetés du groupe ; il est recopié à
   l'identique ; `path_d` est dérivé dans ce cadre par la **projection existante**
   (`geometryToPathD`, `viewBoxOfGeometries` dans `atlas-projection.ts`).
4. **Le cadre voyage avec le tracé** : `viewBox` sur chaque région, département et commune de la
   charge utile, `viewBox` de tête du détail lu depuis `d.view_box`, et les trois schémas TypeBox
   `response` restent fermés (`additionalProperties: false`).
5. **Un encart par DROM** dans `apps/web/src/routes/atlas.tsx` : la métropole d'abord, puis une
   section « Outre-mer » avec un `<svg data-map-frame="groupe">` par cadre de groupe, titré par le
   nom de sa région. Aucune géométrie recalculée : le `path_d` est passé tel quel et l'encart ne
   choisit que son `viewBox`. Les encarts ne sont **pas** dans un `<figure>` — le cas existant
   `atlas.spec.ts` lit `figure svg` en mode strict.
6. **Spécifications** : `packages/spec/src/atlas-frames.spec.ts`, 7 cas purs sur le cadre
   (`parseViewBox`, `formatViewBox`, `viewBoxOfGeometries`, le tracé qui passe du refus au cadre de
   groupe, le déterminisme) et 3 cas d'intégration sur le backfill (groupe partagé, métropole
   intacte, second passage à zéro).
7. **Banc** : `packages/e2e/fixtures/drom-fixture.ts` (fixture idempotente : suppression des lignes
   `E2E-OM-*` puis insertion, cadre et tracés calculés par les mêmes fonctions que la production)
   et `packages/e2e/tests/atlas-outre-mer.spec.ts` (2 cas).

## Les 139 lignes traitées — première passe

```text
Cadre 01 · -3657.53 2828.64 54.56 48.24 · 34 lignes (1 départements, 32 communes) · 34 tracés écrits · 0 déjà écrits · 34 cadres mis à jour
Cadre 02 · -3619.77 2939.02 29.23 34.89 · 36 lignes (1 départements, 34 communes) · 36 tracés écrits · 0 déjà écrits · 36 cadres mis à jour
Cadre 03 · -3193.21 3538.56 203.2 246.28 · 24 lignes (1 départements, 22 communes) · 24 tracés écrits · 0 déjà écrits · 24 cadres mis à jour
Cadre 04 · 3941.63 5302.54 42.27 38.05 · 26 lignes (1 départements, 24 communes) · 26 tracés écrits · 0 déjà écrits · 26 cadres mis à jour
Cadre 06 · 3279.41 4743.51 20.29 26.56 · 19 lignes (1 départements, 17 communes) · 19 tracés écrits · 0 déjà écrits · 19 cadres mis à jour
Outre-mer : 5 groupe(s) · 139 lignes · 139 tracés écrits · 0 déjà écrits · 139 cadres mis à jour · 0 sans géométrie · 0 invalides
```

Les cinq cadres, mis bout à bout :

| DROM | `view_box` |
| --- | --- |
| 01 Guadeloupe | `-3657.53 2828.64 54.56 48.24` |
| 02 Martinique | `-3619.77 2939.02 29.23 34.89` |
| 03 Guyane | `-3193.21 3538.56 203.2 246.28` |
| 04 La Réunion | `3941.63 5302.54 42.27 38.05` |
| 06 Mayotte | `3279.41 4743.51 20.29 26.56` |

Les coordonnées sont **hors** de `0 0 1000 1000` : c'est la même projection Mercator
métropolitaine, donc un point de La Réunion tombe à `y ≈ 5302`. L'encart ne reprojette rien, il
ouvre une fenêtre sur ce repère.

## Seconde passe — la preuve d'idempotence

```text
Outre-mer : 5 groupe(s) · 139 lignes · 0 tracés écrits · 139 déjà écrits · 0 cadres mis à jour · 0 sans géométrie · 0 invalides
```

**Zéro tracé réécrit**, zéro cadre réécrit. Le compteur de la phase est donc `0`.

## La métropole est intacte

Empreintes MD5 sur le référentiel de développement, **avant** et **après** :

| Périmètre | Lignes | Avant | Après |
| --- | ---: | --- | --- |
| régions hors `01 02 03 04 06` | 21 | `fc8f68f91cd1d98a65be4595c31d4af5` | `fc8f68f91cd1d98a65be4595c31d4af5` |
| départements hors `971…976` | 104 | `d9fdeb475cd5293ecfa51bc818195af5` | `d9fdeb475cd5293ecfa51bc818195af5` |
| communes hors `971…976` | 34 788 | `b7be4d780c82699024cae19923686eac` | `b7be4d780c82699024cae19923686eac` |

Et aucune ligne métropolitaine ne porte un `view_box` autre que le défaut :

```sql
select count(*) from (… lignes hors DROM …) x where view_box <> '0 0 1000 1000';
-- 0
```

Les 139 lignes d'outre-mer :

```sql
-- regions 5 · path_d non nul 5 · cadres distincts 5
-- departements 5 · path_d non nul 5 · cadres distincts 5
-- communes 129 · path_d non nul 129 · cadres distincts 5
select count(*) from ref_communes c join ref_departements d on d.code = c.code_departement
where c.code_departement in ('971','972','973','974','976') and c.view_box <> d.view_box;
-- 0
```

## Le banc

`packages/e2e/tests/atlas-outre-mer.spec.ts` — deux cas :

1. **« atlas — chaque DROM a son encart, cadré sur son groupe »** : la carte métropolitaine porte
   `data-map-frame="metropole"` et `viewBox="0 0 1000 1000"` ; l'encart porte
   `data-map-frame="groupe"`, un `viewBox` différent du cadre métropolitain et plus petit que
   200 unités ; et chaque `<path>` de l'encart tient **entièrement** dans ce cadre, mesuré par
   `getBBox` — c'est la preuve que le `path_d` est déjà dans le bon repère.
2. **« atlas — un département d'outre-mer suit le même chemin que la métropole »** : clic sur le
   `<path>` du département dans l'encart, titre de niveau, ligne de statut (« 2 communes »), deux
   lignes de table avec le lien Cadastre, carte de détail dans **le même `viewBox`** que l'encart,
   et les deux codes INSEE de la fixture.

`packages/e2e/fixtures/drom-fixture.ts` sème ce groupe (région `E2E-OM-R1`, département
`E2E-OM-D1`, communes `E2E-OM-C1`/`E2E-OM-C2`) après le référentiel, avec le patron idempotent de
`market-fixture.ts` : suppression des lignes `E2E-OM-%`, puis insertion. Le cadre et les tracés
sont calculés par `viewBoxOfGeometries` et `geometryToPathD`, donc par le code de production.

Mesures : `ci:check` — **565 spécifications, 30 fichiers, 0 échec** ; banc E2E complet —
**116 cas, 0 échec** ; rejeu ciblé `tests/atlas` — **12 cas, 0 échec**.

## Écarts assumés

- **La projection reste globale.** Le `path_d` d'un DROM n'est pas reprojeté dans un cadre local :
  il est projeté une fois avec la projection métropolitaine, et `view_box` choisit la fenêtre. Une
  seconde projection aurait été « une seconde implémentation » de la même formule.
- **La fixture du banc ajoute un DROM**, donc le niveau national annonce désormais trois régions et
  trois départements. `NATIONAL_STATUS` d'`atlas.spec.ts` passe de 2 à 3 : le compte est porté par
  la fixture, aucune assertion n'est retirée et aucun délai n'est relâché.
- **Le backfill ne traite que cinq groupes** sur la base de développement. Les lignes de fixture
  fuitées (`9e3d8605-*`, `ee368bb0-*`, `fe52d8a6-*`, cf. BUG-001) ont `geom = null` : elles sont
  écartées par le filtre `geom is not null`, donc aucun groupe fantôme n'est créé. Ce n'est pas
  corrigé ici — hors périmètre.
- **`view_box` est recopié sur chaque ligne**, y compris les communes : le contrat du brief
  (décision 9 et 10) veut que le cadre voyage avec le tracé, donc la charge utile d'un département
  d'outre-mer porte le même cadre 129 fois. Quelques octets par ligne, aucune requête de plus.
