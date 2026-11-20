## Objectif

Ouvrir **La Boutique** : quatre packs d'écus, prix TTC, solde, et une page de succès qui **lit le
webhook** (`GET /shop/orders/:id`) au lieu de croire la redirection. Sans clé Stripe, la salle
l'annonce et ne propose rien.

## Ce qui est livré

| Fichier | Rôle |
| :--- | :--- |
| `apps/web/src/content/boutique.ts` | Tous les libellés : `BOUTIQUE`, `BOUTIQUE_SUCCESS`, `PACK_LABELS`, `packPriceLabel`, `packBonusLabel` |
| `apps/web/src/lib/shop.ts` | `ShopApiError`, `shopOrderQueryKey/Options`, `fetchShopOrder`, `createCheckout`, `checkoutErrorMessage` |
| `apps/web/src/components/shop/pack-card.tsx` | Planche de pack : nom, écus, prix TTC, bonus, un bouton `min-h-11` |
| `apps/web/src/routes/boutique.index.tsx` | `/boutique` : garde de session, solde, quatre packs, checkout, redirection |
| `apps/web/src/routes/boutique.succes.tsx` | `/boutique/succes` : `PENDING` borné puis `CREDITED`, bouton `Rafraîchir` |
| `apps/web/src/components/layout/nav-items.ts` | `La Boutique` en salle secondaire (feuille `Plus`), pas de sixième onglet |
| `packages/e2e/tests/mobile.spec.ts` | Un cas à 390 px, aucun cas existant retouché |

## Décisions

- **`/boutique/succes` est la salle canonique, `/boutique?session_id=…` y redirige** : l'API
  (`shop.ts`) construit son `successUrl` sur `/boutique`, le brief nommait `boutique.succes.tsx`.
  Les deux sont tenus, sans toucher au serveur, par un `<Navigate replace>`.
- **Pas de `boutique.tsx`** : en routage fichier, `boutique.succes.tsx` en serait l'enfant et la
  page de succès se rendrait *dans* la salle. Les deux fichiers sont frères.
- **Le checkout n'envoie que `{ packKey }`** ; le prix et les écus restent au serveur. La réponse
  `{ url }` est suivie par `window.location.assign`.
- **Aucun crédit optimiste.** Le solde se relit par
  `{ ...sessionQueryOptions, enabled: statut === 'CREDITED', staleTime: 0 }` — pas de `useEffect`,
  pas d'écriture dans le cache.
- **Le sondage est borné** : `dataUpdateCount + errorUpdateCount < 6`, puis le bouton `Rafraîchir`
  prend le relais. Un échec de relecture ne relance pas la boucle.

## Écarts assumés

- `SHOP_DAILY_CAP_REACHED` et `UNKNOWN_PACK` sont traduits alors que l'API ne les émet pas encore
  (plafond = pas 30.7 ; clé inconnue rejetée en `400` par TypeBox). Aucun code serveur ajouté.
- Le message serveur de `SHOP_DISABLED` diffère du message joueur ; le code est le même.
- `PENDING` ne distingue pas un paiement en cours d'une session abandonnée : l'ordre est dérivé du
  grand-livre, il n'existe pas de table d'ordres (contrat de la vague 2).

## Preuve

```
ci:check                       ✓ Lint ✓ Typecheck ✓ Base de données ✓ Spécifications
                               292 pass, 0 fail — 292 tests, 18 fichiers
playwright (banc complet)      61 passed, 3 skipped, 1 flaky (2.2m)
  le flaky : « les salles secondaires sont atteintes en deux appuis » (iPhone 13),
  préexistant — session non résolue au premier appui sur « Plus » — vert au retry
boutique (Pixel 7, iPhone 13)  2 passed (26.3s)
```

Sans clé Stripe, `Acheter` affiche bien :

> La boutique n'est pas encore ouverte.

### Captures à 390 px

Salle complète — quatre packs, prix TTC, bonus, solde :

![La Boutique à 390 px](.docs/sessions/front-boutique/boutique-390.png)

Après un appui sur `Acheter`, `503 SHOP_DISABLED` — et les boutons se réarment :

![SHOP_DISABLED à 390 px](.docs/sessions/front-boutique/boutique-503-390.png)

## Revue

`.docs/sessions/front-boutique/review.md` : deux *deal-breakers* trouvés en relecture hostile
(double checkout sur double appui, sondage non borné en cas d'échec) et corrigés, plus quatre
corrections mineures (solde à 0 pendant le chargement, assertion de prix ambiguë, repli anglais,
salle non allumée sur `/boutique/succes`).

Aucune migration, aucun schéma, aucun contrat d'API modifié, aucune dépendance nouvelle.
