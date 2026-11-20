---
objective: "Le dos de la boutique : une session Checkout créée côté serveur, un webhook vérifié sur le corps brut, et une écriture de currency_ledger idempotente — la route de checkout ne crédite jamais."
status: pending
---

# Plan: Phase 30.2 — Checkout et webhook (le crédit ne vient que du webhook)

Source: `.docs/03-active-task.md` (Phase 30.2, brief de session), `ROADMAP.md` §2.B étapes 30.3 et
30.4, `.docs/02-database.md` §4.6, `.docs/01-architecture.md` §2.8.

## Phases

| #   | Phase                     | File                                                             | Depends on |
| --- | ------------------------- | ---------------------------------------------------------------- | ---------- |
| 1   | Interface pure partagée   | `packages/shared/src/payments.ts`, `packages/shared/src/index.ts` | none       |
| 2   | Spécifications (rouges)   | `packages/spec/src/helpers/fake-payment-provider.ts`, `packages/spec/src/shop.spec.ts` | 1          |
| 3   | Provider Stripe           | `apps/api/src/services/stripe-payments.ts`, `apps/api/package.json` | 1          |
| 4   | Routes boutique           | `apps/api/src/routes/shop.ts`                                     | 1, 3       |
| 5   | Câblage application       | `apps/api/src/app.ts`, `apps/api/src/env.ts`                      | 3, 4       |
| 6   | Déploiement               | `docker-compose.prod.yml`                                         | none       |
| 7   | Vérification              | `ci:check`                                                        | 1 à 6      |

## External sources

| URL | What it settled |
| --- | --------------- |
| `https://docs.stripe.com/webhooks/signature` | `constructEvent(rawBody, signature, secret)` exige le corps **brut** ; un corps parsé invalide la signature. |
| `https://elysiajs.com/essential/life-cycle.html#parse` | `onParse` remplace la lecture/validation du corps ; sa valeur de retour devient `body`. Un hook `{ as: 'scoped' }` ne couvre que l'instance du plugin. |

## Impact

| Category | Verdict and evidence | Handled in |
| --- | --- | --- |
| Runtime | **Observé (contrat), non mesuré** : le SDK `stripe` n'est pas encore une dépendance (`apps/api/package.json` lu : ni `stripe` ni `@stripe/*`). Aucun appel réseau au boot : le client est créé paresseusement. | 3 |
| Regression | **Moyen** : `apps/api/src/app.ts` convertit `publicRoutes` / `protectedRoutes` (constantes de module) en fabriques paramétrées par le provider. Toutes les routes existantes passent par la même chaîne, donc `packages/spec` (market, achievements, charges, friends, players, profile, tableaux, tickets) est le filet. Aucun de ces fichiers de spec n'est modifié. | 5, 7 |
| Architecture | **Faible, additive** : deux plugins de route (`shopCheckoutRoutes` protégé, `shopWebhookRoutes` public). Aucune table nouvelle, aucun index nouveau : `0013_shop` fournit déjà `currency_ledger_purchase_uniq` et `SHOP_DAILY_PURCHASE_CAP`. | 3, 4, 5 |
| Documentation | **Aucune** : `.docs/03-active-task.md`, `ROADMAP.md`, `.docs/01-architecture.md` et `.docs/02-database.md` sont hors périmètre (brief). Le journal va dans `.docs/sessions/backend-checkout/`. | none |

## Rules

| Rule | Why it applies |
| --- | --- |
| Serveur autoritaire (`.docs/01-architecture.md` §4.1) | Le montant et le nombre d'écus viennent de `packs.ts`, jamais de `amount_total`. |
| Motifs fermés du grand-livre (`.docs/02-database.md` §4.6) | Deux motifs seulement : `PURCHASE:<ref>` et `PURCHASE_REFUND:<ref>`. |
| Idempotence par la base (§4.6, §7.1) | `on conflict do nothing` sur `PURCHASE:<sessionId>`, jamais une vérification avant insertion. |
| Tout dans Docker (AGENTS.md règle 1) | `bun`, `tsc`, `bunx` passent par `docker compose --profile tools run --rm dev`. |
| Spec-first (`AGENTS.md` règle 2) | `shop.spec.ts` est écrit et vu rouge avant `shop.ts`. |
| Fichiers partagés — ajout en fin de liste | `packages/shared/src/index.ts` : export ajouté en fin de bloc alphabétique ; `apps/api/src/app.ts` : `.use()` ajouté en fin de chaîne. |
| Migration réservée : `-` | Aucune migration créée, aucun numéro pris. |

## Decisions

| Decision | Why |
| --- | --- |
| `ShopDisabledError` et `WebhookSignatureError` vivent dans `packages/shared/src/payments.ts`, réexportés par `stripe-payments.ts` | Le fake de `packages/spec` doit pouvoir lever la même erreur sans importer le SDK Stripe ; la route attrape une seule classe. Le brief nomme `stripe-payments.ts` comme point d'entrée : le réexport garde cette promesse. |
| La route vérifie `provider.isEnabled()` avant d'appeler le provider | `503 SHOP_DISABLED` doit être rendu sans qu'une exception traverse la frontière du provider injecté ; le provider garde `ShopDisabledError` comme second filet. |
| `GET /shop/orders/:id` lit `user_id` sur la ligne `PURCHASE:<id>` | Sans cette lecture, une commande créditée d'un autre joueur répondrait `PENDING` au lieu de `404`. Le montant rendu reste celui de l'utilisateur courant, et un identifiant inconnu reste `PENDING` (aucune fuite : il n'existe pas). |
| Le webhook répond `200 { received: true }` sur utilisateur ou pack inconnu | Un `400` ferait réessayer Stripe indéfiniment ; l'événement est journalisé et ignoré. |
| `onParse` `{ as: 'scoped' }` sur le seul plugin webhook, avec `body: t.String()` | Seul moyen de garder le corps brut jusqu'à `constructEvent` ; le plugin étant monté sur `/api/v1` + préfixe `/shop`, le chemin est `/api/v1/shop/webhook`. |
