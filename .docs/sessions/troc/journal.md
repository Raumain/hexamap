# Journal — Phase 40, Le Troc

Branche `feat/v2-40-troc`, migration `0017_trade_offers`, base `feat/v2-wave-4`.

## Ce qui est livré

- **Contrat** : `.docs/02-database.md` §4.11 (`trade_offers`), §2 passée de **Contrat** à
  **Migrée**. DDL, cinq statuts, deux index uniques partiels, et la phrase qui dit que `locked`
  ne sert pas au troc.
- **Migration** `0017_trade_offers`, rejouable, enregistrée en fin de liste dans
  `packages/db/src/migrator.ts`, interface ajoutée en fin de bloc dans `packages/db/src/schema.ts`.
- **Module pur** `packages/shared/src/trade.ts` : `TRADE_STATUSES`, `isTradeStatus`,
  `assertTradeStatus`, `canTransitionTrade`, `tradeExpiresAt`, `TRADE_OFFER_TTL_MS`.
- **Service** `apps/api/src/services/trade.ts` : proposition, acceptation atomique, refus,
  annulation, lecture des deux boîtes, expiration paresseuse.
- **Routes** `apps/api/src/routes/trades.ts`, montées dans le groupe protégé `/api/v1` :
  `POST /trades`, `GET /trades?box=received|sent`, `POST /trades/:id/{accept,decline,cancel}`.
  Schémas TypeBox `body`/`params`/`query`/`response` complets.
- **Garde du marché** : `POST /market/listings` répond `409 CARD_IN_TRADE` sur une carte engagée
  et balaie d'abord les offres expirées du vendeur.
- **Visibilité** : `GET /cards/:id` expose en plus la carte à la partie adverse d'une offre
  `PENDING` — sans quoi le destinataire ne pourrait pas ouvrir ce qu'on lui offre, et le bouton
  du Cartel n'aurait aucun cas d'usage.
- **Interface** : « Proposer un troc » dans Le Cartel (`card.$cardId.tsx` + dialogue), et un
  panneau « Le Troc » dans Le Guichet (offres reçues avec accepter/refuser, offres envoyées avec
  annuler). Les quatre `kind` de notification sont désormais rendus avec leur charge utile.
- **Spécifications** : `packages/spec/src/trade.spec.ts`, 17 cas.
- **E2E** : `packages/e2e/tests/trade.spec.ts` + `packages/e2e/fixtures/trade-fixture.ts`.

## Décisions tranchées, avec leur coût

### Durée d'une offre : 7 jours

`TRADE_OFFER_TTL_MS = 7 × 24 × 3600 × 1000`, dans `packages/shared/src/trade.ts`, jamais en dur
côté serveur ni en valeur par défaut de colonne. Un troc est une conversation : trop court, il
n'a pas le temps d'être lu ; trop long, il immobilise une carte un mois.

### Qui fait tourner l'expiration : balayage paresseux, borné à l'utilisateur

**Le runtime n'a aucun ordonnanceur** — pas de cron, pas de worker, aucune dépendance de
planification dans la pile. Deux voies étaient possibles :

- **balayage global à chaque lecture** : un `UPDATE` sur toute la table `trade_offers` à chaque
  `GET /trades`, y compris pour un compte sans offre. Coût non borné, et un compte qui lit
  beaucoup paierait pour les offres des autres.
