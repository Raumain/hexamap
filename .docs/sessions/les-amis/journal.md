# Journal — Phase 28 « Les Amis »

Branche `feat/phase-28-les-amis`, migration `0010_friendships`, base de test
`hexamap_test_28`. Aucune écriture dans `.docs/03-active-task.md`, `ROADMAP.md`,
`.docs/01-architecture.md`, ni dans une autre migration que `0010`.

## Ce qui est livré

| Couche | Fichier | Contenu |
| :-- | :-- | :-- |
| Base | `packages/db/migrations/0010_friendships.ts` | `friendships` (paire, statut, `responded_at`, `CHECK a <> b`, PK composite), index unique `friendships_pair_idx` sur `(least, greatest)`, `friendships_addressee_idx` ; `blocks` (PK composite, `CHECK a <> b`), `blocks_blocked_idx` ; semis idempotent de `FRIEND_REQUEST_DAILY_CAP` et `FRIEND_REQUEST_REOPEN_MS` |
| Base | `packages/db/src/{schema,migrator}.ts` | `FriendshipStatus`, `FriendshipTable`, `BlockTable`, entrées `Database` — **en fin de liste** |
| API | `apps/api/src/services/friends.ts` | lecture de `game_config` (strictement numérique), recherche de joueur, `pairCondition`/`blockCondition`, liste, envoi (transaction + `FOR UPDATE`), acceptation/refus, retrait, blocage (transaction) |
| API | `apps/api/src/routes/friends.ts` | six routes, schémas `response` par statut, `ERROR_STATUS`/`ERROR_MESSAGES`, `trim()` du pseudo |
| API | `apps/api/src/app.ts` | `friendRoutes` monté dans `protectedRoutes` |
| Spec | `packages/spec/src/friends.spec.ts` | 18 cas d'intégration sur PostgreSQL réel, deux comptes réels par cas |
| Web | `apps/web/src/{lib,content}/friends.ts`, `routes/friends.tsx` | client Eden, libellés, salle à deux colonnes |
| Web | `apps/web/src/components/layout/nav-items.ts` | `/friends` dans `SECONDARY_NAV`, `SALON_TITLES`, `SalonPath` |
| Docs | `DESIGN_SYSTEM.md` | §2 (ligne de salle), §8.8 (la salle), §9.1/§9.2 (quatre salles secondaires) |
| Docs | `.docs/02-database.md` §2 | `friendships`, `blocks` → **Migrée** |

## Décisions

1. **`:id` désigne le joueur homologue.** `friendships` n'a pas de clé de substitution : sa clé
   primaire est la paire. Inventer un identifiant de ligne aurait été une colonne hors contrat.
2. **Demande croisée = acceptation mutuelle.** Sur une ligne `PENDING` inversée, deux
   consentements valent acceptation ; l'index de paire interdit de toute façon la seconde ligne.
   Sur une ligne `DECLINED`, la règle du délai s'applique quel que soit le sens et seul le
   demandeur d'origine rouvre — le destinataire d'un refus reçoit `409 FRIENDSHIP_DECLINED`
   (« Cette demande a été refusée. »), pas un délai qu'il ne pourrait jamais atteindre.
3. **Une seule règle de paire.** `pairCondition(eb, a, b)` et `blockCondition(eb, a, b)` sont les
   seuls écrivains de la condition ; `least`/`greatest` ne vivent que dans la migration et dans
   la spec, où ils servent d'oracle indépendant.
