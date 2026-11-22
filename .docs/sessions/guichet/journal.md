# Journal — phase 39 « Le Guichet »

Branche `feat/v2-39-guichet`, base `feat/v2-wave-3`, migration `0016_notifications`.
Plan : `plan.md`. Revue indépendante : `review.md`.

## Ce qui est livré

**Base de données.** Table `notifications (id, user_id, kind, dedupe_key, payload, created_at,
read_at)`, unicité `(user_id, dedupe_key)`, index partiel `(user_id, created_at desc) where read_at
is null`, clé étrangère vers `"user"` en cascade. Migration `0016_notifications` rejouable
(`if not exists` partout), enregistrée **en dernier** dans `migrator.ts`. **Aucune contrainte
`CHECK` sur `kind`** : la liste fermée vit dans `packages/shared/src/notifications.ts`
(`NOTIFICATION_KINDS`, neuf valeurs), et la spec prouve la parité entre ce domaine et le type
Kysely par une preuve de compilation dans les deux sens.

**Émission.** Une seule fonction, `emitNotification(exec, { userId, kind, ref, payload })`, qui
reçoit l'`exec` de la transaction en cours. Cinq points, tous dans la transaction existante :

| Événement | Site | `dedupe_key` |
| :--- | :--- | :--- |
| Demande d'ami | `services/friends.ts` `sendRequest` (insertion neuve et réouverture) | `FRIEND_REQUEST:<demandeur>` |
| Acceptation | `services/friends.ts` (consentement mutuel **et** `respondTo` accepté) | `FRIEND_ACCEPTED:<accepteur>` |
| Médaille | `services/achievements.ts`, après `if (!inserted) continue;` | `ACHIEVEMENT:<clé>` |
| Vente | `routes/market.ts`, transaction d'achat | `MARKET_SOLD:<listing>` |
| Achat | idem | `MARKET_BOUGHT:<listing>` |

Le refus, le blocage, la création et l'annulation d'annonce restent muets. `emitNotification`
n'est jamais enveloppé d'un `try/catch` : une émission impossible annule l'opération métier.

**API.** `GET /api/v1/notifications` (liste paginée, purge puis lecture), `GET …/unread-count`,
`POST …/:id/read` (idempotent), `POST …/read-all`. Schémas TypeBox `response` complets,
`additionalProperties: false` sur l'item et l'enveloppe, projection en liste blanche : ni `user_id`
ni `dedupe_key` ne sortent. Monté dans le groupe protégé `/api/v1`, après `accountRoutes`.

**Salle et cloche.** `/guichet` (`routes/guichet.tsx`), garde de session identique à `friends.tsx`
(anonyme → `/login`, session indisponible → `SessionUnavailable`). Groupes par `kind`, état vide
honnête, aucune planche de carte inventée, « Tout marquer comme lu », « Afficher plus » sur
`nextCursor`. La cloche (`components/layout/notification-bell.tsx`) lit
`GET …/unread-count`, sondage 60 s + `refetchOnWindowFocus`, pastille plafonnée à 99, `aria-live`
portant la valeur exacte du serveur. `nav-items.ts` reçoit la salle en tête des salles secondaires,
`sidebar.tsx` la cloche dans l'en-tête du rail, `app-shell.tsx` la cloche dans l'en-tête mobile.
`more-sheet.tsx` et `bottom-tab-bar.tsx` n'ont eu besoin d'aucun changement : la feuille lit
`SECONDARY_NAV`, et la cloche n'est pas un sixième onglet.

## Le site de la purge

**Balayage à la lecture de la salle**, dans `GET /api/v1/notifications`, borné à l'utilisateur qui
lit : `delete … where user_id = $1 and created_at < now() - interval '90 days'`, avant la lecture.
Aucun ordonnanceur, aucune dépendance, aucun compte ne purge les lignes d'un autre. Le compteur de
la cloche, lui, ne purge pas — ce serait une écriture toutes les 60 s sur un sondage : il **ignore**
l'expiré (`countUnread` borne à `created_at >= now() - interval '90 days'`), donc la pastille et la
salle ne peuvent pas diverger.

## Décisions prises pendant la phase

1. **Deux endpoints de lecture** plutôt qu'un : la cloche, montée sur toutes les pages, ne
   télécharge pas trente charges utiles toutes les 60 s.
2. **Curseur à la microseconde.** `created_at` est un `timestamptz` microseconde ; un curseur en
   millisecondes pouvait sauter une ligne à cheval sur une frontière de page (deux médailles
   frappées dans la même milliseconde). Le curseur porte désormais
   `YYYY-MM-DDTHH:MM:SS.UUUUUU|<uuid>`, produit par `to_char(… at time zone 'utc', …)`, et le
   prédicat est `(created_at, id) < ($1::timestamp at time zone 'utc', $2::uuid)`.
