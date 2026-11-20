# Configuration Stripe — La Boutique

> **But** : mettre Stripe en mode test, brancher les quatre packs, recevoir le webhook, puis
> passer en production sans jamais committer de secret.
> **Prérequis** : la phase B implémentée (routes `/shop/checkout`, `/shop/webhook`,
> `/shop/orders/:id`) et la migration `0013_shop` appliquée.
> **Porte juridique** : ne pas passer en live avant CGV, rétractation, TVA, consentement parental
> et DPA. Ce guide est technique, pas juridique.

---

## 1. Ordre des opérations

1. Compte Stripe en **mode test**.
2. Quatre produits + quatre prix **one-time EUR, TTC**.
3. Clé secrète de test + secret de webhook.
4. Les six variables d'environnement dans `.env` (dev) ou dans la plateforme (prod).
5. Webhook local avec la Stripe CLI, puis un achat test.
6. Remboursement test, rejeu d'événement, vérification du ledger.
7. Seulement après la porte juridique : produits/prix **live**, clés live, webhook HTTPS.

---

## 2. Compte et mode test

- Créer le compte sur <https://dashboard.stripe.com/register>.
- Renseigner le profil d'entreprise, le compte bancaire et les informations fiscales.
- Laisser l'interrupteur **Test mode** activé pendant toute la phase B.
- Les objets test (`prod_...`, `price_...`, `cs_test_...`) sont séparés des objets live. Un
  identifiant test ne fonctionne pas avec une clé live, et inversement.

---

## 3. Les quatre prix

Dans **Product catalog → Add product**, créer un produit par pack. Pour chacun :

- **Type** : one-time (paiement unique), pas recurring.
- **Devise** : EUR.
- **Montant** : le prix TTC exact.
- **Tax behavior** : **Inclusive** (le prix affiché est le prix payé ; la TVA est contenue
  dedans, elle ne s'ajoute pas).
- **Quantité** : 1 (le pack est un article unique).

| Pack | Écus | Montant Stripe | `unit_amount` | Variable |
| :--- | ---: | ---: | ---: | :--- |
| `PACK_500` | 500 | 4,99 € | `499` | `STRIPE_PRICE_PACK_500` |
| `PACK_1200` | 1 200 | 9,99 € | `999` | `STRIPE_PRICE_PACK_1200` |
| `PACK_2500` | 2 500 | 19,99 € | `1999` | `STRIPE_PRICE_PACK_2500` |
| `PACK_6000` | 6 000 | 44,99 € | `4499` | `STRIPE_PRICE_PACK_6000` |

Copier chaque identifiant `price_...` depuis le produit. **Ne pas** utiliser le `prod_...` :
le serveur attend le `price_...`.

> Le nombre d'écus crédités ne vient jamais de Stripe : il vient de
> `packages/shared/src/packs.ts`. Stripe ne fournit que la preuve du paiement et le prix payé.

---

## 4. Clés API

**Developers → API keys** (en mode test) :

- `sk_test_...` : clé secrète, utilisée par le serveur pour créer les sessions Checkout et
  retrouver une session lors d'un remboursement.
- `pk_test_...` : **inutile ici**. Checkout est hébergé par Stripe ; le navigateur ne parle pas
  à l'API Stripe.

Pour la production, créer une **clé restreinte** plutôt que d'utiliser la clé secrète complète :

- Checkout Sessions : **write** (créer une session) et **read** (retrouver la session d'un
  remboursement).
- Le webhook n'a besoin d'aucune permission API : il vérifie une signature HMAC localement.

---

## 5. Variables d'environnement

### Développement

`compose.yml` monte le service `api` avec `env_file: .env`. Ajouter dans `.env` à la racine :

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PACK_500=price_...
STRIPE_PRICE_PACK_1200=price_...
STRIPE_PRICE_PACK_2500=price_...
STRIPE_PRICE_PACK_6000=price_...
```

Redémarrer l'API après modification :

```sh
docker compose restart api
```

Si une seule de ces six valeurs est absente **ou vide**, `POST /api/v1/shop/checkout` répond
`503 SHOP_DISABLED` et le front affiche « La boutique n'est pas encore ouverte. ». C'est
l'interrupteur normal, pas un bug.

### Production

`docker-compose.prod.yml` déclare les variables explicitement. La phase 302 doit ajouter au bloc
`environment` du service `api` :

```yaml
      STRIPE_SECRET_KEY: ${STRIPE_SECRET_KEY:-}
      STRIPE_WEBHOOK_SECRET: ${STRIPE_WEBHOOK_SECRET:-}
      STRIPE_PRICE_PACK_500: ${STRIPE_PRICE_PACK_500:-}
      STRIPE_PRICE_PACK_1200: ${STRIPE_PRICE_PACK_1200:-}
      STRIPE_PRICE_PACK_2500: ${STRIPE_PRICE_PACK_2500:-}
      STRIPE_PRICE_PACK_6000: ${STRIPE_PRICE_PACK_6000:-}
```

En production réelle, injecter ces valeurs par la plateforme (secrets), pas par un `.env`
versionné. `compose.yml` (dev) n'a pas besoin d'être modifié.

---

## 6. Webhook

### Endpoint

- URL de production : `https://<origine>/api/v1/shop/webhook`
- URL locale : `http://localhost:3000/api/v1/shop/webhook`

L'endpoint est **public** (Stripe n'a pas de cookie de session) et lit le **corps brut**. Ne pas
le déplacer dans le groupe protégé, ne pas activer un parseur JSON devant lui.