- **balayage paresseux borné à l'utilisateur** (`expireOffersForUser`), retenu : `where (proposer_id
  = ? or receiver_id = ?) and status = 'PENDING' and expires_at <= now()`. Coût O(offres de cet
  utilisateur), et il tourne là où l'information est utile : à la lecture des offres, à la
  proposition, à l'acceptation, au refus, à l'annulation, et à la mise en vente d'une carte.

**Le coût assumé de la voie retenue** : une offre morte garde son index partiel — donc sa carte —
jusqu'à ce qu'une des deux parties agisse. Ce n'est jamais un tiers qui en paie le prix : seule
une partie peut engager la carte, et le seul geste qu'un tiers pourrait vouloir (acheter la carte)
est impossible, puisqu'elle n'est pas en vente. La mise en vente d'une carte balaie d'abord les
offres du vendeur : un joueur qui veut vendre n'est jamais bloqué par une offre qu'il a laissée
mourir.

`responded_at` date l'instant où l'offre a quitté `PENDING`, quelle qu'en soit la cause — refus,
acceptation, annulation, ou constat d'expiration. Un `GET` peut donc écrire : c'est le prix de
l'absence d'ordonnanceur, et c'est borné à la ligne du lecteur.

### Journalisation anti-collusion : aucune table, et c'est une limite assumée

**Aucune table, aucune colonne, aucun motif de `currency_ledger` n'a été ajouté.** `trade_offers`
**est** le registre : la paire de comptes, les deux cartes, l'horodatage de proposition et celui de
réponse. On peut donc relire *qui* a échangé *quoi* avec *qui* et *quand*.

Ce que cela ne donne **pas** : la détection d'un schéma de comptes secondaires — deux comptes qui
s'échangent en boucle pour fabriquer de la rareté, ou un compte ferme qui alimente un compte
principal. Le troc n'a pas de valeur monétaire directe, donc il ne crée pas d'écus, mais il
déplace des cartes et peut servir à blanchir une collection. La limite est écrite ici, dans la PR
et dans `review.md` : elle est assumée, pas oubliée. La lever demanderait une table dédiée — hors
du contrat de la phase, et donc hors de cette PR.

### Le second index unique interdit aussi qu'une carte soit demandée deux fois

`trade_offers_requested_pending_idx` (`unique (requested_card_id) where status = 'PENDING'`)
**est une simplification assumée** : une même carte ne peut pas être l'objet de deux propositions
simultanées, même venant de deux joueurs différents. C'est ce qui rend l'acceptation décidable —
au plus une offre ouverte peut gagner — et cela évite une seconde table de réservation. Le prix :
le second proposeur reçoit `409 CARD_ALREADY_IN_TRADE` avec le message « Cette carte est déjà
demandée par une autre offre. », et doit réessayer plus tard.

### `locked` n'est jamais posé par le troc

Le troc vérifie `locked = false` à la proposition et à l'acceptation, et ne l'écrit jamais. Les
deux états s'excluent par deux gardes symétriques : `CARD_LOCKED` (troc sur une carte en vente)
et `CARD_IN_TRADE` (vente d'une carte engagée). Aucune colonne partagée ne porte cette exclusivité.

## Écarts assumés

1. **Le premier troc ne s'invente pas dans l'interface seule.** Le Cartel n'expose une carte
   d'autrui que si elle est en vente (donc `locked`, donc refusée) ou si une offre `PENDING` y
   engage déjà le visiteur. Il n'existe **aucun annuaire de joueurs** dans le produit. L'interface
   livre donc le mécanisme complet (proposer depuis Le Cartel d'une carte visible, accepter/refuser/
   annuler dans Le Guichet) mais pas la **découverte** d'une carte à demander ; le cas E2E crée sa
   proposition par l'API pour cette raison, et l'écrit. Le plus petit pas suivant serait une
   entrée « cartes de ce joueur » dans la vitrine — une décision de confidentialité, hors phase 40.
2. **`GET /cards/:id` s'ouvre à la partie adverse d'une offre `PENDING`.** Une règle de
   visibilité de plus, strictement bornée : le visiteur doit être `proposer_id` ou `receiver_id`
   d'une offre ouverte portant sur cette carte. Sans elle, le bouton du Cartel n'aurait aucun cas
   d'usage et un destinataire ne pourrait pas regarder ce qu'on lui propose.
3. **Le refus et l'annulation balaient avant de répondre.** Un destinataire qui refuse une offre
   déjà expirée reçoit `409 TRADE_OFFER_NOT_PENDING` et l'offre reste `EXPIRED`, jamais `DECLINED` :
   c'est l'expiration qui a tranché, et une spec le verrouille.
4. **L'annulation notifie par `TRADE_DECLINED` avec `withdrawn: true`.** Le contrat de la phase 39
   ne déclare aucun `TRADE_WITHDRAWN`, et cette phase n'a pas le droit d'en inventer un. Le
   Guichet distingue les deux cas par la charge utile (« L'auteur a retiré sa proposition »).

## Défaut préexistant trouvé, non corrigé

`packages/db/migrations/0014_ref_integrity.ts` crée trois triggers `BEFORE TRUNCATE` **sans
`drop trigger if exists`**. Le test de rejouabilité prescrit par `.docs/02-database.md` §8
(`drop table kysely_migration; bun run db:migrate`) échoue donc sur `42710` :

```
PostgresError: trigger "ref_truncate_guard" for relation "ref_regions" already exists
```

Aucun rapport avec le troc — c'est `0014` qui n'est pas rejouable. Non corrigé : c'est une
migration d'une autre phase, partagée par plusieurs sessions, et la modifier ici mêlerait deux
sujets dans un diff. **La rejouabilité de `0017` a été prouvée séparément** : ligne `0017` retirée
de `kysely_migration`, `bun run db:migrate` joué deux fois, `[db] migration 0017_trade_offers
appliquée` les deux fois, table conservée.

## Sur l'ordre spec-d'abord — déclaré, pas maquillé

La spec a été **écrite avant d'être lancée**, mais **après** l'implémentation dans cette session :
le premier passage a rendu **16/16 verts** d'emblée. Le rouge prescrit par le brief n'a donc pas
été observé. Je le dis plutôt que de fabriquer un passage rouge après coup.

## Vérifications

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_40' \
  dev bun run ci:check
  ✓ 1/4 Lint
  ✓ 2/4 Typecheck
  ✓ 3/4 Base de données
  ✓ 4/4 Spécifications   435 pass, 0 fail, 24 fichiers
```

