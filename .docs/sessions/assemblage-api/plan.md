---
objective: "Deux routes authentifiées servent à la salle tout l'atlas — résumé national et détail d'un département — en une seule instruction SQL chacune, sans jamais exposer de donnée privée."
status: pending
---

# Plan: Phase 34 — L'Assemblage, l'API

Source: brief de session « Phase 34 — L'Assemblage, l'API », `.docs/07-roadmap-v2.md` §4 « Phase 34 », `.docs/02-database.md` §5 et §7.1.

## Phases

| #   | Phase                          | File                         | Depends on |
| --- | ------------------------------ | ---------------------------- | ---------- |
| 1   | Contrat partagé et spec rouge  | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Service d'agrégation           | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | Routes, montage et preuve      | [`phase-3.md`](./phase-3.md) | 2          |

## External sources

| URL | What it settled |
| --- | --- |
| none | Aucune : toute la matière est dans le dépôt et dans la base de développement. |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| Runtime | Les deux routes lisent `ref_regions`, `ref_departements`, `ref_communes` et `user_cards`. Mesuré sur la base de développement : 26 régions (15 avec `path_d`), 109 départements (98 avec `path_d`), 34 917 communes (34 752 avec `path_d`), `max(length(path_d))` = 7 198 octets pour une commune. Aucune dépendance externe, aucun appel réseau. | 3 |
| Regression | Deux fichiers partagés sont touchés : `packages/shared/src/index.ts` (une ligne de barrel, ajoutée à sa place alphabétique) et `apps/api/src/app.ts` (un `import` et un `.use()` dans `buildProtectedRoutes`). Les specs `cards`, `tableaux`, `players`, `auth` couvrent déjà le groupe protégé : risque faible, filet = suite complète. | 1, 3 |
| Architecture | Ajoute un module de lecture agrégée (`services/atlas.ts`) et un module de routes (`routes/atlas.ts`). Aucun changement de schéma, aucune migration, aucune écriture : la base ne reçoit que des `select`. Le contrat de données de `.docs/02-database.md` reste intact, `path_d` y est déjà **Migrée**. | 2, 3 |
| Documentation | **Aucun document de `.docs/` modifié.** `02-database.md` n'a rien à recevoir (pas de schéma nouveau, `path_d` déjà Migrée) ; `01-architecture.md`, `07-roadmap-v2.md` et `03-active-task.md` sont hors de mon périmètre. La preuve et les écarts vivent dans `.docs/sessions/assemblage-api/{journal,review}.md`. | none |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Les routes métier sont fermées par défaut (`.docs/01-architecture.md` §4.1) | Les deux routes montent dans `buildProtectedRoutes`, après `.use(authPlugin)`, donc `401` sans session. |
| `response` TypeBox obligatoire, `additionalProperties: false` (`.docs/01-architecture.md` §4.2) | Le typage Eden de la phase 35 dépend du schéma, pas d'un cast. |
| Les requêtes métier passent par Kysely (`.docs/02-database.md` §1.7) | Le service reçoit un `Kysely<Database>` et compose une expression `sql` **dans** un `selectNoFrom` Kysely ; aucun `executeQuery` brut, aucun `db.raw`. L'SQL brut reste aux migrations et aux fixtures de spec. |
| Aucune table ni colonne inventée (`.docs/02-database.md`) | Les seules colonnes lues sont celles du §5 et de `user_cards` §4.2. |
| Tout passe par Docker (`.docs/01-architecture.md` §6) | `ci:check` et la suite de spec ne tournent que dans le conteneur `dev`. |
| Spec d'abord | Le fichier de spec est écrit et vu rouge avant le service et les routes. |
| `packages/spec` : ne pas toucher un cas existant | `packages/spec/src/atlas.spec.ts` appartient à la phase 33 ; mes cas vont dans un fichier neuf. |

## Decisions

| Decision | Why |
| -------- | --- |
| **Un fichier de spec neuf, `atlas-api.spec.ts`, au lieu d'étendre `atlas.spec.ts`.** | `packages/spec/src/atlas.spec.ts` existe déjà (457 lignes, phase 33 : projection et écriture idempotente de `path_d`) et est gelé. Le dépôt a déjà ce découpage — `tableau.spec.ts` et `tableaux.spec.ts` coexistent. Écrire dans le fichier de la phase 33 exposerait à réécrire un cas gelé. |
| **Une instruction SQL par route, via deux `CTE` et un `json_build_object`.** | Le critère 1 exige une instruction, le §7 de la base interdit un `select *` par entité. Le résumé rend deux listes en un seul aller-retour ; le détail rend l'en-tête et ses communes en un seul aller-retour. |
| **La possession se résout par agrégat sur `user_cards`, jamais par entité.** | `ownedCards` compte les **exemplaires** (`count(*)`) ; `communesOwned` compte les **communes distinctes** (`group by ref_code` puis `count(*)`). La règle s'inverse à cet endroit précis et nulle part ailleurs. |
| **`hasCommuneCard` = `ownedCards > 0`.** | Une carte de commune porte le code INSEE de la commune dans `ref_code` : posséder la carte, c'est posséder la commune. Le champ est demandé par le contrat et reste donc présent, sans seconde requête. |
| **`404` quand `ref_departements.path_d is null`, pas de liste de codes d'outre-mer en dur.** | La phase 33 a classé `out_of_viewbox` par géométrie, pas par code : `path_d = null` est le seul signal serveur. Vérifié en base : 971, 972 et 974 sont `null`, 2A, 75 et 06 ne le sont pas. Un code inconnu ne rend aucune ligne : même `404`. **Conséquence assumée** : le `200` du critère 4 est vérifié sur un département **avec** `path_d` et sans aucune carte possédée, pas sur un département sans géométrie. |
| **Aucune pagination, et le plafond de 60 Ko ne sera pas tenu.** | Mesuré en base de développement : le département 62 porte 887 communes et **166 715 octets** de `path_d` seul ; la moyenne nationale est de 233 octets par commune. Le plafond de 60 Ko supposerait ~257 communes par département. La décision 6 du brief prescrit alors d'écrire le chiffre au journal et de ne pas paginer — l'affirmation « la phase 33 tient la charge nationale sous 250 Ko » est fausse telle quelle (8 090 841 octets pour les seules communes) et sera consignée, pas compensée ici. |
| **`ATLAS_VIEWBOX` est un homonyme, pas un doublon résolu.** | `scripts/import/src/atlas-projection.ts:28` exporte déjà `ATLAS_VIEWBOX = 1000` (un nombre). Le contrat impose `packages/shared/src/atlas.ts` avec `ATLAS_VIEWBOX = '0 0 1000 1000'` (une chaîne). Les deux modules ne se rencontrent nulle part : je suis le contrat et je consigne l'homonymie dans `review.md`. |
| **La preuve de chaque critère est un cas de spec, pas une affirmation.** | `1` → compte d'événements `query` par `createDb(url, { log })` ; `2` → 2 000 cartes semées par un seul `generate_series`, 20 appels, p95 ; `3` → typecheck sur schéma fermé ; `4` → quatre cas HTTP ; `5` → absence de `locked`/`currency`/`email`/`session`/`password`/`RUE` dans la charge sérialisée ; `6` → non tenu, chiffre cité ; `7` → `ci:check`. |