4. **Deux codes de retrait.** Une demande reçue ne s'annule pas (`409
   FRIEND_REQUEST_NOT_CANCELLABLE`) : elle se refuse. Un `DELETE` sur une ligne `DECLINED` rend
   `404` et laisse la ligne intacte — sans quoi refuser puis supprimer rouvrirait la paire
   immédiatement.
5. **Semis des clés `FRIEND_REQUEST_*` par la migration 0010**, en `on conflict do nothing`.
   `.docs/02-database.md` §4.1 exige les clés au démarrage et aucune migration ne les semait ; le
   `DO NOTHING` rend le semis compatible avec celui des six clés que la phase 26 ajoutera.
6. **Pas de pastille de demandes dans la coquille.** Elle exigerait une requête permanente dans
   `app-shell` et changerait le nom accessible des liens, donc les sélecteurs E2E par
   `getByRole(..., { name })`. Le brief ne la liste pas dans « Ce que tu produis ».

## Écarts assumés

- **Helper `readGameConfigNumber` local à `services/friends.ts`.** Aucun lecteur de `game_config`
  n'existait dans le dépôt (grep exhaustif) et la phase 26 écrira le sien : un fichier partagé
  aurait créé un conflit d'écriture entre deux sessions parallèles.
- **`429` hors de `lib/http-error.ts`.** Son union de statuts s'arrête à 409 ; le routeur porte
  donc son propre `ERROR_STATUS`. Toucher ce fichier partagé n'était pas nécessaire.
- **Aucun cas E2E pour `/friends`.** Les critères de la phase demandent un cas d'intégration à
  deux comptes réels, livré ; les 44 px et l'absence de débordement reposent sur la lecture du
  code (`min-h-[44px]`, une seule colonne sous `lg`).
- **Plafond et blocage non sérialisés par utilisateur.** `SELECT … FOR UPDATE` ne verrouille que
  des lignes existantes : deux envois concurrents vers deux cibles différentes à `cap-1` peuvent
  dépasser le plafond d'une unité. Borné, documenté dans `review.md`, non corrigé (un verrou sur
  `"user"` coûterait plus que le risque).
- **Recherche par pseudo sans index fonctionnel** : `user_pseudo_lower_idx` appartient à la
  phase 29. `lower(pseudo) = lower($1)` borné à deux lignes ; un pseudo ambigu rend `404`.

## Journal des passes

1. **Spec rouge.** `friends.spec.ts` écrit avant tout code de production, lancé sur les routes
   inexistantes : `13` cas en échec, tous en `404 ROUTE_NOT_FOUND` (plus un `afterAll` en erreur,
   `relation "friendships" does not exist`).
2. **Données, service, routes.** Migration, schéma, migrator, service, routeur, montage.
   `13 pass, 0 fail`.
3. **Salle web.** Route, client, libellés, navigation, `DESIGN_SYSTEM`. Typecheck, build et lint
   verts ; `ci:check` à **172 spécifications, 12 fichiers**.
4. **Revue hostile, première passe : 5 défauts bloquants.**
   - `DELETE` supprimait une ligne `DECLINED` → contournement du délai de réouverture ;
   - ligne `DECLINED` inversée réécrite en `PENDING` sans délai ;
   - `sendRequest` sans garde de statut : acceptation écrasable, violation d'unicité en 500,
     plafond et blocage non atomiques ;
   - règle de paire écrite trois fois ;
   - teardown écrivant `FRIEND_REQUEST_DAILY_CAP` en **chaîne** jsonb, donc hors du type du
     contrat §4.1.
   Corrigés : transaction unique avec `FOR UPDATE`, `update` gardés par statut, insertion en
   `on conflict do nothing` + relecture, `pairCondition` unique, semis de test numérique et
   `readGameConfigNumber` strict. Quatre cas ajoutés (14 à 17).
5. **Revue hostile, seconde passe : 1 défaut de contrat, 1 fermeture confirmée des cinq.**
   `DELETE /friends/:id` servait un `409` absent de son schéma `response` — donc invisible
   d'OpenAPI et d'Eden. Ajouté, plus `FRIENDSHIP_DECLINED`, `trim()` à la frontière, SQLSTATE
   asserté au cas 17, tolérance `[200, 201]` retirée du cas 8, libellés front alignés. Cas 18
   ajouté (pseudo entouré d'espaces).
6. **Preuve finale.** `ci:check` 4/4.

## Vérification

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_28' \
  dev bun run ci:check
  [hexamap] ✓ 1/4 Lint   ✓ 2/4 Typecheck   ✓ 3/4 Base de données   ✓ 4/4 Spécifications
  177 pass, 0 fail, 1018 expect() calls, Ran 177 tests across 12 files
```

`packages/spec/src/friends.spec.ts` : `18 pass, 0 fail, 202 expect() calls`.

Contrôle du type des clés après le run :

```
docker compose exec -T db psql -U hexamap -d hexamap_test_28 \
  -c "select key, value, jsonb_typeof(value) from game_config order by key"
 FRIEND_REQUEST_DAILY_CAP | 20        | number
 FRIEND_REQUEST_REOPEN_MS | 604800000 | number
```

## Observations laissées telles quelles

- La base `hexamap_test_28` conserve des comptes d'un run rouge antérieur ; le teardown ne
  supprime que ses propres identifiants. Un contrôle sur une base vierge a rendu les mêmes 177
  spécifications.
- Le compte d'`expect()` fluctue d'une exécution à l'autre (déjà constaté aux phases 20 à 25) ;
  les chiffres stables sont **177 spécifications** et **12 fichiers**.
