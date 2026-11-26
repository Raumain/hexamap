---
objective: "Le Guichet existe : une notification est écrite dans la transaction qui la provoque, la salle /guichet la rend, la cloche en suit le compteur serveur, et la purge à 90 jours tourne — sans CHECK sur kind, sans SSE."
status: approved
---

# Plan : phase 39 — Le Guichet

Source : brief de session (phase 39), `.docs/07-roadmap-v2.md` §4 « Phase 39 — Le Guichet »,
`.docs/02-database.md` §2/§4/§6/§7, `.docs/01-architecture.md` §2.8/§2.9/§4.9.

## Décisions de conception

| Décision | Pourquoi |
| :--- | :--- |
| Domaine pur dans `packages/shared/src/notifications.ts` | La liste fermée des `kind`, le constructeur de `dedupe_key` et la rétention doivent être partagés par l'API, la salle et les specs. Une seule autorité, comme `rarity.ts`. |
| `kind` typé `NotificationKind` en TS, `text` en base, **aucun CHECK** | Le contrat l'impose : la phase 40 doit émettre `TRADE_*` sans migration. La validation vit dans `assertNotificationKind`, appelée par la seule fonction d'émission. |
| `dedupe_key = "<kind>:<ref>"` construit par une fonction pure | Écrit en clair dans le contrat : `ACHIEVEMENT:<key>`, `MARKET_SOLD:<listing_id>`, `FRIEND_REQUEST:<requester_id>`. L'unicité `(user_id, dedupe_key)` porte l'idempotence, l'écriture est `on conflict do nothing`. |
| Émission par une seule fonction `emitNotification(exec, …)` | Elle reçoit la transaction en cours (`Kysely<Database> \| Transaction<Database>`), jamais une connexion neuve. Une émission ratée annule l'opération métier au lieu de laisser un mensonge. |
| Purge : **balayage à la lecture de la salle**, borné à l'utilisateur | Pas d'ordonnanceur, pas de dépendance : `delete … where user_id = ? and created_at < now() - 90 days` avant la lecture de la liste. L'index `notifications_user_idx` porte le filtre. Site écrit dans le journal et la PR. |
| Deux endpoints de lecture : liste paginée et compteur | La cloche ne télécharge pas 30 charges utiles toutes les 60 s ; la salle ne demande pas le compteur. Les deux sont invalidés par toute mutation de lecture. |
| Curseur de pagination `"<epoch_ms>:<uuid>"` | Keyset `(created_at, id)` : pas de saut de ligne quand deux notifications partagent la même milliseconde, pas d'`OFFSET` qui dérive. |
| La cloche est un composant sans état local | Critère 2 : elle lit `GET /notifications/unread-count` (60 s + `refetchOnWindowFocus`) et rend `unread`. Aucun `useState`, aucun décrément optimiste. |
| E2E : un compte **neuf à chaque exécution** | La clé `FRIEND_REQUEST:<requester_id>` rend une paire fixe non rejouable (le rejeu ne crée pas de doublon — c'est le contrat). Un joueur aléatoire inscrit dans le test garde le banc idempotent sans toucher au contrat. |

## Phases

| # | Phase | Fichiers | Dépend de |
| :-- | :--- | :--- | :--- |
| 1 | Contrat documentaire + domaine partagé | `.docs/02-database.md` (§2 statut **Contrat**, §4.10, §6, §7.1), `packages/shared/src/notifications.ts`, barrel `packages/shared/src/index.ts` | none |
| 2 | Schéma et migration | `packages/db/migrations/0016_notifications.ts`, `packages/db/src/migrator.ts`, `packages/db/src/schema.ts`, `.docs/02-database.md` → **Migrée** | 1 |
| 3 | Spec rouge, puis service et API | `packages/spec/src/notifications.spec.ts`, `apps/api/src/services/notifications.ts`, `apps/api/src/routes/notifications.ts`, `apps/api/src/app.ts` | 2 |
| 4 | Instrumentation des cinq points d'émission | `apps/api/src/services/friends.ts` (demande + acceptation), `apps/api/src/services/achievements.ts` (médaille), `apps/api/src/routes/market.ts` (vente + achat) | 3 |
| 5 | Salle et cloche | `apps/web/src/lib/notifications.ts`, `apps/web/src/content/guichet.ts`, `apps/web/src/routes/guichet.tsx`, `apps/web/src/components/layout/notification-bell.tsx`, `nav-items.ts`, `sidebar.tsx`, `app-shell.tsx` | 4 |
| 6 | E2E | `packages/e2e/tests/guichet.spec.ts` | 5 |
| 7 | Design system + mémoire | `DESIGN_SYSTEM.md` (§2, §9.1, §9.2, §8.6, ordre de livraison), `.docs/sessions/guichet/*` | 6 |

## Détail par phase

### 1 — Contrat documentaire et domaine partagé

`.docs/02-database.md` : §4.10 nouvelle sous-section, DDL complet (`id uuid …`, `read_at
timestamptz`), unicité `notifications_user_dedupe_idx (user_id, dedupe_key)`, index partiel
`notifications_user_idx (user_id, created_at desc) where read_at is null`, puis la liste fermée des
neuf `kind` **en clair** avec la mention « validée dans le code, pas en base ». §2 : ligne
`notifications | **Contrat** | 0016_notifications`. §6 : `NotificationTable` + entrée `Database`.
§7.1 : trois invariants (unicité = idempotence, purge 90 j, `kind` jamais contraint en base).

`packages/shared/src/notifications.ts` :

```ts
export const NOTIFICATION_KINDS = [
  'FRIEND_REQUEST','FRIEND_ACCEPTED','ACHIEVEMENT','MARKET_SOLD','MARKET_BOUGHT',
  'TRADE_OFFER','TRADE_ACCEPTED','TRADE_DECLINED','TRADE_EXPIRED',
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export function isNotificationKind(value: unknown): value is NotificationKind;
export function notificationDedupeKey(kind: NotificationKind, ref: string): string; // `${kind}:${ref}`
export const NOTIFICATION_RETENTION_DAYS = 90;
```

Vérification : `bun run typecheck` + le barrel exporte bien (aucun import cassé).

### 2 — Schéma et migration

`0016_notifications.ts`, rejouable :

```sql
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  kind text not null,
  dedupe_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create unique index if not exists notifications_user_dedupe_idx on notifications (user_id, dedupe_key);
create index if not exists notifications_user_idx on notifications (user_id, created_at desc) where read_at is null;
```

`migrator.ts` : `import * as notifications from '../migrations/0016_notifications';` et
`'0016_notifications': notifications` **en fin de map**. `schema.ts` : `NotificationTable` après
`UserProfileTable`, entrée `notifications` **en fin** de `Database`.

Vérification : `db:migrate` deux fois de suite sans erreur (rejouabilité), `ci:check` vert.

### 3 — Spec rouge, puis service et API

`packages/spec/src/notifications.spec.ts`, copie du squelette de `friends.spec.ts` (son propre
`createDb`, `signUp`, `authFetch`, `createdUserIds`, `afterAll`). **Écrit et exécuté rouge avant
le service.** Cas :

1. `notificationDedupeKey` rend `ACHIEVEMENT:<key>`, `MARKET_SOLD:<list>`,
   `FRIEND_REQUEST:<requester>` et `${kind}:<ref>` pour les neuf `kind`.
2. Un `kind` hors liste est refusé par `isNotificationKind` et par `emitNotification` (rejet, zéro
   ligne écrite).
3. Un rejeu de `emitNotification` avec la même paire `(user_id, dedupe_key)` laisse **une** ligne.
4. `GET /api/v1/notifications` : forme `{ items, nextCursor, unread }`, `401` sans cookie,
   `payload` restitué intact (le contrat dit que le `payload` décide de l'affichage).
5. `GET /unread-count`, `POST /:id/read` (idempotent), `POST /read-all` remettent `unread` à la
   valeur serveur.
6. Purge : une ligne à `now() - 91 days` disparaît à la lecture, une ligne à `-89 days` reste.
7. Intégration : une demande d'ami émet `FRIEND_REQUEST:<requester>` chez le destinataire ;
   l'acceptation émet `FRIEND_ACCEPTED:<accepter>` chez le demandeur.

`services/notifications.ts` : `assertNotificationKind`, `emitNotification(exec, { userId, kind, ref,
payload })`, `purgeExpiredNotifications(exec, userId)`, `listNotifications`, `countUnread`,
`markRead`, `markAllRead` — tout prend l'`exec` en paramètre.

`routes/notifications.ts` : `Elysia({ prefix: '/notifications' }).use(authPlugin)`, schémas
TypeBox `response` complets (`payload: t.Record(t.String(), t.Unknown())`), `401` explicite comme
`market.ts`. Monté dans `buildProtectedRoutes` d'`app.ts`, après `accountRoutes`.

Vérification : la spec passe du rouge au vert sans modifier un cas existant.

### 4 — Instrumentation (cinq points, aucune transaction nouvelle)

| Point | Fichier | Émission |
| :--- | :--- | :--- |
| Demande d'ami | `services/friends.ts` `sendRequest`, dans son `db.transaction()` | `FRIEND_REQUEST`, ref = demandeur |
| Acceptation | `services/friends.ts` : envelopper `respondTo`/`acceptRequest` dans une transaction | `FRIEND_ACCEPTED`, ref = accepteur |
| Médaille | `services/achievements.ts`, juste après `if (!inserted) continue;` | `ACHIEVEMENT`, ref = `achievement.key` |
| Vente | `routes/market.ts`, transaction d'achat | `MARKET_SOLD`, ref = `listing.id` |
| Achat | idem | `MARKET_BOUGHT`, ref = `listing.id` |

Le blocage et le refus restent muets (§2.9). Le `payload` ne porte jamais `grid`,
`treasure_index`, ni le solde d'un tiers : identifiant, pseudo public, prix, libellé de médaille.

### 5 — Salle et cloche

`lib/notifications.ts` : `notificationsQueryKey`, `unreadQueryKey`, `listNotifications`,
`unreadCount`, `markRead`, `markAllRead`, `notificationsErrorMessage` — calqué sur `lib/friends.ts`.
Liste : `staleTime` 30 s, `refetchInterval` 60 s, `refetchOnWindowFocus: true`, `retry: false`.
Compteur : mêmes réglages, `staleTime` 15 s.

`routes/guichet.tsx` : garde de session identique à `friends.tsx` (`Navigate to="/login"` si
anonyme, `SessionUnavailable` si `unavailable`). Sections groupées par `kind` dans un ordre fixe,
libellés français dans `content/guichet.ts`, date relative, lien vers `/players/$id` quand le
`payload` porte `playerId`. Clic sur une ligne non lue → `markRead`. Bouton « Tout marquer comme
lu » désactivé à zéro. État vide honnête : ce que le guichet remettra, sans inventer une planche.
« Afficher plus » quand `nextCursor` existe.

`notification-bell.tsx` : `useSessionState()`, `useQuery` du compteur, `<Link to="/guichet">` avec
pastille chiffrée et libellé accessible (`aria-live`), rien si anonyme. Monté dans `sidebar.tsx`
(en-tête du rail) et dans l'en-tête mobile d'`app-shell.tsx`. `nav-items.ts` : `'/guichet'` dans
`SalonPath`, entrée dans `SECONDARY_NAV_BASE`, clé dans `SALON_TITLES` — le rail, la feuille
mobile et `isSecondaryRoom` la lisent à la source.

Vérification : parcours dans le navigateur (cloche chiffrée → salle → ligne lue → cloche éteinte).

### 6 — E2E

`packages/e2e/tests/guichet.spec.ts` (projet `chromium`, aucun `testIgnore` ne l'écarte) :

1. Un joueur neuf est inscrit dans un contexte séparé (pseudo aléatoire), envoie une demande
   d'ami au joueur principal (pseudo lu par `readAccountFixture()`).
2. Le joueur principal recharge : la cloche porte un compteur > 0.
3. `/guichet` montre la demande avec le pseudo du demandeur.
4. Marquer lu (ou « tout marquer comme lu ») → le compteur retombe à zéro.
5. Sans session, `/guichet` renvoie au Seuil.

### 7 — Design system et mémoire

`DESIGN_SYSTEM.md` : ligne `/guichet` / **Le Guichet** dans le tableau §2, inscription dans §9.1
(rail secondaire) et §9.2 (feuille mobile), courte sous-section §8.6 décrivant la cloche et la
salle, ordre de livraison mis à jour. Propriétaire : la coquille.

## Vérification par critère d'acceptation

| Critère | Preuve |
| :--- | :--- |
| 1. Rejeu sans doublon | spec `notifications.spec.ts` cas 3, et `on conflict do nothing` relu en revue |
| 2. Cloche = état serveur | `notification-bell.tsx` relu : aucun `useState`/`localStorage` ; E2E cas 4 |
| 3. Badge de charge sans requête | revue : `charges`/`nextChargeAt` déjà rendus par `/api/v1/charges`, calcul local |
| 4. E2E demande → lue → éteinte | `guichet.spec.ts`, joué sur le banc |
| 5. Salle fermée sans session | E2E cas 5 + garde `friends.tsx` copiée |
| 6. Purge 90 j | spec cas 6, site écrit dans le journal et la PR |
| 7. `kind` validé dans le code, pas de CHECK | spec cas 2 + `grep -c "check" 0016_notifications.ts` = 0 |
| 8. `ci:check` vert | commande du brief, base `hexamap_test_39` |

## Commandes (Docker uniquement)

```sh
docker compose -p hexamap --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_39' \
  dev bun run ci:check

docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
```

`-p hexamap` réutilise la pile déjà lancée et sa base : le brief nomme `hexamap_test_39`, qui vit
dans la pile `hexamap`, pas dans une pile `phase-39` neuve. Le montage de `dev` reste celui de ce
worktree, donc le code exécuté est bien celui de la phase.

## Impact

| Catégorie | Verdict | Traité en |
| :--- | :--- | :--- |
| Documentation | `.docs/02-database.md`, `DESIGN_SYSTEM.md` | 1, 2, 7 |
| Runtime | une table neuve, cinq points d'émission dans des transactions existantes, une salle, une cloche | 2, 4, 5 |
| Régression | les tests existants ne bougent pas ; `friends.spec.ts` et `market.spec.ts` couvrent déjà les transactions instrumentées | 4 |
| Architecture | une fonction d'émission unique, aucun compteur client, aucun SSE | 3, 5 |

## Règles du dépôt qui gouvernent cette phase

| Règle | Pourquoi |
| :--- | :--- |
| Spec-first | les cas de `notifications.spec.ts` s'écrivent et se voient rouges avant le service |
| Serveur autoritaire | le compteur de non-lues, la purge et l'idempotence sont serveur |
| Aucune table inventée | `notifications` passe par `.docs/02-database.md` avant la migration |
| Pas d'état React pour un compteur serveur | la cloche suit `unread`, jamais un incrément local |
| Aucun test ignoré | pas de `skip`, pas de délai relâché |
