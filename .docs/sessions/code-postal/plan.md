---
objective: "Ajouter `ref_communes.code_postal`, l'alimenter à l'import, l'exposer dans `GET /api/v1/cards` et offrir une colonne « Code postal » triable au Cadastre."
status: done
---

# Plan : Phase 55 — Trier les cartes par code postal

Source : `.docs/10-retours-v2.md` (campagne « retours v2 »), idée `.docs/09-idees.md` I-002, brief
de la phase 55.

## Ce que la phase livre

Une colonne de référentiel (`ref_communes.code_postal`), sa valeur à l'import, un champ de
réponse (`codePostal`), et une colonne triable dans Le Cadastre. Rien d'autre : ni filtre par
tranche, ni tableau des codes postaux, ni nouvelle table.

## Décisions verrouillées (brief, non négociables)

1. **Un seul code par commune** : le premier code à cinq chiffres non vide de `codesPostaux`.
   Règle pure dans `packages/shared/src/postal.ts`, verrouillée par la spec.
2. **Une migration** : `0022_postal_code`, `add column if not exists`, index simple, nullable,
   aucun défaut.
3. **`codePostal` nullable sur les quatre catégories** : valeur pour `COMMUNE`, `null` sinon.
4. **Tri local au tableau** ; défaut `acquired_at desc` inchangé ; filtre par tranche différé.
5. **« — » pour une commune sans code postal**, et pour une non-commune.

## Phases

| # | Phase | Fichiers | Dépend de |
| --- | --- | --- | --- |
| 1 | La règle pure | `packages/shared/src/postal.ts` (créé), `packages/shared/src/index.ts`, `packages/spec/src/postal.spec.ts` (créé) | none |
| 2 | Le contrat et la migration | `.docs/02-database.md` (§2, §5, §6), `packages/db/migrations/0022_postal_code.ts` (créé), `packages/db/src/migrator.ts`, `packages/db/src/schema.ts` | 1 |
| 3 | L'import | `scripts/import/src/gouv.ts`, `scripts/import/src/index.ts` (upsert + `do update set`), `scripts/import/src/e2e-seed.ts` | 1, 2 |
| 4 | La route | `apps/api/src/routes/cards.ts`, `packages/spec/src/postal.spec.ts` (cas route) | 1, 2 |
| 5 | Le Cadastre | `apps/web/src/content/collection.ts`, `apps/web/src/routes/collection.tsx`, `packages/e2e/tests/cadastre.spec.ts` | 1, 4 |
| 6 | La porte | `ci:check`, banc E2E Cadastre, captures 390 / 1280 px, journal et revue | 1–5 |

### Phase 1 — la règle pure

- `principalPostalCode(codesPostaux: unknown): string | null` : parcourt le tableau, rend le
  **premier** code qui satisfait `POSTAL_CODE_PATTERN`. Entrée non tableau ou absente → `null`.
  Aucun tri : l'ordre de l'API est conservé.
- `POSTAL_CODE_PATTERN = /^\d{5}$/`.
- Export par `packages/shared/src/index.ts` (à la fin du bloc existant).
- Spec **écrite et vue rouge** avant le module : tableau vide, entrée `undefined`/`null`/non
  tableau, entrées non numériques ou de mauvaise longueur, plusieurs codes valides (le premier
  gagne), ordre conservé.

### Phase 2 — contrat puis migration

- `.docs/02-database.md` **d'abord** : ligne `0022_postal_code` dans le tableau §2, DDL de
  `ref_communes` au §5 avec la colonne et l'index, `RefCommuneTable` au §6 avec
  `code_postal: string | null`.
- Migration `0022_postal_code` : `alter table ref_communes add column if not exists code_postal
  text` + `create index if not exists ref_communes_code_postal_idx on ref_communes (code_postal)`,
  `down` = `drop index if exists` + `drop column if exists`. Aucun `not null`, aucun défaut.
- `migrator.ts` : `import * as postalCode from '../migrations/0022_postal_code'` et la clé
  `'0022_postal_code': postalCode` **en fin de liste**.
- `schema.ts` : `code_postal: Generated<string | null>` **en fin** de `RefCommuneTable`.
- `reference-integrity.ts` : **vérifié sans modification** (`REFERENCE_SPECS` n'énumère que les
  clés naturelles) — consigné dans la revue.

### Phase 3 — l'import

- `gouv.ts` : `codesPostaux` ajouté à `COMMUNE_FIELDS`, `code_postal` ajouté à `RefCommuneRow`,
  renseigné par `principalPostalCode(entry.codesPostaux)`.
- L'écrivain `ref_communes` (`scripts/import/src/index.ts`) : `code_postal` dans l'insert **et**
  dans `on conflict … do update set code_postal = excluded.code_postal`, sinon `--merge` ne
  remplit jamais les lignes existantes. Le `TRUNCATE` d'un import complet reste inchangé.
- `e2e-seed.ts` : des codes postaux sur les communes `E2E-*`.

### Phase 4 — la route

- `cards.ts` : `codePostal: t.Union([t.String(), t.Null()])` dans `cardSchema` ; une requête
  groupée sur `ref_communes` pour les seules lignes `COMMUNE` de la page ; `null` ailleurs.
  Même forme de lookup que `nom` (`cardNomKey`), sans N+1 : une requête par page au plus.
- Cas de spec route : commune semée avec `code_postal` → `codePostal` rendu ; région → `null`.

### Phase 5 — Le Cadastre

- `content/collection.ts` : `columns.codePostal = 'Code postal'`.
- `collection.tsx` : colonne accessor `codePostal` entre le score et les exemplaires,
  `sortFn: 'text'`, cellule `codePostal ?? '—'` ; `gridTemplate` à huit pistes ;
  métadonnées mobiles (`md:hidden`) avec le code postal. Aucun `h-*`/`min-h-*` ajouté.
- `packages/e2e/tests/cadastre.spec.ts` : un cas — en-tête « Code postal » présent, clic sur
  l'en-tête réordonne les lignes (ordre lexical), une ligne non-commune affiche « — », et la
  largeur ne déborde pas.

## Vérification de chaque critère

| Critère | Preuve |
| --- | --- |
| 1 rejouabilité | `drop table kysely_migration, kysely_migration_lock`, puis deux `db:migrate`, comptage de `ref_communes` avant/après |
| 2 doc | relecture du diff de `.docs/02-database.md` |
| 3 règle pure | `bun test packages/spec` — cas `postal` |
| 4 `--merge` | `do update set` présent, vérifié à la lecture du code (pas de base de prod à réimporter) |
| 5 route | cas de spec intégration `GET /api/v1/cards` |
| 6 Cadastre | cas E2E + captures 390/1280 px, `scrollWidth === clientWidth` |
| 7 porte | `ci:check` complet, nombre de spécifications et de fichiers relevé |

## Contraintes projet qui gouvernent la phase

| Règle | Pourquoi |
| --- | --- |
| Spec d'abord, spec jamais réécrite | `packages/spec` est la source de vérité exécutable |
| Migrations immuables, rejouables | `.docs/02-database.md` §1.8 et §8 |
| Ajouts en fin de liste (`migrator.ts`, `schema.ts`, `index.ts`) | fichiers partagés par plusieurs sessions |
| Aucun `bun`/`tsc`/`vite` sur l'hôte | tout passe par Docker |
| Aucun `skip`, aucun délai relâché | règle 9 de `AGENTS.md` |
| Une planche ne reçoit pas de `h-*`/`min-h-*` | `.docs/01-architecture.md` §4.9 (BUG-008) |
