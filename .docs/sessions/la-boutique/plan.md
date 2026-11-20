# Phase B — La Boutique : plan d'exécution

> **Statut** : plan prêt, code à construire en mode « dark ».
> **Mise en production** : bloquée par le juridique (CGV, rétractation, TVA, consentement parental, DPA).
> **Dernière mise à jour** : 2026-11-20.

---

## 1. Verdict sur le script multi-sessions

Le dépôt possède déjà `scripts/agents/run.sh` : worktrees par phase, base PostgreSQL de test par
phase, vagues empilées, `ci:check` par vague, PR brouillon vers la branche parente, jamais vers
`main`. Écrire un second runner serait un doublon.

La Phase B n'est **pas** parallélisable à neuf. Le graphe réel est :

```text
main
 ├─ 300 économie + catalogue ─┐
 └─ 301 migration + index ────┴─ agents/boutique-wave-1
                                  └─ 302 checkout + webhook ── agents/boutique-wave-2
                                                                 ├─ 303 remboursements + plafond ─┐
                                                                 └─ 304 boutique (front) ─────────┴─ agents/boutique-wave-3
                                                                                                      └─ 305 QA + e2e ── agents/boutique-wave-4
```

- **Vague 1** : 300 et 301 en parallèle (fichiers disjoints : `packages/shared` vs `packages/db`).
- **Vague 2** : 302 seul (checkout + webhook, même fichier `shop.ts`).
- **Vague 3** : 303 et 304 en parallèle (API vs web, contrats déjà figés par 302).
- **Vague 4** : 305 seul (intégration, e2e, documentation, PR finale en brouillon).

Soit **4 vagues, 6 sessions**, deux paires parallèles. C'est le maximum honnête : les étapes
30.1 → 30.5 sont une chaîne, pas un éventail.

---

## 2. Revue de prix — la décision

### Le constat

Le catalogue des 37 médailles vaut **65 950 écus** (vérifié dans
`packages/shared/src/achievements.ts`, verrouillé par `packages/spec/src/achievements.spec.ts`).
Avec le pack baleine proposé à **6 000 écus / 44,99 €**, cela donne :

```text
6 000 écus  = 44,99 €  →  1 écu ≈ 0,0075 €  →  133,4 écus/€
65 950 écus ≈ 494 €
6 450 écus  ≈ 48 €
```

Un joueur qui complète les médailles reçoit l'équivalent de **onze packs baleine**. Le robinet
gratuit écrase la boutique : acheter n'a plus de sens, et le marché est noyé de monnaie.

### La règle retenue

**Le catalogue complet des médailles vaut exactement un `PACK_6000`.** La progression gratuite
reste une récompense de long terme ; la boutique est un raccourci, pas le chemin. C'est la règle
du ROADMAP §2.B, rendue chiffrée.

- Total cible : **6 000 écus** (au lieu de 65 950, division par ~11).
- Pack baleine : 6 000 écus / 44,99 €.
- Pack d'entrée : 500 écus / 4,99 €, soit 8,3 % du catalogue gratuit.
- Aucun historique réécrit : `currency_ledger` et `user.currency` ne sont pas touchés.
  Les comptes de développement gardent leur solde ; la production n'a aucun joueur.
  Un nouveau compte plafonne à 6 000 écus de médailles.

### Tableau normatif (remplace les montants actuels)

