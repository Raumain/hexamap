# Revue — Phase 28 « Les Amis »

Relecture hostile du diff, menée par un relecteur indépendant (aucune écriture), puis rejouée
après corrections. Deux passes.

## Verdict

**Prêt à livrer.** Tous les défauts *deal-breaker* des deux passes sont corrigés et couverts par
un cas de spécification. Les points restants sont des suggestions assumées, consignées plus bas.

## Première passe — 5 défauts bloquants

| # | Gravité | Défaut | Résolution |
| :-- | :-- | :-- | :-- |
| 1 | deal-breaker | `DELETE /friends/:id` supprimait aussi une ligne `DECLINED`, ce qui contournait `FRIEND_REQUEST_REOPEN_MS` : refuser puis supprimer permettait de redemander aussitôt | `removeFriend` distingue quatre cas : `ACCEPTED` → suppression, `PENDING` par le demandeur → annulation, `PENDING` par le destinataire → `409 FRIEND_REQUEST_NOT_CANCELLABLE`, `DECLINED` → `404 FRIENDSHIP_NOT_FOUND` sans toucher la ligne. Cas 14 et 15 |
| 2 | deal-breaker | Une ligne `DECLINED` inversée était réécrite en `PENDING` immédiatement : le destinataire d'un refus contournait le délai | Toute ligne `DECLINED`, quel que soit le sens, exige le demandeur d'origine ; un autre appelant reçoit `409 FRIENDSHIP_DECLINED`. Cas 16 |
| 3 | deal-breaker | `sendRequest` lisait puis écrivait sans garde : une acceptation concurrente pouvait être écrasée, et une violation d'unicité remontait en 500 | Une seule transaction, relecture `FOR UPDATE`, contrôle de blocage et plafond dans la transaction, `update` gardés par statut avec `returning`, insertion en `on conflict do nothing` + relecture |
| 4 | deal-breaker | La règle de paire était écrite trois fois (`least/greatest`, `OR` de deux `AND`, `IN` de tuples) | Un seul helper `pairCondition(eb, a, b)` (et `blockCondition`), utilisé par les quatre lectures/écritures ; `least`/`greatest` ne restent que dans la migration et dans la spec, où ils servent d'oracle indépendant |
| 5 | deal-breaker | Le teardown de la spec écrivait `FRIEND_REQUEST_DAILY_CAP` en **chaîne** jsonb (`JSON.stringify`), dégradant le type exigé par `.docs/02-database.md` §4.1 | Écriture d'un nombre, restauration conditionnelle, assertion `jsonb_typeof(value) = 'number'` ; `readGameConfigNumber` n'accepte plus que `typeof value === 'number'` |

## Seconde passe — 1 défaut de contrat, corrigé

| # | Gravité | Défaut | Résolution |
| :-- | :-- | :-- | :-- |
| 6 | deal-breaker | `DELETE /friends/:id` servait un `409` absent du schéma `response` : OpenAPI et Eden Treaty l'ignoraient — contraire à `.docs/01-architecture.md` §4.2 | `409: errorSchema` déclaré ; audit des six routes : c'était la seule incomplète |

## Suggestions corrigées dans la foulée

- `FRIENDSHIP_NOT_FOUND` parlait de « demande en attente » alors qu'il sert aussi au retrait : message aligné des deux côtés.
- `FRIEND_REQUEST_REOPEN_TOO_SOON` mentait au destinataire d'un refus (« Réessayez plus tard » alors qu'il ne pourra jamais) : code distinct `FRIENDSHIP_DECLINED`.
- `body.pseudo` n'était pas trimmé côté API : `" Alice "` donnait `404`. Cas 18.
- Cas 17 : `rejects.toThrow()` acceptait n'importe quelle erreur ; le SQLSTATE est désormais asserté (`23505`, `23514`).
- Cas 8 : tolérance `[200, 201]` retirée, la réouverture répond `200`.
- `DESIGN_SYSTEM.md` §9.1/§9.2 annonçaient « trois entrées de `SECONDARY_NAV` » : passés à quatre.

## Suggestions assumées, non corrigées

| Point | Pourquoi |
| :-- | :-- |
| Le plafond quotidien n'est pas sérialisé par utilisateur : deux envois concurrents vers **deux cibles différentes** à `cap-1` peuvent dépasser le plafond d'une unité | Le dépassement est borné par le nombre de requêtes concurrentes d'un même compte, et un verrou par utilisateur (`FOR UPDATE` sur `"user"`) coûterait un verrou global sur la table d'authentification. À traiter si le farming devient réel |
| Un `blockPlayer` concurrent d'un `sendRequest` vers une paire encore inexistante peut laisser une ligne `PENDING` à côté du bloc | Même limite : `FOR UPDATE` ne verrouille que des lignes existantes. Le blocage ultérieur supprime la relation ; aucun accès n'est ouvert par cette ligne |
| `acceptRequest`/`declineRequest`/`removeFriend` répondent `404` au second appel (pas idempotents) | L'interface ne propose pas de double soumission ; l'idempotence demanderait un état de référence côté client |
| Aucun cas E2E de la salle `/friends` | Hors des critères de la phase ; le comportement est prouvé par 18 cas d'intégration sur PostgreSQL réel. Les 44 px et l'absence de débordement reposent sur la lecture du code (`min-h-[44px]`, une seule colonne sous `lg`) |
| La base `hexamap_test_28` conserve des comptes d'un run rouge antérieur (« base revenue à l'état initial » n'est vrai qu'à l'échelle des lignes créées par le run) | Le teardown nettoie ses propres identifiants ; le run de contrôle sur une base vierge a rendu les mêmes 177 spécifications |
| Recherche par pseudo sans index fonctionnel | `user_pseudo_lower_idx` appartient à la phase 29. La comparaison est paramétrée et bornée à deux lignes |

## Ce qui a été vérifié sans réserve

- DDL identique à `.docs/02-database.md` §4.9, y compris sur base vierge : `friendships_pair_idx UNIQUE (LEAST, GREATEST)`, `friendships_self_check`, `friendships_addressee_idx`, `blocks_blocked_idx`, FK `"user"(id) ON DELETE CASCADE`.
- `down` en ordre inverse, `migrator.ts` en fin de liste, `schema.ts` miroir du SQL, `app.ts` monté dans `protectedRoutes`.
- Sécurité : recherche paramétrée, auto-demande et auto-blocage refusés, joueur inconnu, acceptation d'une demande non reçue, suppression par un tiers, message de blocage générique (« Cette relation est indisponible. ») sans révéler l'auteur.
- Web : `SECONDARY_NAV` à quatre entrées, `PRIMARY_NAV` à quatre, un seul `<main>` par route, jetons du `@theme` uniquement, `min-h-[44px]`, `aria-live="polite"`, invalidation de `friendsQueryKey` après chaque mutation, textes français.
- Portée : aucun fichier interdit touché (`03-active-task.md`, `ROADMAP.md`, `01-architecture.md`, `styles.css`, `types.generated.ts`, aucune migration `0009`) ; `routeTree.gen.ts` régénéré par `tsr generate`, jamais édité à la main.

## Preuve

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_28' \
  dev bun run ci:check
  ✓ 1/4 Lint   ✓ 2/4 Typecheck   ✓ 3/4 Base de données   ✓ 4/4 Spécifications
  177 pass, 0 fail, 1018 expect() calls — 177 tests, 12 fichiers
```
