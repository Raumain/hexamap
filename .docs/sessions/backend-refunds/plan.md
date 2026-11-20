---
objective: "Un remboursement Stripe écrit la contrepartie négative PURCHASE_REFUND:<session> proportionnelle et plafonnée à ce qui a été crédité, un achat au-delà du plafond quotidien est refusé avant Stripe, et six cas de spécification le prouvent sans réseau."
status: pending
---

# Plan: Phase 30.3 — Remboursements, plafond quotidien, tests du provider

Source: brief de session « Phase 30.3 » (paramètres : branche `feat/phase-30-3-refunds`, migration
réservée `-`, base `agents/boutique-wave-2`), `ROADMAP.md` §2.B étapes 30.5, 30.7, 30.8,
`.docs/02-database.md` §4.1 et §4.6, `.docs/01-architecture.md` §2.8.

## Ce que l'existant établit (lu, pas supposé)

| Fait | Preuve |
| --- | --- |
| `charge.refunded` est **déjà** résolu côté provider (session depuis `payment_intent`) et rendu en `PURCHASE_REFUNDED` | `apps/api/src/services/stripe-payments.ts:95-117` |
| `applyPaymentEvent` ignore tout ce qui n'est pas `PURCHASE_COMPLETED` | `apps/api/src/routes/shop.ts:89-93` |
| `PurchaseRefundedEvent` porte aujourd'hui `userId`, `amountTotal`, `packKey` nullables — ni `paymentIntentId`, ni `amountRefundedCents`, ni `originalAmountCents` | `packages/shared/src/payments.ts:24-31` |
| `PURCHASE_REFUND:<ref>` est déjà dans la liste fermée, et l'index partiel **ne le couvre pas** (deux remboursements identiques écrivent deux lignes) | `.docs/02-database.md` §4.6 ; `packages/spec/src/ledger.spec.ts:93-100` |
| `SHOP_DAILY_PURCHASE_CAP = 12000` est semé par `0013_shop` et verrouillé | `packages/db/migrations/0013_shop.ts:25` ; `packages/spec/src/ledger.spec.ts:101-107` |
| Aucun lecteur de `SHOP_DAILY_PURCHASE_CAP`, aucune fonction `refundEcus`/`dailyCapReached` n'existe | `grep` sur tout le dépôt : zéro occurrence |
| `apps/api/src/services/shop.ts` n'existe pas | glob `apps/api/src/services/*` |
| Le fake ne reconnaît que `checkout.session.completed` | `packages/spec/src/helpers/fake-payment-provider.ts:52` |
| `@hexamap/api/services/*` est déjà une sous-entrée d'export : les fonctions pures sont importables par `packages/spec` sans plomberie | `apps/api/package.json:10` |
| `ci:check` réécrit `DATABASE_URL = TEST_DATABASE_URL` pour l'étape des specs | `scripts/ci-check.ts:56` |

## Phases

| #   | Phase | Fichiers | Depends on |
| --- | --- | --- | --- |
| 1 | Contrat partagé du remboursement | `packages/shared/src/payments.ts` | none |
| 2 | Spécifications rouges (six cas + le fake étendu) | `packages/spec/src/helpers/fake-payment-provider.ts`, `packages/spec/src/shop.spec.ts` | 1 |
| 3 | Fonctions pures et lecture du plafond | `apps/api/src/services/shop.ts` (neuf), `apps/api/src/services/config.ts` | 1 |
| 4 | Handler de remboursement et garde de plafond | `apps/api/src/routes/shop.ts` | 1, 2, 3 |
| 5 | Provider réel : événement de remboursement complet | `apps/api/src/services/stripe-payments.ts` | 1 |
| 6 | Documentation du contrat | `.docs/02-database.md` §4.6, `.docs/01-architecture.md` §2.8 | 1 à 5 |
| 7 | Vérification | `ci:check` | 1 à 6 |

Ordre d'exécution : 1 (type) → 2 (specs, **vues rouges**) → 3 → 5 → 4 (vert) → 6 → 7.

## External sources