| Clé | Ancien | Nouveau |
| :--- | ---: | ---: |
| `SCRATCH_FIRST_TICKET` | 100 | 25 |
| `SCRATCH_TICKETS_10` | 250 | 25 |
| `SCRATCH_TICKETS_50` | 500 | 45 |
| `SCRATCH_TICKETS_100` | 1 000 | 90 |
| `SCRATCH_TICKETS_500` | 2 500 | 225 |
| `SCRATCH_TICKETS_1000` | 5 000 | 455 |
| `SCRATCH_FIRST_PEPITE` | 150 | 25 |
| `SCRATCH_PEPITES_10` | 750 | 70 |
| `SCRATCH_MYTHIQUE` | 2 000 | 180 |
| `COLLECTION_CARDS_10` | 200 | 25 |
| `COLLECTION_CARDS_50` | 500 | 45 |
| `COLLECTION_CARDS_100` | 1 200 | 110 |
| `COLLECTION_CARDS_500` | 4 000 | 365 |
| `COLLECTION_REGIONS_18` | 3 000 | 275 |
| `COLLECTION_DEPARTEMENTS_101` | 15 000 | 1 260 |
| `COLLECTION_SIX_RARITIES` | 1 500 | 135 |
| `COLLECTION_UNIQUE_RUE` | 2 500 | 225 |
| `TABLEAU_FIRST` | 100 | 25 |
| `TABLEAU_MULTIPLIER_15` | 200 | 25 |
| `TABLEAU_MULTIPLIER_25` | 500 | 45 |
| `TABLEAU_MULTIPLIER_50` | 1 500 | 135 |
| `TABLEAU_SCORE_5000` | 500 | 45 |
| `TABLEAU_SCORE_10000` | 1 500 | 135 |
| `TABLEAU_SCORE_15000` | 4 000 | 365 |
| `MARKET_FIRST_SALE` | 150 | 25 |
| `MARKET_FIRST_PURCHASE` | 150 | 25 |
| `MARKET_SALES_10` | 500 | 45 |
| `MARKET_SALES_100` | 3 000 | 275 |
| `MARKET_ECUS_EARNED_10000` | 2 000 | 180 |
| `MARKET_PURCHASE_1000` | 300 | 25 |
| `SOCIAL_FIRST_FRIEND` | 100 | 25 |
| `SOCIAL_FRIENDS_10` | 500 | 45 |
| `SOCIAL_FRIENDS_50` | 2 000 | 180 |
| `SOCIAL_FRIENDS_100` | 5 000 | 455 |
| `SOCIAL_PROFILE_COMPLETE` | 100 | 25 |
| `ATTENDANCE_7_DAYS` | 700 | 65 |
| `ATTENDANCE_30_DAYS` | 3 000 | 275 |
| **Total** | **65 950** | **6 000** |

Le plancher à 25 écus est volontaire : les premières médailles sont symboliques, la courbe se
construit sur les paliers longs (1 000 tickets, 101 départements, 100 amis). Si 25 paraît trop
bas, relever le plancher à 40–50 et retirer l'équivalent sur `COLLECTION_DEPARTEMENTS_101` pour
conserver le total à 6 000.

### Catalogue des packs

| Clé | Écus | Prix TTC | Écus/€ | Bonus |
| :--- | ---: | ---: | ---: | ---: |
| `PACK_500` | 500 | 4,99 € | 100,2 | — |
| `PACK_1200` | 1 200 | 9,99 € | 120,1 | +20 % |
| `PACK_2500` | 2 500 | 19,99 € | 125,1 | +25 % |
| `PACK_6000` | 6 000 | 44,99 € | 133,4 | +33 % |

Le rapport écus/€ est strictement croissant ; le pack baleine n'est jamais le pire deal.
Les prix sont en **centimes** dans le code (`499`, `999`, `1 999`, `4 499`) pour éviter les
flottants. La TVA et les frais Stripe sont pris **dans** le prix affiché, jamais ajoutés.

### Ce que cette revue ne prétend pas

Il n'existe aucune donnée de prix de marché réelle : les 100/120/150 des specs sont des fixtures.
La valeur d'un écu reste endogène au marché entre joueurs. La règle « un catalogue = un pack
baleine » est un ancrage, pas une science. Elle sera à revalider après une bêta fermée.

---

## 3. Porte juridique — à lire avant d'activer

Le code peut être construit maintenant, mais **la boutique reste éteinte** jusqu'à :

- [ ] CGV et mentions légales publiées.
- [ ] Droit de rétractation et exception pour contenu numérique documentés, acceptés au checkout.
- [ ] TVA configurée (Stripe Tax ou manuelle), prix TTC.
- [ ] Consentement parental si les mineurs sont autorisés.
- [ ] DPA signé avec l'hébergeur, résidence UE des données.
- [ ] Bandeau cookies (le cookie de session en est un).
- [ ] `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` et les quatre `STRIPE_PRICE_*` injectés par
      la plateforme, jamais dans le dépôt.

Tant que ces variables manquent, `POST /api/v1/shop/checkout` répond
`503 SHOP_DISABLED` et le front affiche « La boutique n'est pas encore ouverte. ». C'est
l'interrupteur de la phase B ; il ne se contourne pas par un flag client.

---

## 4. Graphe des branches et des PR

