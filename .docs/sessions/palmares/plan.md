---
objective: "Le Palmarès est livré : `tableaux.score` est figé à la soumission, rétro-rempli par `0019_tableau_score`, la colonne finit `not null` ; `GET /api/v1/palmares` rend le classement de la semaine ISO (lundi–dimanche UTC) départagé par score desc, `created_at` asc, `id` asc, sans aucun recalcul ; la salle `/palmares` affiche rang, pseudo, score et cartels ; specs et E2E vertes, `ci:check` vert."
status: complete
---

# Plan — Phase 42, Le Palmarès

Source : brief de session « Phase 42 — Le Palmarès », `.docs/07-roadmap-v2.md` §4 (phase 42),
`.docs/01-architecture.md` §2.5, `.docs/02-database.md` §4.2/§4.4/§6/§7.1.

## Décisions tranchées (écrites au journal, non rediscutées)

| Sujet | Décision | Raison |
| :--- | :--- | :--- |
| Stockage | **Une colonne** `tableaux.score integer`, aucune table d'instantanés | Une seconde table serait une seconde vérité à réconcilier pour un besoin qui tient dans une colonne. `tableau_scores` est écartée. |
| Écriture | À la soumission (`POST /api/v1/tableaux`), une seule fois, `evaluateTableau` de `@hexamap/shared` dans la transaction existante | Aucune formule dupliquée dans `apps/`. |
| Recalcul | **Jamais.** Ni le classement, ni une route future de modification | La colonne est la vérité du classement. `GET /tableaux` (liste du joueur) garde sa recomposition à la lecture — voir « Écart assumé ». |
| Rétro-remplissage | **SQL dans la migration**, une seule fois | `packages/db` **ne dépend pas** de `@hexamap/shared` et aucune migration n'importe un paquet du monorepo (vérifié : `No matches found`). La formule est donc recopiée en SQL dans la migration uniquement, et ce choix est journalisé. |
| `not null` + défaut | `add column` **sans** défaut → rétro-remplissage → `set not null` → `set default 0` | L'ordre est ce qui rend le rétro-remplissage utile : un défaut posé avant remplirait les lignes existantes de zéros, et `where score is null` n'aurait plus rien à corriger. Le défaut `0` existe pour les **six** sites d'insertion directe hors phase (specs `tableaux`, `profile`, `atelier`, `account` ×2, fixture `vitrine`) qui ne fournissent pas de score : sans lui, `not null` les casse au runtime, et ces fichiers ne sont pas à moi. |
| Semaine | **ISO 8601**, lundi 00:00:00.000 UTC → lundi suivant exclu, sur `tableaux.created_at`, étiquette `IYYY-Www` | Règle écrite dans `.docs/01-architecture.md` §2.5 **et** pure dans `packages/shared/src/palmares.ts`. Une semaine inexistante (`2027-W53`) répond `400 PALMARES_INVALID_WEEK` au lieu de déborder sur la semaine 1 de l'année suivante. |
| Départage | Score **décroissant**, puis `created_at` **croissant**, puis `id` **croissant**, en SQL, en un seul `ORDER BY` | Une seule implémentation, côté serveur. Le rang est la position (1..N) : le départage étant total, il n'y a plus d'ex æquo à partager. |
| Rang | Calculé par le serveur (`index + 1`) | Le navigateur affiche, il ne trie pas. |
| Salle | `/palmares`, salle secondaire (feuille mobile, rail desktop) | Aucune des quatre salles principales n'est un classement, et la barre basse est figée à quatre cibles + `Plus` (§9.2). |

## Écart assumé (écrit, non corrigé)

`GET /api/v1/tableaux` (la liste du joueur) continue de recalculer `total` à la lecture. Le
Palmarès, lui, ne lit que la colonne figée. Unifier aurait changé les attentes d'un cas **gelé**
de `packages/spec/src/tableaux.spec.ts` (un tableau partiel inséré directement y est listé sans
score ; la colonne vaut alors `0`), et cette phase n'a pas le droit de réécrire une spec. En
pratique `user_cards.score` ne change jamais après acquisition : la divergence reste théorique.
Conséquence écrite : `.docs/01-architecture.md` §2.5 nomme les deux lectures.

## Contrat de données (recopié dans `.docs/02-database.md` §4.4)

```sql
-- 0019_tableau_score, rejouable
alter table tableaux add column if not exists score integer;
-- rétro-remplissage (score is null), puis :
alter table tableaux alter column score set not null;
alter table tableaux alter column score set default 0;
```

