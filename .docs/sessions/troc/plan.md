---
objective: "Le troc 1↔1 est livré : table `trade_offers` migrée, module API `/api/v1/trades` avec acceptation atomique, garde du marché, offres reçues dans Le Guichet, proposition depuis Le Cartel, et spécifications + E2E à deux comptes vertes."
status: done
---

# Plan: Phase 40 — Le Troc

Source: brief de session `Phase 40 — Le Troc` + `.docs/07-roadmap-v2.md` §4 (Phase 40) +
`.docs/02-database.md` §4.5/§4.9/§4.10 + `.docs/01-architecture.md` §2.5.

## Décisions d'implémentation (tranchées ici, citées dans le journal)

| Sujet | Décision | Raison |
| :--- | :--- | :--- |
| Durée de vie d'une offre | `TRADE_OFFER_TTL_MS = 7 j` | Un troc est une conversation ; 7 jours laissent le temps de répondre sans immobiliser une carte un mois. Constante dans `packages/shared/src/trade.ts`, jamais en dur. |
| Qui fait tourner l'expiration | Balayage paresseux **borné à l'utilisateur**, `expireOffersForUser(exec, userId)` | Le runtime n'a aucun ordonnanceur (pas de cron, pas de worker). Un balayage global à chaque lecture serait un `UPDATE` non borné sur toute la table. Le balayage par utilisateur est O(offres de cet utilisateur). |
| Coût du balayage paresseux | Une offre expirée garde son index partiel jusqu'à ce qu'une partie agisse ; elle bloque donc la mise en marché de la carte. **Mitigation** : `POST /market/listings` appelle le balayage avant sa garde, donc le propriétaire qui veut vendre n'est jamais bloqué par une offre morte. | Le seul cas où l'immobilisation se voit serait celui où un tiers veut la carte : impossible, seule une partie peut l'engager. |
| Journalisation anti-collusion | **Aucune table nouvelle.** `trade_offers` est elle-même le journal : paire de comptes, les deux cartes, l'horodatage de proposition et de réponse. | Limite assumée, écrite au journal et dans la PR : on peut relire *qui* a échangé *quoi* avec *qui* et *quand*, on ne peut pas détecter un schéma de ferme de comptes. Aucune colonne ni motif de `currency_ledger` inventé. |
| Exclusivité | Deux index uniques partiels `where status = 'PENDING'`, un sur `offered_card_id`, un sur `requested_card_id` | Le second interdit aussi qu'une même carte soit *demandée* par deux offres simultanées. Simplification assumée : elle protège l'acceptation (une seule offre peut gagner) au prix d'un refus `CARD_ALREADY_IN_TRADE` que le joueur comprend. |
| `locked` | Jamais posé par le troc ; vérifié `= false` à la proposition | `locked` reste réservé à la vente (§2.5). Le troc et l'annonce sont exclusifs par deux gardes symétriques, pas par une colonne partagée. |
| Notifications | `TRADE_OFFER` (récepteur), `TRADE_ACCEPTED` (deux parties), `TRADE_DECLINED` (proposeur), `TRADE_EXPIRED` (deux parties), émises **dans** la transaction | Les quatre `kind` existent depuis la phase 39 ; aucune constante nouvelle. |

## Phases

| #   | Phase | Fichier(s) | Depends on |
| --- | --- | --- | --- |
| 1 | Contrat de données | `.docs/02-database.md` (§2 statut Contrat, nouvelle §4.11) | none |
| 2 | Module pur partagé | `packages/shared/src/trade.ts`, `packages/shared/src/index.ts` | 1 |
| 3 | Spécification rouge | `packages/spec/src/trade.spec.ts` | 2 |
| 4 | Migration + schéma | `packages/db/migrations/0017_trade_offers.ts`, `packages/db/src/migrator.ts`, `packages/db/src/schema.ts` | 3 |
| 5 | Service du troc | `apps/api/src/services/trade.ts` | 4 |
| 6 | Routes du troc | `apps/api/src/routes/trades.ts`, `apps/api/src/app.ts` | 5 |
| 7 | Garde du marché | `apps/api/src/routes/market.ts` | 5 |
| 8 | Contrat passé à Migrée | `.docs/02-database.md` §2 | 4 |
| 9 | Client web + contenu | `apps/web/src/lib/trade.ts`, `apps/web/src/content/guichet.ts` | 6 |
| 10 | Interface | `apps/web/src/components/trade/propose-trade-dialog.tsx`, `apps/web/src/routes/card.$cardId.tsx`, `apps/web/src/routes/guichet.tsx` | 9 |
| 11 | E2E à deux comptes | `packages/e2e/fixtures/trade-fixture.ts`, `packages/e2e/tests/trade.spec.ts`, `packages/e2e/seed` | 6 |
| 12 | Preuves | `ci:check` + banc E2E | toutes |

