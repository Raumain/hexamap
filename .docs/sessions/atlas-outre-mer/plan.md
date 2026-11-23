---
objective: "Les 139 lignes d'outre-mer (5 régions, 5 départements, 129 communes) portent un path_d et un view_box de groupe partagé, l'API rend le cadre avec le tracé, L'Atlas affiche un encart par DROM, et la métropole reste intacte au octet près."
status: implemented
---

# Plan : Phase 50 — L'Atlas accueille l'outre-mer

Source : `.docs/10-retours-v2.md` entrée **R-006** (route B), brief de phase 50.

## Phases

| #   | Phase                                   | Fichier                                                                  | Dépend de |
| --- | --------------------------------------- | ------------------------------------------------------------------------ | --------- |
| 1   | Contrat : colonne `view_box`            | `.docs/02-database.md`                                                   | none      |
| 2   | Migration `0021_view_box` + types Kysely | `packages/db/migrations/0021_view_box.ts`, `src/migrator.ts`, `src/schema.ts` | 1         |
| 3   | Cadre de groupe dans la projection      | `scripts/import/src/atlas-projection.ts`                                  | none      |
| 4   | Backfill ciblé idempotent               | `scripts/import/src/atlas-overseas.ts`, `src/args.ts`, `src/index.ts`     | 2, 3      |
| 5   | Spécifications (rouges d'abord)          | `packages/spec/src/atlas-frames.spec.ts`                                  | 3, 4      |
| 6   | Modèle partagé + API (schémas fermés)   | `packages/shared/src/atlas.ts`, `apps/api/src/services/atlas.ts`, `apps/api/src/routes/atlas.ts` | 2         |
| 7   | Encarts par DROM                        | `apps/web/src/routes/atlas.tsx`, `apps/web/src/content/atlas.ts`          | 6         |
| 8   | Banc : fixture DROM + cas E2E            | `packages/e2e/fixtures/drom-fixture.ts`, `packages/e2e/tests/atlas-outre-mer.spec.ts`, `docker-compose.e2e.yml` | 5, 7      |
| 9   | Vérification                            | `ci:check` + banc E2E complet                                            | toutes    |

## External sources

| URL  | What it settled |
| ---- | --------------- |
| none | none            |

## Impact

| Catégorie     | Verdict et preuve | Traité en |
| ------------- | ----------------- | --------- |
| runtime       | Aucun `path_d` ni `view_box` calculé au runtime : l'API ne fait que lire deux colonnes (`§4.7`). Le SVG des encarts reste `aria-hidden`/`role="presentation"` et non focusable ; seul un `onClick` par département est ajouté, comme au niveau métropolitain (phase 49). | 6, 7 |
| regression    | Le classifieur garde `0 0 1000 1000` par défaut : `classifyGeometry`/`geometryToPathD` sans cadre restent identiques, donc les cas gelés d'`atlas.spec.ts` (« outre-mer hors viewBox ») restent verts sans être touchés. Le backfill est borné aux groupes dont la région est `out_of_viewbox` : aucune ligne métropolitaine n'est écrite. | 3, 4, 5 |
| architecture  | Une colonne `text` sur les trois tables, une migration, rien d'autre. Le cadre appartient au groupe et se recopie — jamais dérivé par entité. Aucune dépendance ajoutée. | 1, 2, 3, 4 |
| documentation | `.docs/02-database.md` §2, §5, §6, §7.1 ; journal de session avec les cinq cadres et les comptes des deux passes ; corps de PR. | 1, 9 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Une migration livrée ne change plus de nom (`02-database.md` §1) | `0015_atlas_paths` est immuable ; la phase possède `0021_view_box` et rien d'autre. |
| `add column if not exists` en SQL brut | Kysely 0.29 n'expose pas `ifNotExists()` sur les colonnes ; la migration doit être rejouable deux fois. |
| `path_d` dérivé une seule fois, à l'import (`§4.7`) | Aucune projection au runtime, ni API ni navigateur. |
| Les schémas `response` sont fermés (`apps/api/AGENTS.md`) | Un champ nouveau se déclare ; il ne s'obtient pas en ouvrant l'objet. |
| Fichiers partagés : import et clé **à la fin** | `migrator.ts`, `schema.ts` — la règle qui évite les conflits entre sessions. |
| Aucun `skip`, aucun délai relâché | Un cas rouge se corrige. |
| Tout passe par Docker | `ci:check` et le banc, jamais `bun` sur l'hôte. |

## Decisions

| Decision | Why |
| -------- | --- |
| La projection reste **globale** (Mercator métropole) ; seul le cadre change. | C'est ce que dit la décision 10 du brief : « le `path_d` est déjà dans le bon repère, l'encart ne fait que choisir son `viewBox` ». Un `path_d` reprojeté dans un cadre local aurait demandé une seconde projection. |
| `viewBox` = bbox des points **projetés** du groupe, avec un rembourrage `max(1, 2 % de la plus grande dimension)`. | Sans rembourrage, un filet tracé sur la frontière est rogné de moitié. Le rembourrage préserve la contenance, donc l'assemblage des communes. |
| Le groupe est identifié **géométriquement** : une région dont `classifyGeometry` vaut `out_of_viewbox`. | Aucune liste de codes `971`/`974` à maintenir, et la règle reste celle de R-006 (« c'est la projection, pas une liste d'exclusion »). |
| `viewBox` par entité dans la charge utile du résumé, en plus du `viewBox` global. | Un encart a besoin du cadre de son groupe ; le niveau départemental garde un cadre unique (toutes ses communes le partagent). |
| Les encarts ne sont **pas** dans un `<figure>`. | Le banc existant lit `figure svg` en mode strict (`atlas.spec.ts:50`) ; un second `<figure>` casserait un cas qui n'a rien à voir avec cette phase. |
| La fixture du banc ajoute **un** DROM (1 région, 1 département, 2 communes). | Un encart et une descente départementale se prouvent avec un groupe ; 2 communes limitent la perturbation du tirage des autres salles. |
| `NATIONAL_STATUS` d'`atlas.spec.ts` passe de 2 à 3 régions/départements. | Le compte est porté par la fixture, qui grandit d'un DROM. Ce n'est pas un relâchement : aucune assertion n'est retirée, aucun délai n'est touché, et le compte reste exact. |
