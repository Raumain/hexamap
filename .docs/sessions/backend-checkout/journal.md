# Journal — Phase 30.2 : Checkout et webhook

## 2026-11-20 — Le crédit ne vient que du webhook

**Ce qui est livré.** Le dos de la boutique, sans interface : `POST /api/v1/shop/checkout`
crée une session Checkout et rend une URL ; `POST /api/v1/shop/webhook` vérifie la signature
sur le **corps brut** et crédite ; `GET /api/v1/shop/orders/:id` lit le résultat. Sans clés
Stripe, l'ensemble répond `503 SHOP_DISABLED` et l'application démarre quand même.

**Le piège n°1, traité par un test, pas par une intuition.** Le cas 4 de `shop.spec.ts` signe
un corps JSON **volontairement mal espacé** — `{ "type" : …,\n  "sessionId" : … }` — puis le
poste tel quel. Si Elysia avait parsé puis re-sérialisé le corps, l'espacement changerait et la
signature tomberait : le test serait rouge pour la bonne raison. Le hook `onParse({ as: 'scoped' })`
rend `request.text()` et rien d'autre. Aucune vérification n'a été désactivée.

**L'idempotence n'est pas une garde applicative.** `insertInto('currency_ledger')…
.onConflict((oc) => oc.doNothing()).returning('id')` : la ligne de grand-livre et l'incrément de
`"user".currency` vivent dans la même transaction, sous `FOR UPDATE` du compte, et la mise à jour
du solde n'a lieu que si l'insertion a réellement rendu une ligne. Deux livraisons simultanées du
même événement se sérialisent sur le verrou du compte, puis la seconde voit la ligne. Le cas 5 le
prouve : deux `POST` identiques, `200` deux fois, **une** ligne, solde `500`.

**Deux écarts assumés, tous deux consignés en revue.**

1. `GET /shop/orders/:id` doit distinguer « jamais payée » (`PENDING`), « payée par moi »
   (`CREDITED`) et « payée par un autre » (`404`), alors que le contrat ne prévoit **aucune
   table de commandes**. La route lit donc `user_id` sur la ligne `PURCHASE:<id>` et compare :
   le montant rendu reste celui du joueur courant, et un identifiant inconnu reste `PENDING`,
   ce qui n'apprend rien puisqu'il n'existe pas.
2. `charge.refunded` est déjà résolu côté Stripe (session retrouvée par `payment_intent`) mais
   `applyPaymentEvent` ignore l'événement : les remboursements sont la phase 30.3, et le brief
   interdit explicitement d'y toucher. Le webhook répond `200` sans écrire.

**Ce qui n'a pas bougé.** Aucune migration (le numéro réservé est `-`), aucune table, aucune
colonne, aucun motif de `currency_ledger` nouveau : `0013_shop` portait déjà
`currency_ledger_purchase_uniq` et `SHOP_DAILY_PURCHASE_CAP`. `.docs/03-active-task.md`,
`ROADMAP.md`, `.docs/01-architecture.md` et `.docs/02-database.md` sont intacts.

**Une dépendance ajoutée, justifiée.** `stripe@^18.0.0` (résolu `18.5.0`) entre dans
`apps/api/package.json` : c'est le SDK officiel, sans alternative raisonnable pour
`constructEvent` et `checkout.sessions.create`. Il n'entre pas dans le bundle du front, et le
client est créé paresseusement — aucune clé n'est lue au chargement du module.

**Vérification (Docker uniquement)**

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_302' \
  dev bun run ci:check
  [hexamap] ✓ 1/4 Lint
  [hexamap] ✓ 2/4 Typecheck
  [hexamap] ✓ 3/4 Base de données
  [hexamap] ✓ 4/4 Spécifications
  292 pass, 0 fail, 1740 expect() calls, Ran 292 tests across 18 files
  [hexamap] ✓ Gatekeeper vert.
```

**Portée** : `packages/shared/src/payments.ts` (neuf), `packages/shared/src/index.ts`,
`apps/api/src/services/stripe-payments.ts` (neuf), `apps/api/src/routes/shop.ts` (neuf),
`apps/api/src/app.ts`, `apps/api/src/env.ts`, `apps/api/package.json` + `bun.lock`,
`docker-compose.prod.yml`, `packages/spec/src/helpers/fake-payment-provider.ts` (neuf),
`packages/spec/src/shop.spec.ts` (neuf). Aucune migration, aucun schéma, aucun fichier de
`.docs` hors ce dossier de session.
