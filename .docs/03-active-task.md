# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

## Statut

- **Phase** : 9 — Marché V1 (Achat & Vente directe)
- **État** : Terminée (implémentée, vérifiée, en attente de revue de PR)
- **Priorité** : P0
- **Mis à jour** : 2026-11-16
- **Branche** : `feat/phase-9-market-v1`, empilée sur `feat/phase-8-collection-tableau` (la phase 8 n'est pas encore fusionnée dans `main`)

---

## Objectif

Créer un hôtel des ventes sécurisé permettant aux joueurs de lister leurs cartes à un prix fixe et d'acheter les cartes des autres joueurs. Les transactions doivent être atomiques (ACID) pour prévenir la double dépense et la duplication de cartes.

À la fin de cette tâche :
- Le joueur peut mettre en vente une carte (qui devient `locked`).
- Le joueur peut annuler sa vente (la carte est déverrouillée).
- Le joueur peut acheter la carte d'un autre joueur si son solde `currency` est suffisant.
- Les mouvements de monnaie mettent à jour le solde des joueurs ET laissent une trace dans `currency_ledger`.
- Les interfaces `/market` (achat) et `/market/mine` (gestion) sont opérationnelles.

---

## À lire avant de coder

1. `.docs/01-architecture.md` (Section 9 - Périmètre strict V1).
2. Le schéma Kysely de la table `market_listings` et `currency_ledger`.

---

## Étapes

### 1. API - Mise en vente & Annulation (`apps/api/src/routes/market.ts`)
- [x] `POST /api/v1/market/listings` : Créer l'annonce (status `OPEN` — le contrat DB `0003_game` n'a pas de statut `ACTIVE`). Verrouiller la carte (`UPDATE user_cards SET locked = true WHERE id = ... AND user_id = ...`). Transaction SQL obligatoire.
- [x] `DELETE /api/v1/market/listings/:id` : Annuler l'annonce (status `CANCELLED`) et déverrouiller la carte (`locked = false`). Autorisé uniquement au vendeur.
- [x] Empêcher la mise en vente si la carte est déjà `locked` (ex: utilisée dans un Tableau).

### 2. API - Achat Transactionnel (`apps/api/src/routes/market.ts`)
- [x] `POST /api/v1/market/listings/:id/buy` : Exécuter la transaction d'achat entière dans un `db.transaction()` avec verrous (`.forUpdate()`).
- [x] Étapes internes de la transaction :
  1. Vérifier que l'acheteur n'est pas le vendeur.
  2. Débiter l'acheteur (vérifier solde > prix) et créditer le vendeur.
  3. Insérer 2 lignes d'audit dans `currency_ledger`.
  4. Changer le propriétaire de la carte (`user_id = acheteur, locked = false`).
  5. Marquer l'annonce comme `SOLD`.

### 3. API - Consultation
- [x] `GET /api/v1/market/listings` : Lister les cartes en vente (`status = OPEN`) avec pagination, filtres et relations (infos de la carte).
- [x] `GET /api/v1/market/listings/mine` : Annonces de l'appelant, tous statuts (nécessaire pour `/market/mine`).
- [x] Utiliser TypeBox (`t.Object`) pour typer les réponses Eden.

### 4. Frontend (`apps/web/src/routes/market/`)
- [x] Implémenter `/market` (`market.index.tsx`) et `/market/mine` (`market.mine.tsx`).
- [x] Gérer l'état de chargement et le rafraîchissement (invalidation TanStack Query) après un achat réussi.
- [x] Mettre à jour la jauge d'argent (currency) du layout après une transaction.

### 5. Qualité
- [x] `bun run typecheck`
- [x] `bun run lint`
- [x] `bun run build`
- [x] Écrire le test unitaire/intégration `packages/spec/src/market.spec.ts` simulant un double clic d'achat simultané (race condition) pour prouver l'efficacité du `.forUpdate()`.

---

## Critères d'acceptation
1. Impossible d'acheter sa propre carte.
2. Impossible de mettre en vente une carte assignée à un tableau (car `locked = true`).
3. L'argent est transféré correctement entre les comptes et tracé dans le ledger.
4. L'achat de la même carte à la même milliseconde par 2 personnes différentes ne génère qu'un seul gagnant ; le second reçoit une erreur 409 Conflict.