3. **Curseur validé structurellement, jamais parsé en `Date`.** Une chaîne de 36 tirets passait
   l'ancienne regex et faisait lever `22P02` au cast `::uuid` ; `1e21` produisait une `Invalid
   Date` que `pg` refuse. Les deux chemins répondaient `500` au lieu de `422`. La spec les couvre
   désormais (six curseurs invalides, tous en `422 NOTIFICATION_CURSOR_INVALID`).
4. **La rouverture d'une demande déclinée ne re-notifie pas** tant que la ligne d'origine vit : la
   clé est `FRIEND_REQUEST:<demandeur>`, donc `on conflict do nothing` laisse la première
   notification intacte. C'est le contrat (§4.10), pas un défaut — mais le commentaire du code
   affirmait le contraire, il a été corrigé plutôt que laissé mentir.

## Vérification

```sh
docker compose -p hexamap --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_39' \
  dev bun run ci:check
  ✓ 1/4 Lint
  ✓ 2/4 Typecheck
  ✓ 3/4 Base de données
  ✓ 4/4 Spécifications   418 pass, 0 fail, 23 fichiers, 2 635 expect()
```

Banc E2E, sur une pile bâtie depuis ce worktree (projet isolé `hexamap-e2e-39`, `kysely_migration`
s'arrêtant à `0016_notifications`, bundle contenant le chunk `guichet`) :

```
docker compose -p hexamap-e2e-39 -f docker-compose.e2e.yml -f /tmp/opencode/e2e39-compose.yml \
  run --rm playwright npx --no-install playwright test
  84 passed (2.7m) — 0 échoué, 0 ignoré, 12 fichiers
  chromium 37 · pwa 7 · Pixel 7 20 · iPhone 13 20
```

**84 et non 70.** Le chiffre de 68 attendu dans le brief est celui de `.docs/03-active-task.md`, qui
date de la planification : `feat/v2-wave-3` porte déjà les bancs des phases 34 et 37 (comptes,
vitrine, assemblage), soit **82 cas à HEAD**. Cette phase en ajoute **2** (chromium), tous deux
verts : « une demande d'ami allume la cloche, la lecture l'éteint » et « sans session, la salle est
fermée ». 82 + 2 = 84, et aucun cas existant n'a bougé.

## Écarts assumés

- **`docker compose -p hexamap`** pour `ci:check`, au lieu de la commande littérale du brief. La
  base `hexamap_test_39` vit dans la pile `hexamap` ; lancée sans `-p` depuis ce worktree, Compose
  aurait créé un projet `phase-39` avec un `db` vide. Le montage de `dev` reste celui du worktree,
  donc le code exécuté est bien celui de la phase.
- **`DESIGN_SYSTEM.md` : sous-section §8.9**, et non §8.6 comme le prévoyait le plan — §8.6 à §8.8
  étaient déjà pris (Le Cartel, Les Amis, La Vitrine). Aucune renumérotation, donc un diff plus
  petit.
- **Validation du plan** : le brief de session impose `.docs/sessions/guichet/{plan,review,journal}.md`
  et un `plan.md` unique, alors que le gabarit de la skill `01-plan` découpe en `phase-N.md` et
  passe un validateur. Le plan a été écrit dans le format demandé par le brief ; le validateur
  n'a donc pas été joué, et les étapes vivent dans le tableau « Phases » du `plan.md`.
- **Banc E2E sur un projet isolé** (`-p hexamap-e2e-39`). `docker-compose.e2e.yml` fixe
  `name: hexamap-e2e`, les noms de conteneurs et le tag `hexamap-e2e-api:latest` : d'autres
  worktrees de la même vague les partagent, et une image reconstruite sans `0016_notifications`
  fait échouer la pile en `corrupted migrations`. L'override ne change que le nom du projet, le tag
  d'image et le volume `pgdata` — aucun réglage du banc.
- **`--repeat-each=2` non vert, et c'est un comportement du produit.** Better Auth plafonne
  `/sign-up/email` à 3 inscriptions par 60 s et par IP, dans la table `rateLimit`. Une exécution
  complète du cas demande 2 inscriptions (le compte principal du `globalSetup`, puis le demandeur
  neuf) : elle tient. Deux répétitions en demandent 3 et frottent le plafond ; le seul remède
  serait de relever la limite pour le banc, c'est-à-dire de changer le produit pour faire passer un
  test. Rien n'a été relâché : aucun `skip`, aucune limite abaissée.
- **`text-[9px]` subsiste dans `app-shell.tsx`, `sidebar.tsx`, `bottom-tab-bar.tsx`,
  `more-sheet.tsx` et `alignment-connector.tsx`.** Ce sont des fichiers des phases 36 à 38, hors
  périmètre ; les fichiers créés par cette phase sont tous remontés à 10 px. Consigné, pas corrigé.

## Ce que cette session n'a pas prouvé

- Aucun rendu navigateur n'a été observé à l'œil par l'orchestrateur : l'agent web a vérifié que
  Vite transforme les quatre modules neufs et que `/guichet` répond `200`, et le banc E2E joue la
  cloche et la salle ; mais personne n'a regardé une capture.
- La charge utile d'un `TRADE_*` n'existe pas encore : la salle les rend par un repli défensif
  (libellé + date), et la phase 40 décidera de ce qu'elle y met.
