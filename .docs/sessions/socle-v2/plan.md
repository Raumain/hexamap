# Plan — Phase 32, « Le Socle de la v2 »

Branche `feat/v2-32-socle` · migration `0014_ref_integrity` · base de test
`hexamap_test_32` · PR brouillon vers `v2`.

## État mesuré avant d'écrire (2026-11-22)

| Mesure | Valeur constatée |
| :--- | :--- |
| Chunk principal | `dist/assets/index-CvGIS3vT.js` — **478,09 Ko bruts / 145,61 Ko gzip** |
| `autoCodeSplitting` | **déjà `true`** depuis `eb18205` (`apps/web/vite.config.ts:9`) ; les routes sont donc déjà découpées (`market.index`, `tableaux`, `friends`, `collection`… sont des chunks distincts) |
| 404 | aucun `defaultNotFoundComponent` ni `notFoundComponent` dans `apps/web` ; 5 `throw notFound()` retombent sur la page **anglaise** de TanStack |
| `skips` E2E | **aucun** : le seul `test.skip` est un commentaire (`mobile.spec.ts:599`) qui documente sa suppression |
| Cas double-appui | **déjà présent** et **déjà débloqué** par `market-fixture.ts` (`mobile.spec.ts:580`) |
| `origin/v2` | existe (`git ls-remote` → code 0, `fe757014`) |

**Conséquence sur le lot 1.** Le découpage par route est fait ; le gain restant est
le **découpage du vendor** que le chunk d'entrée absorbe. C'est là que se joue la
mesure avant/après.

## Le point dur : le contrat de données contre la suite gelée

La migration demandée par le brief — FK `(category, ref_code)` par table et
`CHECK` sur `ref_regions.code` — **casse la suite de spécifications gelée**. Ce
n'est pas une hypothèse, c'est mesuré :

| Fixture existante | Ce qu'elle fait | Ce qu'une FK/CHECK lui ferait |
| :--- | :--- | :--- |
| `achievements.spec.ts:295-306` | insère une carte `COMMUNE` avec `ref_code = '<prefix>-<uuid8>'`, **sans aucun référentiel semé** | rejet 23503 à l'insertion |
| `cards.spec.ts:97`, `charges.spec.ts:128`, `market.spec.ts:78`, `tableaux.spec.ts:134,184`, `tickets.spec.ts:219,997` | sèment des `ref_regions` aux codes `<prefix>-R1` / `E2E-R1` | rejet 23514 par le `CHECK` |
| `scripts/import/src/e2e-seed.ts:22-24` | référentiel du banc aux codes `E2E-R1`, `E2E-R2` | rejet 23514 → **banc entier rouge** |
| `tickets.spec.ts:345-363` (et `afterAll` équivalents) | supprime les `ref_*` **avant** `"user"`, donc pendant que des cartes les citent | rejet 23503 → **`afterAll` en échec** |

Réécrire ces fixtures est interdit par le brief (« ne modifie pas `packages/spec` »)
et par `AGENTS.md`. Une FK ou un `CHECK` de table est donc **inatteignable** dans
le périmètre de cette phase. Le plan retient la voie qui protège réellement la
collection sans toucher un seul cas de spécification :

1. **`TRUNCATE` gardé** sur les quatre tables de référentiel : l'import ne peut
   plus vider une table pendant qu'une carte la cite (`0014`). Les specs ne font
   jamais de `TRUNCATE` — seul l'import le fait —, donc rien ne casse.
2. **Import en mode `--merge`** : upsert + élagage des seules lignes **non
   citées**, au lieu de `TRUNCATE … CASCADE`. C'est la « procédure de réimport qui
   ne supprime jamais une ligne référencée » exigée par le brief.
3. **`orphan_user_cards()`** : une fonction SQL qui **rend visibles** les cartes
   orphelines, là où `routes/cards.ts:114` les affichait sans nom.
4. **BUG-003** à la frontière que le bug lui-même propose : validation explicite
   dans `scripts/import` (`REFERENCE_CODE_INVALID`), verrouillée par une spec.

Les critères 3 et 4 sont donc rendus **au niveau de l'import et de la garde
destructrice**, pas par une contrainte de table ; le rapport final le dit.

## Lot 1 — Découpage du bundle (`apps/web/vite.config.ts`)

- `build.rollupOptions.output.manualChunks` : trois familles — `react`
  (`react`, `react-dom`, `scheduler`), `tanstack` (`@tanstack/*`), `eden`
  (`@elysia/eden`, `better-auth`). Les routes restent découpées par
  `autoCodeSplitting`.
- Aucun chunk > **500 Ko bruts** ; le chunk d'entrée doit chuter nettement sous
  478,09 Ko.
- Vérification : `bun run --cwd apps/web build` dans Docker, relevé de chaque
  chunk, comparaison chiffrée.