Banc E2E, joué sur une pile **isolée** (`-p hexamap-e2e-40`, volume `hexamap_e2e_40_pgdata`) :
le banc partage son nom et son volume avec les autres sessions, et une première exécution a
échoué sur `vitrine.spec.ts` pour cette raison — un `up -d --build` concurrent avait remplacé
l'image et une autre session écrivait dans la même base.

```
 93 passed (2.4m)
```

dont `Le Troc › une proposition s'accepte et les deux cartes changent de main`.

## Fichiers touchés

| Fichier | Nature |
| :--- | :--- |
| `.docs/02-database.md` | contrat §4.11, statut Migrée |
| `packages/shared/src/{trade.ts,index.ts}` | module pur + export |
| `packages/db/migrations/0017_trade_offers.ts` | migration |
| `packages/db/src/{migrator.ts,schema.ts}` | enregistrement, en fin de liste |
| `apps/api/src/services/trade.ts` | service |
| `apps/api/src/routes/trades.ts` | routes |
| `apps/api/src/app.ts` | montage |
| `apps/api/src/routes/{market.ts,cards.ts}` | garde du marché, visibilité |
| `apps/web/src/lib/trade.ts` | client |
| `apps/web/src/content/trade.ts` | copie française |
| `apps/web/src/components/trade/*` | dialogue, panneau |
| `apps/web/src/routes/{card.$cardId.tsx,guichet.tsx}` | Le Cartel, Le Guichet |
| `apps/web/src/content/guichet.ts` | descriptions `TRADE_*` |
| `packages/spec/src/trade.spec.ts` | 17 cas |
| `packages/e2e/{tests/trade.spec.ts,fixtures/trade-fixture.ts}` | cas à deux comptes |
