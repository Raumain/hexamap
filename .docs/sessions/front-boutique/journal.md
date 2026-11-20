# Journal — Phase 30.4, la salle de la Boutique et la page de succès

Branche : `feat/phase-30-4-front` · base : `agents/boutique-wave-2` · migration : aucune.

## Ce qui est livré

| Fichier | Rôle |
| :--- | :--- |
| `apps/web/src/content/boutique.ts` | Tous les libellés : `BOUTIQUE`, `BOUTIQUE_SUCCESS`, `PACK_LABELS`, `packPriceLabel`, `packBonusLabel` |
| `apps/web/src/lib/shop.ts` | `ShopApiError`, `shopOrderQueryKey`, `shopOrderQueryOptions`, `fetchShopOrder`, `createCheckout`, `checkoutErrorMessage` |
| `apps/web/src/components/shop/pack-card.tsx` | La planche d'un pack : nom, écus, prix TTC, bonus, un bouton |
| `apps/web/src/routes/boutique.index.tsx` | `/boutique` : solde, quatre packs, mutation de checkout, redirection |
| `apps/web/src/routes/boutique.succes.tsx` | `/boutique/succes` : lit `GET /shop/orders/:id`, `PENDING` puis `CREDITED` |
| `apps/web/src/components/layout/nav-items.ts` | `La Boutique` en salle secondaire (feuille `Plus` et rail) |
| `packages/e2e/tests/mobile.spec.ts` | Un cas à 390 px, aucun cas existant retouché |

## Décisions et écarts

**L'URL de succès de l'API ne correspond pas au nom de fichier du brief.** `shop.ts` construit
`successUrl = ${origin}/boutique?session_id={CHECKOUT_SESSION_ID}` ; le brief demande
`routes/boutique.succes.tsx`. Les deux sont tenus : `/boutique` lit `session_id` et redirige par
`<Navigate replace>` vers `/boutique/succes`, la salle canonique. Aucun code serveur modifié.

**Pas de `boutique.tsx`.** En routage fichier, `boutique.succes.tsx` deviendrait son enfant et la
page de succès se rendrait *dans* la salle, derrière un `<Outlet />`. Les deux fichiers sont donc
frères — `boutique.index.tsx` (`/boutique/`) et `boutique.succes.tsx` (`/boutique/succes`) —,
comme `market.index.tsx` et `market.mine.tsx`.

**Deux codes mappés que l'API n'émet pas encore.** `SHOP_DAILY_CAP_REACHED` (le plafond quotidien
est le pas 30.7) et `UNKNOWN_PACK` (TypeBox rejette la clé inconnue en `400` avant le handler) sont
traduits dès maintenant pour que la salle ne devienne pas muette le jour où ils apparaissent.
`ORDER_NOT_FOUND`, lui, est déjà émis (`shop.ts`) et est traduit.

**Le solde se relit sans `useEffect`.** TanStack Query v5 n'a plus `onSuccess` sur `useQuery` :
la session est interrogée par `{ ...sessionQueryOptions, enabled: statut === 'CREDITED', staleTime: 0 }`.
L'observateur s'active au crédit et relit le solde ; rien n'est écrit localement, aucun crédit
optimiste.

**Le sondage est plafonné.** `refetchInterval` rend `2 000` tant que `PENDING` et que
`dataUpdateCount < 6`, puis `false` : cinq relectures, environ dix secondes, et le bouton
`Rafraîchir` prend le relais. Aucune boucle infinie, aucun `setInterval`.

## Vérification

```sh
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_304' \
  dev bun run ci:check
  ✓ 1/4 Lint   ✓ 2/4 Typecheck   ✓ 3/4 Base de données   ✓ 4/4 Spécifications
  292 pass, 0 fail, 1737 expect() calls, Ran 292 tests across 18 files

docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  61 passed, 3 skipped, 1 flaky (2.2m)
  le flaky est « les salles secondaires sont atteintes en deux appuis » sur iPhone 13,
  préexistant (session non résolue au moment du premier appui sur « Plus »), vert au retry
```

Le détail de la revue — deux *deal-breakers* corrigés, quatre corrections mineures, écarts
assumés — est dans `review.md`. Les preuves visuelles sont `boutique-390.png` et
`boutique-503-390.png`.

## Incident d'environnement

Le répertoire de travail a été effacé **deux fois** par un processus externe (répertoires
recréés en `root`, hors dépôt), ce qui a invalidé un premier passage du banc (3 échecs
`ENOENT`/`worker process exited`, 30 tests non joués). Le travail a été restauré depuis les
instantanés d'OpenCode, sécurisé par trois commits poussés, et la session déplacée dans
`hexamap-agents/phase-304-front`. Aucun fichier perdu, aucune conséquence sur la livraison.