| Vague | Phase | Branche | Base de la PR | Contenu |
| :--- | :--- | :--- | :--- | :--- |
| 1 | 300 | `feat/phase-30-0-economie` | `main` | médailles 6 000 + `packs.ts` |
| 1 | 301 | `feat/phase-30-1-migration-index` | `main` | migration `0013_shop`, index partiel, clé de plafond |
| 2 | 302 | `feat/phase-30-2-checkout` | `agents/boutique-wave-1` | provider, checkout, webhook brut, idempotence |
| 3 | 303 | `feat/phase-30-3-refunds` | `agents/boutique-wave-2` | remboursements, plafond quotidien, tests fake |
| 3 | 304 | `feat/phase-30-4-front` | `agents/boutique-wave-2` | salle `/boutique`, succès, états 503/429 |
| 4 | 305 | `feat/phase-30-5-qa` | `agents/boutique-wave-3` | e2e, docs, revue, PR finale |
| — | finale | `agents/boutique-wave-4` | `main` | **manuel**, après revue et juridique |

Le runner crée `agents/boutique-wave-N` après chaque vague, y fusionne les branches de phase,
puis pousse. Les sessions ouvrent une **PR brouillon vers `{{PARENT}}`**, jamais vers `main`.
La dernière branche ne remonte vers `main` que sur décision humaine.

---

## 5. Commandes

```sh
# 1. Vérifier le graphe sans rien lancer (recommandé en premier)
./scripts/agents/run-phase-b.sh --dry-run --allow-dirty

# 2. Exécuter les quatre vagues
./scripts/agents/run-phase-b.sh --allow-dirty

# 3. Reprendre une vague précise
./scripts/agents/run-phase-b.sh --wave 2 --allow-dirty

# 4. Conserver les worktrees pour inspecter un échec
./scripts/agents/run-phase-b.sh --keep --allow-dirty
```

`--allow-dirty` est nécessaire tant que ce plan et les briefs ne sont pas commités. Les worktrees
sont créés depuis `main` ; les prompts sont lus depuis `scripts/agents/prompts/`, hors worktree,
donc ils fonctionnent même non commités.

Logs : `../hexamap-agents-logs/session-<phase>-<slug>.log`.
Prompts composés : `../hexamap-agents-logs/prompt-<phase>-<slug>.md`.
Worktrees : `../hexamap-agents/phase-<phase>`.

---

## 6. Critères d'acceptation de la phase

1. `ACHIEVEMENT_PAYOUT_TOTAL === 6000`, 37 clés/familles/seuils inchangés.
2. `PACK_6000.ecus === 6000` et rapport écus/€ strictement croissant.
3. Migration `0013_shop` rejouable ; index partiel `currency_ledger_purchase_uniq` présent ;
   un rejeu `PURCHASE:<id>` n'écrit qu'une ligne.
4. Checkout : aucune écriture au ledger ; le webhook seul crédite.
5. Webhook : corps brut vérifié, rejeu idempotent, signature invalide refusée.
6. Remboursement : contrepartie négative, plafonnée, solde jamais négatif.
7. Plafond quotidien lu dans `game_config`, `429 SHOP_DAILY_CAP_REACHED`.
8. Boutique sans clés Stripe : `503 SHOP_DISABLED`, aucun appel réseau dans les tests.
9. `/boutique` atteignable, quatre packs, prix TTC, page de succès qui lit le webhook.
10. `ci:check` vert et banc Playwright vert.
11. Aucun commit dans `main`, aucune clé Stripe dans le dépôt, PR finale en brouillon.

---

## 7. Risques connus

| Risque | Traitement |
| :--- | :--- |
| Le corps JSON est parsé avant la vérification de signature | Hook `onParse` dédié au webhook, test avec corps brut ; c'est le piège n°1 de Stripe avec Elysia |
| Deux livraisons simultanées du même événement | Index unique partiel + `insert … on conflict do nothing` + `FOR UPDATE` sur `user` |
| Le webhook arrive avant que la ligne de commande soit visible | Le crédit ne dépend pas d'une ligne de commande : il dépend du pack et de l'utilisateur du metadata ; test dédié |
| Un remboursement rend le solde négatif | Écrire la ligne négative, ramener `user.currency` à 0, journaliser `SHOP_REFUND_NEGATIVE` ; jamais supprimer le remboursement |
| Le prix est modifié côté client | Le client n'envoie qu'une clé ; le serveur relit `packs.ts` ; le montant Stripe est vérifié par le prix serveur |
| Le runner fusionne une phase non poussée | Chaque brief impose commit + push avant la PR ; le runner échoue proprement sinon |
| Le plan et les briefs sont non commités | `--allow-dirty` ; les prompts vivent hors worktree |