### Dashboard

**Developers → Webhooks → Add endpoint** :

- URL : l'URL ci-dessus.
- Événements : `checkout.session.completed` et `charge.refunded`.
- Copier le **Signing secret** `whsec_...` dans `STRIPE_WEBHOOK_SECRET`.

Le secret est propre à l'endpoint. Le secret affiché par la Stripe CLI en local est **différent**
de celui du dashboard : utiliser celui de la CLI quand on teste en local.

### Stripe CLI (développement)

La CLI est un outil de développement, pas une dépendance runtime :

```sh
stripe login
stripe listen --forward-to localhost:3000/api/v1/shop/webhook
```

La commande affiche un `whsec_...`. Le mettre dans `.env`, puis `docker compose restart api`.
Garder `stripe listen` ouvert pendant le test : sans lui, aucun événement n'arrive à l'API locale.

Pour rejouer un événement :

```sh
stripe events resend evt_...
```

Le solde ne doit **pas** doubler : l'index `currency_ledger_purchase_uniq` et le
`insert … on conflict do nothing` font le travail.

---

## 7. URLs de succès et d'annulation

Le serveur construit les URLs à partir de `FRONTEND_URL` (ou `APP_URL`) :

- succès : `${FRONTEND_URL}/boutique/succes?session_id={CHECKOUT_SESSION_ID}`
- annulation : `${FRONTEND_URL}/boutique`

En développement, vérifier que `FRONTEND_URL` vaut `http://localhost:5174` (ou l'origine réelle
du web). En production, `https://...`, la même origine que l'API et le SPA. Une origine
différente casse à la fois CORS, les cookies et le service worker.

La page de succès **ne croit pas** la redirection : elle appelle `GET /shop/orders/:id` et attend
le statut `CREDITED`. Le webhook peut arriver quelques secondes après le retour du navigateur.

---

## 8. Test de bout en bout

1. Démarrer la pile : `docker compose up -d db api web`.
2. Vérifier que les six variables sont chargées (sans afficher les secrets) :
   ```sh
   docker compose exec api sh -lc 'for v in STRIPE_SECRET_KEY STRIPE_WEBHOOK_SECRET STRIPE_PRICE_PACK_500; do [ -n "$(printenv "$v")" ] && echo "$v: set" || echo "$v: MISSING"; done'
   ```
3. Lancer `stripe listen --forward-to localhost:3000/api/v1/shop/webhook`.
4. Créer un compte de test, ouvrir `http://localhost:5174/boutique`.
5. Acheter `PACK_500` avec la carte test :
   - `4242 4242 4242 4242`, date future, CVC quelconque, code postal quelconque.
   - 3-D Secure : `4000 0025 0000 3155`.
   - Refus : `4000 0000 0000 0002`.
6. Vérifier :
   - la redirection vers `/boutique/succes?session_id=cs_test_...` ;
   - l'état `PENDING` puis `CREDITED` et +500 écus ;
   - dans le dashboard, le paiement `Succeeded` ;
   - dans la CLI, `checkout.session.completed` ;
   - dans le ledger :
     ```sh
     docker compose exec db psql -U hexamap -d hexamap -c \
       "select reason, delta, created_at from currency_ledger order by id desc limit 5;"
     ```
     Une ligne `PURCHASE:cs_test_...` avec `delta = 500`.
7. Rejouer l'événement (`stripe events resend evt_...`) : toujours **une** ligne, solde inchangé.
8. Rembourser depuis le dashboard (paiement → Refund) : la CLI affiche `charge.refunded`, le
   ledger gagne `PURCHASE_REFUND:cs_test_...` avec `delta = -500`, le solde revient à 0.