| URL | What it settled |
| --- | --- |
| none | Aucune lecture externe : le contrat et le mapping `charge.refunded` sont déjà écrits dans le dépôt (phase 30.2). |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| Runtime | **Faible** : une branche `PURCHASE_REFUNDED` dans `applyPaymentEvent` et une lecture `game_config` dans `/shop/checkout`. Aucun appel réseau nouveau, aucun changement du provider réel hormis des champs d'événement. | 4, 5 |
| Regression | **Moyen** : `PurchaseRefundedEvent` change de forme ; le variant n'est consommé nulle part aujourd'hui (`grep` : `PURCHASE_REFUNDED` n'apparaît que dans `payments.ts` et `stripe-payments.ts`), donc aucun cas de 30.2 ne casse. Le `describe` existant de `shop.spec.ts` et ses huit cas restent intacts — les nouveaux cas vivent dans de nouveaux `describe`. | 1, 2, 4 |
| Architecture | **Additive** : aucune table, aucun index, aucune colonne, aucune migration (numéro réservé `-`). Deux fonctions pures sortent de la route pour être testables sans base. | 3 |
| Documentation | **Deux précisions demandées par le brief** : `.docs/02-database.md` §4.6 (`provider_ref` = `session.id`, remboursement proportionnel) et `.docs/01-architecture.md` §2.8 (plafond quotidien, remboursement, aucune table). `ROADMAP.md` et `.docs/03-active-task.md` restent intouchés. | 6 |

## Rules

| Rule | Why it applies |
| --- | --- |
| Serveur autoritaire (`.docs/01-architecture.md` §4.1) | Les écus remboursés se déduisent du `delta` réellement crédité et du montant Stripe, jamais d'un chiffre fourni par le client. |
| Liste fermée des motifs (§4.6) | Deux motifs seulement : `PURCHASE:<session.id>` et `PURCHASE_REFUND:<session.id>`. Aucun préfixe inventé. |
| Idempotence du remboursement | Le rejeu ne s'appuie **pas** sur un index (il ne couvre pas `PURCHASE_REFUND:%`) mais sur `alreadyRefunded = -Σ PURCHASE_REFUND:<session>` : un second événement identique calcule `toReverse = 0`. |
| Tout dans Docker (AGENTS.md règle 1) | `bun`, `tsc`, `bun test` passent par `docker compose --profile tools run --rm dev`. |
| Spec-first (AGENTS.md règle 2) | Les six cas de `shop.spec.ts` sont écrits et vus rouges avant `routes/shop.ts`. |
| Migration réservée `-` | Aucune migration, aucun numéro pris, aucun statut de table à changer dans `.docs/02-database.md` §2. |
| Fichiers partagés | `config.ts` : `readShopConfig` ajouté en fin de fichier. `shop.spec.ts` : nouveaux `describe` ajoutés après les huit cas existants, aucun cas existant réordonné ni modifié. |

## Decisions

| Decision | Why |
| --- | --- |
| `PurchaseRefundedEvent` **perd** `userId` et `amountTotal`, gagne `paymentIntentId`, `amountCents`, `amountRefundedCents`, `originalAmountCents` | Le handler résout le propriétaire depuis la ligne `PURCHASE:<session>` du grand-livre : c'est la seule source qui prouve qu'un achat a été crédité. Un `userId` de métadonnées pourrait désigner un compte sans ligne, et « session inconnue » deviendrait un cas ambigu. |
| Le remboursement est calculé sur `amount_refunded` **cumulatif** | En utiliser le delta ferait diverger deux remboursements partiels successifs (piège du brief). `amountCents` reste informatif. |
| `refundEcus` et `dailyCapReached` vivent dans `apps/api/src/services/shop.ts`, purs | Testables sans base ; `@hexamap/api/services/*` est déjà exporté, donc `packages/spec` les importe sans plomberie. |
| Solde négatif : ligne écrite, solde ramené à `0`, `SHOP_REFUND_NEGATIVE` journalisé | Un remboursement a eu lieu : le grand-livre doit le dire. Refuser l'écriture ferait mentir la comptabilité. Aucun gel de compte n'est implémenté (aucune colonne de contrat ne le porte) — écart consigné. |
| Le plafond quotidien se lit **avant** l'appel Stripe, hors transaction | Verrouiller `"user"` pendant un aller-retour réseau tiendrait une transaction ouverte sur une latence externe. La somme porte sur les `PURCHASE:%` crédités depuis minuit UTC : un paiement déjà effectué reste crédité par le webhook. |
| Le fake signe et vérifie en mémoire, et produit un remboursement **sans** checkout préalable | Le cas « session inconnue » et « remboursement avant achat » exigent de forger l'événement sans passer par la création de session. |
