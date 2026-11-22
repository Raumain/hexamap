# Journal — Phase 42, Le Palmarès

## Ce qui a été récupéré d'une session morte

La session d'agent qui portait la phase 42 s'est arrêtée en attendant un sous-agent, **sans
committer**. Le worktree `hexamap-v2-agents/phase-42` portait donc tout le travail en vrac :
11 fichiers modifiés, 10 non suivis, `HEAD` encore sur `21067a2` (l'intégration de la 41). Rien
n'a été écrit avant l'audit, et rien n'a été perdu — mais **rien n'était prouvé** : la sortie de la
session morte (« All green: 103 E2E, 502 specs ») était une déclaration, pas une preuve. Tout ce
qui suit a été relu puis rejoué dans cette session.

## Audit, point par point

1. **`packages/db/migrations/0014_ref_integrity.ts` modifié — garde d'idempotence, conservée.**
   Le diff ajoute deux `drop trigger if exists ref_truncate_guard on ref_regions` : l'un dans `up`,
   juste avant le `create trigger` du même nom ; l'autre dans `down`. Sans lui, rejouer 0014 échoue
   en `42710 trigger already exists` et viole `.docs/02-database.md` §1.8 (« toute migration est
   rejouable »). L'effet du schéma est identique : au premier passage le `drop` ne trouve rien, au
   second il retire exactement ce que le `create` recrée à l'identique. **Aucune autre migration
   n'a été touchée**, et `0019_tableau_score` reste le seul numéro neuf de la phase. Le nom du
   déclencheur tel qu'il est écrit dans `.docs/02-database.md` a été aligné sur le SQL réel dans le
   même commit, la seule modification documentaire de ce lot.
2. **`.docs/01-architecture.md` §2.5.** La phrase « le score d'un tableau n'est pas stocké » est
   bien retournée : le score est figé dans `tableaux.score`, écrit une fois par la soumission, et
   les quatre lectures qui recalculent encore (aperçu de composition, liste du joueur, meilleur
   tableau de la vitrine, fil des médailles) sont nommées au lieu d'être passées sous silence.
   Aucune autre règle du document n'a été réécrite. La semaine ISO, le départage et la non-exposition
   sont écrits dans `.docs/02-database.md` §7.1 et repris dans la puce de `§2.5`.
3. **`apps/web/src/components/layout/nav-items.ts`.** Une seule entrée ajoutée, `/palmares`, en
   salle secondaire. L'Atlas, Le Guichet, Le Cadastre, Le Comptoir, Les Planches et Les Amis sont
   intacts ; la barre basse n'a pas bougé (elle reste à quatre salles plus « Plus »). La phase 42
   est seule dans sa vague, donc propriétaire de `components/layout/`.
4. **`apps/web/src/routeTree.gen.ts`.** 21 lignes, toutes produites par le générateur (import, nœud,
   `FileRoutesByFullPath`, `FileRoutesByTo`, `FileRouteTypes`). Le fichier n'a jamais été édité à la
   main.
5. **Aucun recalcul côté navigateur.** `grep -rn "tableauScore\|alignmentMultiplier\|evaluateTableau"
   apps/web/src` ne rend qu'un **commentaire** de `content/tableau.ts` qui cite les fonctions
   partagées sans les importer. La salle affiche `rank` et `score` tels que la réponse les porte,
   et l'ordre du DOM est celui du serveur (`palmares.tsx`, commentaire l. 110).
6. **Les critères du brief.**
   - Départage **écrit et total** : `score desc, created_at asc, id asc`, un seul `ORDER BY` dans
     `apps/api/src/services/palmares.ts`. Le rang est la position 1..N, donc il n'existe plus d'ex
     æquo partagé. Deux specs le prouvent (created_at différent, puis instant identique → `id`) et
     comparent deux lectures successives.
   - Semaine **ISO 8601, lundi 00:00:00.000 UTC → lundi suivant exclu**, en UTC, calculée depuis
     `tableaux.created_at` par `packages/shared/src/palmares.ts` ; règle écrite dans
     `.docs/02-database.md` §7.1 et §2.5 de `01` ; une semaine inexistante (`2027-W53`) répond
     `400 PALMARES_INVALID_WEEK` au lieu de déborder sur la semaine 1 de l'année suivante.
   - Classement **identique entre deux lectures** : spec (deux `GET`, mêmes `[rank, tableauId]`) et
     E2E (rechargement complet de la salle, deux lignes témoins identiques).
   - Cas E2E présent : deux soumissions réelles, l'ordre attendu, le score de la soumission relu
     après rechargement, et les liens de la salle demandés pour de vrai (`/api/v1/cards/:id`).

## Décisions reprises et assumées

- **Une colonne, pas d'instantanés.** `tableaux.score integer` ; `tableau_scores` reste écartée :
  une seconde table serait une seconde vérité à réconcilier pour un besoin qui tient en une colonne.
- **Rétro-remplissage en SQL, dans la migration.** `packages/db` ne dépend pas de `@hexamap/shared`
  et aucune migration du dépôt n'importe un paquet du monorepo : la formule est donc recopiée **une
  seule fois**, dans `0019_tableau_score`, et nulle part dans `apps/`. La spec rejoue la migration
  sur une base vivante et compare aux attendus de `tableauScore` (12 500, 900, 6 250), y compris
  avec une carte orpheline (aucun `22P02`, les liens restants survivent).
- **Ordre de la migration** : colonne nullable → rétro-remplissage borné par `score is null` →
  `set not null` → `set default 0`. Poser le défaut avant le remplissage aurait figé les lignes
  existantes à zéro.
- **Le défaut `0`** existe pour six insertions directes de test hors phase (specs `tableaux`,
  `profile`, `atelier`, `account` ×2, fixture `vitrine`) qui ne fournissent pas de score ; aucun
  chemin de production ne l'écrit, et c'est écrit dans `.docs/02-database.md` §4.4 plutôt que
  silencieux.
- **Écart connu, non corrigé** : `GET /api/v1/tableaux` (la liste du joueur) continue de recalculer
  son `total` à la lecture. Le Palmarès ne lit **que** la colonne figée. Unifier aurait changé les
  attentes d'un cas gelé de `packages/spec/src/tableaux.spec.ts`, que cette phase n'a pas le droit
  de réécrire ; `user_cards.score` ne change jamais après acquisition, donc la divergence reste
  théorique.
- **Les cartes d'un tableau classé sont nommées** pour tous, mais seule la carte du joueur courant
  est liée : `/cards/:id` répond `CARD_NOT_VISIBLE` sur la carte d'un tiers. Une vitrine privée
  (`profile_public = false`) n'est pas liée non plus, puisqu'elle répond `404` par dessein.
- **La salle n'expose que la semaine courante.** Le serveur accepte `?year=&week=` et la spec le
  vérifie ; l'interface n'offre pas encore de sélecteur de semaine close. C'est une absence
  assumée, pas un oubli caché.

## Vérification (Docker uniquement)

```sh
docker compose -p hexamap --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_42' \
  -v .../phase-42:/app -w /app dev bun run ci:check
  ✓ 1/4 Lint
  ✓ 2/4 Typecheck
  ✓ 3/4 Base de données
  ✓ 4/4 Spécifications   506 pass, 0 fail, 3126 expect(), 27 fichiers
```

```sh
docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  103 passed (2.9m), 0 échoué, 0 ignoré
```

Le cas du Palmarès a été rejoué seul pour ne pas dépendre du total :
`playwright test tests/palmares.spec.ts` → **1 passed**, avec la trace
`[e2e] entrées étrangères classées : 12` (les passages précédents du banc laissent leurs tableaux
dans la semaine, et la salle les rend sans jamais lier le cartel d'un autre joueur).

## Ce qui n'a pas été touché

`main`, l'arbre principal, `.docs/03-active-task.md`,
`packages/db/src/types.generated.ts`, et aucune assertion de `packages/spec` hors du fichier neuf
`packages/spec/src/palmares.spec.ts`. Aucun `skip`, aucun délai relâché.