## Contrat de données (phase 1, figé ici et recopié dans `.docs/02-database.md`)

```sql
create table if not exists trade_offers (
  id uuid primary key default gen_random_uuid(),
  proposer_id text not null references "user" ("id") on delete cascade,
  receiver_id text not null references "user" ("id") on delete cascade,
  offered_card_id uuid not null references user_cards (id) on delete cascade,
  requested_card_id uuid not null references user_cards (id) on delete cascade,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  expires_at timestamptz not null,
  check (proposer_id <> receiver_id),
  check (offered_card_id <> requested_card_id)
);

create index if not exists trade_offers_receiver_idx
  on trade_offers (receiver_id, status, created_at desc);
create index if not exists trade_offers_proposer_idx
  on trade_offers (proposer_id, status, created_at desc);

create unique index if not exists trade_offers_offered_pending_idx
  on trade_offers (offered_card_id) where status = 'PENDING';
create unique index if not exists trade_offers_requested_pending_idx
  on trade_offers (requested_card_id) where status = 'PENDING';
```

## Surface HTTP (`/api/v1/trades`, groupe protégé)

| Route | Corps / requête | Réponses |
| :--- | :--- | :--- |
| `POST /` | `{ offeredCardId, requestedCardId }` | `201 { offer }`, `400 TRADE_SELF_OFFER`, `403 CARD_NOT_OWNED`, `404 CARD_NOT_FOUND`, `409 CARD_LOCKED` / `CARD_ALREADY_IN_TRADE` |
| `GET /?box=received\|sent` | — | `200 { offers: [...] }` |
| `POST /:id/accept` | — | `200 { offer }`, `403 NOT_TRADE_RECEIVER`, `404`, `409 TRADE_OFFER_NOT_PENDING` / `TRADE_CARD_MOVED` |
| `POST /:id/decline` | — | `200 { offer }`, `403 NOT_TRADE_RECEIVER`, `409 TRADE_OFFER_NOT_PENDING` |
| `POST /:id/cancel` | — | `200 { offer }`, `403 NOT_TRADE_PROPOSER`, `409 TRADE_OFFER_NOT_PENDING` |

Codes ajoutés à `market.ts` : `CARD_IN_TRADE` (409) à la création d'annonce.

## Vérification de chaque critère

| Critère | Preuve |
| :--- | :--- |
| 1. Double acceptation → `409`, aucune carte ne bouge | `packages/spec/src/trade.spec.ts` : deux `POST /:id/accept`, le second `409`, `user_id` des deux cartes inchangés |
| 2. Expiration rend les cartes libres, voie écrite | même spec : `expires_at` forcé dans le passé, `GET /trades` puis re-proposition acceptée ; décision écrite au journal |
| 3. Carte `PENDING` hors marché et refusée | même spec : `POST /market/listings` → `409 CARD_IN_TRADE`, puis `GET /market/listings` ne la contient pas |
| 4. E2E deux comptes | `packages/e2e/tests/trade.spec.ts` : proposition, acceptation, `/collection` des deux côtés |
| 5. Cinq statuts + statut inconnu | `isTradeStatus` / `canTransitionTrade` dans la même spec, plus `assertTradeStatus` sur une valeur forgée |
| 6. Les quatre `kind` dans Le Guichet | même spec : notifications émises ; E2E : pastilles visibles |
| 7. Limite anti-collusion écrite | `journal.md` + corps de PR |
| 8. `ci:check` vert | commande Docker du brief |

## Impact

| Catégorie | Verdict | Phase |
| :--- | :--- | :--- |
| Runtime | Nouvelle table, nouveau module de routes, une garde ajoutée au marché | 4–7 |
| Régression | Le marché gagne un `409 CARD_IN_TRADE` ; aucun cas existant ne crée d'offre, donc aucun cas gelé ne change de comportement | 7 |
| Architecture | Aucune migration hors `0017`, aucun jeton CSS, aucun `locked` | — |
| Documentation | `.docs/02-database.md` (Contrat → Migrée) uniquement ; `.docs/03-active-task.md`, `ROADMAP.md`, `01`, `02` hors § concernée : intouchés | 1, 8 |

## Rules

| Rule | Why |
| :--- | :--- |
| Spec d'abord, jamais modifier un cas existant | `AGENTS.md` §2 ; le cas `CARD_IN_TRADE` est neuf, il ne réécrit pas `market.spec.ts` |
| Tout dans Docker | `AGENTS.md` §1 |
| Une seule migration : `0017_trade_offers` | brief, fichiers partagés |
| Le serveur est autoritaire | possession et transfert vérifiés sous `FOR UPDATE` |
| Aucun `skip`, aucun délai relâché | `AGENTS.md` §9 |