## Lot 2 — 404 français

- `apps/web/src/content/not-found.ts` : libellés centralisés, vocabulaire du
  cabinet (« Cette salle n'existe pas », lien « Revenir au Seuil »).
- `apps/web/src/components/ui/not-found.tsx` : composant monté par le routeur,
  `role="main"` implicite, lien `Link to="/"` (Le Seuil), aucun état.
- `apps/web/src/main.tsx` : `createRouter({ …, defaultNotFoundComponent })`.
  Un seul point de montage : l'URL inconnue **et** les cinq `throw notFound()`
  passent par lui.
- Vérification : banc (`/inconnu` et `/boutique`, boutique éteinte → `notFound()`).

## Lot 3 — Migration `0014_ref_integrity` + procédure d'import

Fichiers : `packages/db/migrations/0014_ref_integrity.ts`,
`packages/db/src/migrator.ts` (ajout en fin de liste),
`packages/db/src/schema.ts` (rien à ajouter : aucune colonne nouvelle),
`packages/db/src/reference-integrity.ts` (nouveau, testable par la spec),
`scripts/import/src/db.ts`, `scripts/import/src/index.ts`,
`scripts/import/src/args.ts` (`--merge`), `packages/spec/src/ref-integrity.spec.ts`.

Contenu de `0014` :
- `ref_truncate_guard()` + un trigger `BEFORE TRUNCATE FOR EACH STATEMENT` par
  table (`ref_regions`, `ref_departements`, `ref_communes`, `ref_odonymes`) ;
  lève `23503` en nommant la table et le nombre de cartes.
- `orphan_user_cards()` : renvoie `(id, user_id, category, ref_code)` des cartes
  dont le `ref_code` n'existe pas dans la table de sa catégorie.
- Idempotent : `create or replace function`, `drop trigger if exists` avant
  `create trigger`.
- `down()` : `drop trigger if exists` × 4, `drop function if exists` × 2.

Spec (rouge avant migration, verte après) :
- une carte citant une commune puis `TRUNCATE ref_communes` → rejet `23503` ;
- `orphan_user_cards()` rend la carte fabriquée hors référentiel ;
- `pruneUnreferencedRows()` conserve la ligne citée et supprime l'autre ;
- le validateur de code de région refuse `'99'` et `'E2E-R1'`, accepte `'53'`.

## Lot 4 — Second compte E2E

- `packages/e2e/fixtures/second-account.ts` : inscription **par l'API réelle**
  (`/api/auth/sign-up/email`, puis `sign-in` si déjà inscrit) — donc une **vraie
  session**, pas un cookie forgé ; carte propre insérée en SQL (idempotent :
  `delete … where user_id`, puis `insert`) ; écrit
  `.auth/second.json` (storageState) et `.auth/second-account.json`.
- `packages/e2e/global-setup.ts` : appel **après** l'inscription du premier
  compte, la carte étant prise dans le référentiel E2E déjà semé.
- `packages/e2e/tests/session.spec.ts` : un cas qui ouvre une page avec le
  storageState du second compte et prouve que la session est réellement
  authentifiée et voit sa carte.
- Le cas « double-appui n'achète qu'une fois » **existe déjà** ; il reste vert,
  ce que le plan vérifie sans y toucher.

## Lot 5 — Mémoire

`.docs/04-bugs.md` (BUG-002 et BUG-003 → Corrigé avec preuve ; BUG-001 reste
ouvert avec la procédure d'opérateur), `.docs/02-database.md` §2 et §4,
`.docs/sessions/socle-v2/{plan,review,journal}.md`.

## Ordre et vérification

1. Lots 1 à 4 en parallèle sur des fichiers disjoints.
2. `ci:check` sur `hexamap_test_32` → lint, typecheck, ping, spécifications.
3. Banc E2E complet (`docker-compose.e2e.yml`).
4. `05-review` sur le diff complet, puis commits atomiques et PR brouillon → `v2`.

## Critères, et où ils se vérifient

| # | Critère | Preuve |
| :--- | :--- | :--- |
| 1 | Aucun chunk > 500 Ko, avant/après cité | `bun run --cwd apps/web build` |
| 2 | 404 français, URL inconnue **et** `notFound()` | banc E2E |
| 3 | Intégrité de `ref_code`, réimport non destructeur | `ref-integrity.spec.ts` |
| 4 | Code de région non français refusé | `ref-integrity.spec.ts` (frontière d'import) |
| 5 | Second compte idempotent, rejouable 2× | `global-setup` rejoué |
| 6 | Banc vert, second compte compris, aucun `skip` | `playwright test` |
| 7 | BUG-002/003 corrigés, BUG-001 ouvert + procédure | `.docs/04-bugs.md`, journal |
| 8 | `ci:check` vert | sortie chiffrée |