9. Remboursement partiel : le montant en écus est proportionnel, arrondi à l'écun inférieur.
10. Tester le plafond : `SHOP_DAILY_PURCHASE_CAP` vaut 12 000 écus par jour UTC. Au-delà,
    le checkout répond `429 SHOP_DAILY_CAP_REACHED`. Un paiement déjà effectué est toujours
    crédité.

---

## 9. TVA et facturation

- Activer **Stripe Tax** si l'account est configuré pour la TVA française/UE.
- Les prix sont créés en **tax behavior inclusive** : le prix affiché est le prix payé.
- Ajouter les immatriculations TVA nécessaires (France, UE) dans **Tax → Registrations**.
- Pour le B2B, Checkout peut collecter un numéro de TVA ; ce n'est pas requis pour la V1.
- Les factures Stripe peuvent être activées dans **Settings → Invoicing**. La V1 peut se
  contenter du reçu Stripe, mais la CGV doit dire ce que le joueur reçoit.

Ce guide ne remplace pas la validation comptable et juridique.

---

## 10. Passage en production

Checklist avant le premier paiement réel :

- [ ] Compte Stripe activé (entreprise, banque, fiscalité).
- [ ] Produits et prix **live** créés, mêmes montants, `tax_behavior: inclusive`.
- [ ] Les quatre `STRIPE_PRICE_*` live sont injectés.
- [ ] `STRIPE_SECRET_KEY` live (ou clé restreinte live) injectée.
- [ ] Webhook live HTTPS créé, `checkout.session.completed` + `charge.refunded`,
      `STRIPE_WEBHOOK_SECRET` live injecté.
- [ ] `PROD_APP_URL`, `PROD_BETTER_AUTH_URL`, `PROD_FRONTEND_URL` en `https://...`.
- [ ] `TRUSTED_ORIGINS` liste exactement les origines réelles.
- [ ] CGV, mentions légales, rétractation, confidentialité, cookies publiés.
- [ ] DPA signé, résidence UE.
- [ ] `SHOP_DAILY_PURCHASE_CAP` présent dans `game_config`.
- [ ] Migration `0013_shop` appliquée (index partiel présent).
- [ ] Un achat réel de 4,99 € effectué, puis remboursé, ledger vérifié.
- [ ] Rotation des clés test → live, aucun secret dans le dépôt.

---

## 11. Dépannage

| Symptôme | Cause probable | Correction |
| :--- | :--- | :--- |
| `503 SHOP_DISABLED` | une des six variables manque ou est vide | compléter `.env`, `docker compose restart api` |
| Checkout OK, aucun crédit | webhook non reçu | vérifier `stripe listen` ou l'endpoint dashboard, l'URL et le secret |
| `400 INVALID_SIGNATURE` | corps parsé avant vérification, ou mauvais secret | lire `request.text()`, utiliser le secret de l'endpoint courant |
| Crédit doublé | index `currency_ledger_purchase_uniq` absent | appliquer `0013_shop`, vérifier `pg_indexes` |
| `429 SHOP_DAILY_CAP_REACHED` | plafond de 12 000 écus/jour atteint | attendre minuit UTC ou ajuster `game_config` |
| Solde négatif après remboursement | le joueur a dépensé les écus | comportement attendu : ligne négative écrite, solde ramené à 0, log `SHOP_REFUND_NEGATIVE` |
| Redirection vers une mauvaise origine | `FRONTEND_URL` incorrect | aligner `FRONTEND_URL` sur l'origine réelle |
| `price_...` inconnu | prix test utilisé avec clé live, ou inversement | recréer le prix dans le bon mode |

---

## 12. Sécurité

- Ne jamais committer `sk_test_`, `sk_live_`, `whsec_` : `.env` est ignoré, les secrets de
  production vivent dans la plateforme.
- Utiliser une clé restreinte en production ; la clé secrète complète ne sert qu'au diagnostic.
- En cas de fuite : **Developers → API keys → Roll** la clé, puis redéployer.
- Le webhook secret est propre à l'endpoint ; le rotate avec l'endpoint.
- Ne pas journaliser le corps brut du webhook (il contient des données client) ni les clés.
- Le webhook est public mais vérifié par signature ; ne jamais le protéger par un cookie.
- `pk_...` n'est pas utilisé : aucun code client ne parle à Stripe.

---

## 13. Ce qui reste hors Stripe

- Les écus sont crédités par le webhook, pas par la redirection.
- Le prix et le nombre d'écus sont décidés par `packages/shared/src/packs.ts`.
- Le plafond quotidien est dans `game_config`, pas dans Stripe.
- Les remboursements sont proportionnels au montant remboursé, en écus, avec un plancher à 0
  pour le solde affiché.
- La boutique reste éteinte tant que la porte juridique n'est pas franchie.