---

## Interdits
- Pas d'enchères (bidding).
- Pas de système d'échange direct de cartes (troc).
- Ne jamais mettre à jour un solde de monnaie sans écrire la justification dans le `currency_ledger` au sein de la même transaction.

---

## Journal — 2026-11-16

### Livré
- **API** : `apps/api/src/routes/market.ts` (plugin `routes.market`, préfixe `/market`, monté dans `app.ts`) — `GET /listings`, `GET /listings/mine`, `POST /listings`, `POST /listings/:id/buy`, `DELETE /listings/:id`. Réponses et entrées validées par TypeBox (`response` obligatoire) pour le typage Eden.
- **Migration** : `packages/db/migrations/0006_market_relist.ts` — remplace la contrainte `unique` globale sur `market_listings.user_card_id` par un index unique partiel `market_listings_open_card_idx ... where status = 'OPEN'`, seul moyen de remettre en vente une carte après annulation tout en conservant l'historique (audit). Enregistrée dans `packages/db/src/migrator.ts`, documentée dans `.docs/02-database.md`.
- **Spec** : `packages/spec/src/market.spec.ts` — 11 tests (401, verrouillage, carte verrouillée, carte d'autrui, annulation + interdiction, remise en vente, achat de sa propre carte, solde insuffisant, achat réussi avec 2 lignes de grand-livre, course concurrente, listes OPEN/mine).
- **Front** : `src/content/market.ts`, `src/lib/market.ts`, `src/routes/market.index.tsx`, `src/routes/market.mine.tsx`, plus deux liens de navigation et une jauge de solde dans `src/routes/__root.tsx`.

### Sécurité concurrentielle
`POST /listings/:id/buy` encapsule tout dans `db.transaction().execute(async (trx) => { ... })` :
1. `SELECT ... FROM market_listings WHERE id = :id FOR UPDATE` — la ligne d'annonce sérialise deux acheteurs ; le second voit `SOLD` et reçoit `409 LISTING_NOT_OPEN`.
2. Verrou déterministe des deux portefeuilles en une requête (`WHERE id IN (acheteur, vendeur) ORDER BY id FOR UPDATE`) : évite tout interblocage entre achats croisés.
3. `SELECT ... FROM user_cards WHERE id = :id FOR UPDATE` avant transfert.
4. Débit acheteur, crédit vendeur, **deux** lignes `currency_ledger` (`MARKET_BUY` −prix, `MARKET_SELL` +prix), transfert de la carte (`user_id`, `locked = false`, `source = 'MARKET'`), annonce `SOLD` + `buyer_id` + `sold_at` : le tout dans la même transaction.

### Vérifications (Docker)
- `bun test packages/spec` → **111 pass / 0 fail** (dont 11 pour le marché).
- `bun run typecheck` → 0 erreur (5 workspaces).
- `bun run lint` → `Checked 93 files. No fixes applied.`
- `bun run build` → API + web OK (`market.index` et `market.mine` présents dans le bundle).

### Écarts assumés par rapport au brief
1. **Statut `OPEN` et non `ACTIVE`** : `.docs/02-database.md` et la migration `0003_game` imposent `OPEN`/`SOLD`/`CANCELLED` (règle « aucune table/colonne inventée »).
2. **`DELETE` répond 200 `{ listing }`** au lieu de 204 : le client Eden conserve ainsi le statut `CANCELLED` sans requête supplémentaire. Le code `204` de la convention `apps/api/AGENTS.md` reste applicable aux suppressions sans corps.
3. **Migration 0006** : nécessaire car la contrainte `unique` initiale interdisait la remise en vente ; le contrat de données a été mis à jour en premier, conformément à la règle de migration.
4. **Jauge de solde** : elle n'existait nulle part auparavant ; ajoutée dans l'en-tête (`Solde : N crédits`), rafraîchie par invalidation de `sessionQueryKey` après un achat ou une mise en vente.

### Suite
- Ouvrir la PR vers `main` **après** la fusion de `feat/phase-8-collection-tableau` (empilement), ou rebaser la branche sur `main` une fois la phase 8 fusionnée.
- Non fait volontairement : aucun commit (consigne « ne pas commiter sans demande explicite »).