`score` est écrit **à la soumission** et **jamais recalculé**. `0` est réservé aux insertions
directes de test : aucun chemin de production ne l'écrit.

## Phases

| # | Phase | Fichiers | Depends on |
| --- | --- | --- | --- |
| 1 | Contrat de données | `.docs/02-database.md` (§2, §4.4, §6, §7.1), `.docs/01-architecture.md` (§2.5) | none |
| 2 | Règle partagée de la semaine | `packages/shared/src/palmares.ts`, `packages/shared/src/index.ts` | 1 |
| 3 | Spécifications (vues rouges) | `packages/spec/src/palmares.spec.ts` | 2 |
| 4 | Migration + schéma | `packages/db/migrations/0019_tableau_score.ts`, `packages/db/src/migrator.ts`, `packages/db/src/schema.ts` | 3 |
| 5 | Soumission qui fige | `apps/api/src/routes/tableaux.ts` | 4 |
| 6 | Classement (service + route) | `apps/api/src/services/palmares.ts`, `apps/api/src/routes/palmares.ts`, `apps/api/src/app.ts` | 5 |
| 7 | Client web | `apps/web/src/lib/palmares.ts`, `apps/web/src/content/palmares.ts` | 6 |
| 8 | Salle | `apps/web/src/routes/palmares.tsx`, `apps/web/src/components/layout/nav-items.ts`, `DESIGN_SYSTEM.md` | 7 |
| 9 | E2E | `packages/e2e/tests/palmares.spec.ts` | 6 |
| 10 | Preuves | `ci:check` + banc E2E | toutes |

## Règle pure (`packages/shared/src/palmares.ts`)

- `PALMARES_LIMIT_DEFAULT = 20`, `PALMARES_LIMIT_MAX = 100`
- `interface IsoWeek { year: number; week: number }`
- `isoWeekOf(date: Date): IsoWeek` — année ISO = année du jeudi de la semaine.
- `isoWeekRange(week: IsoWeek): { start: Date; end: Date } | null` — lundi 00:00:00.000 UTC,
  fin exclusive ; `null` si la semaine n'existe pas (0, 54, ou `2027-W53`).
- `isoWeekLabel(week: IsoWeek): string` — `2026-W47`, semaine sur deux chiffres.

## Surface HTTP (groupe protégé `/api/v1`)

`GET /palmares?year=&week=&limit=`

- Sans `year`/`week` : semaine courante. Un seul des deux : `400 PALMARES_INVALID_WEEK`.
- `limit` : entier 1..100, défaut 20 ; hors borne refusé par le schéma.
- `200` :
  `{ week, weekStart, weekEnd, current, total, items: [{ rank, tableauId, name, score, createdAt, player: { id, pseudo }, cards: [{ cardId, category, nom }] }] }`
  — `cards` dans l'ordre des emplacements (`REGION`, `DEPARTEMENT`, `COMMUNE`, `RUE`), les
  emplacements vides sont omis (les tableaux de fixture peuvent être partiels).
- `401 UNAUTHORIZED`, `400 PALMARES_INVALID_WEEK`.

`pseudo` vaut `user.pseudo ?? user.name` : Better Auth rend `pseudo` nullable.

## Vérification

```sh
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_42' \
  dev bun run ci:check
```

```sh
docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
```

Mapping critère → preuve :

| Critère | Preuve |
| --- | --- |
| 1. Départage écrit et stable | `palmares.spec.ts` : deux tableaux de même total, `created_at` forcé → le plus tôt devant ; `created_at` identique → `id` croissant ; deux lectures identiques |
| 2. Aucun recalcul navigateur | `apps/web/src/routes/palmares.tsx` n'importe ni `tableauScore` ni `alignmentMultiplier` (grep de revue) ; le rang vient du serveur |
| 3. Classement identique entre deux lectures | spec : deux `GET` successifs rendent les mêmes `rank`/`tableauId` ; E2E : rechargement de la salle |
| 4. Migration rétro-remplit et finit `not null` | spec : `information_schema` — `is_nullable = 'NO'` ; `00..` ; migration rejouée deux fois sans erreur (`db:migrate` ×2) |
| 5. Cas E2E | `packages/e2e/tests/palmares.spec.ts` |
| 6. Tableau modifié garde son score | spec : `update user_cards set score = 0` après soumission → le score du Palmarès ne bouge pas |
| 7. `ci:check` vert | sortie de la commande ci-dessus |
