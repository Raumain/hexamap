---
status: pending
---

# Instruction: Client et contenu de la boutique

## Architecture projection

```txt
apps/web/src/lib/
  shop.ts                    ✅ create
apps/web/src/content/
  boutique.ts                ✅ create
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | `bun run --cwd apps/web typecheck` avant écriture | La base est verte, `tsr generate` tourne | cli |
| Happy path | `checkoutErrorMessage(new ShopApiError('…', 'SHOP_DISABLED'))` | Rend « La boutique n'est pas encore ouverte. » | cli |
| Edge case | Le même appel avec un code inconnu | Rend le message de l'erreur, jamais un code technique | cli |
| Teardown | none | Aucun état créé | — |

## Tasks to do

### `1)` `lib/shop.ts` — le client de la boutique

> Un seul propriétaire des requêtes et des erreurs de la boutique, calqué sur `lib/market.ts`.

1. Copier la mécanique d'extraction Eden de `lib/market.ts` (`toApiErrorInfo`, `isApiErrorValue`) :
   `ShopApiError extends Error` portant `code: string | null`.
2. `shopOrderQueryKey = (id?: string) => ['shop', 'order', id ?? ''] as const` et
   `shopOrderQueryOptions(id?: string)` : `queryKey` la clé ci-dessus, `enabled: Boolean(id)`,
   `queryFn` → `fetchShopOrder`, `staleTime: 0`, `retry: false`. Le paramètre est **optionnel**
   parce que la recherche de route rend `string | undefined`.
3. `fetchShopOrder(id)` appelle `api.api.v1.shop.orders({ id }).get()`, jette sur `error`, puis
   vérifie la forme (`status` dans `data`) et jette `data` sinon.
4. `createCheckout(packKey)` appelle `api.api.v1.shop.checkout.post({ packKey })` — **seulement**
   `packKey` — et rend `{ url }` après le même garde de forme.
5. `checkoutErrorMessage(error)` : `switch` sur `error.code` avec `SHOP_DISABLED`,
   `SHOP_DAILY_CAP_REACHED`, `UNKNOWN_PACK`, `UNAUTHORIZED`, `ORDER_NOT_FOUND`, repli sur
   `error.message`. Les textes sont importés depuis `content/boutique.ts` : aucune chaîne ici.
   C'est l'unique propriétaire du mapping ; `content/boutique.ts` ne redéfinit pas la fonction.

### `2)` `content/boutique.ts` — tous les libellés

> Aucun texte visible ne reste dans le JSX.

1. `BOUTIQUE` (`as const`) : `eyebrow`, `title`, `subtitle`, `balanceLabel`, `priceTtc`,
   `buy`, `buying`, `loadingSession`, `loading`, `retry`, `errors` (les cinq clés de codes +
   `fallback`).
2. `BOUTIQUE_SUCCESS` (`as const`) : `eyebrow`, `title`, `pending`, `pendingDetail`,
   `credited` (gabarit du nombre d'écus), `newBalance`, `refresh`, `missingSession`,
   `loading`, `retry`, `errors`.
3. `PACK_LABELS: Record<PackKey, { name: string; tagline: string }>` — quatre noms français,
   aucun vocabulaire de « cadeau », aucun prix barré.
4. `packPriceLabel(cents)` : `new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`
   sur `cents / 100`, formateur construit une seule fois au module.
5. `packBonusLabel(percent)` : `''` quand `percent === 0`, sinon `+N % d'écus`.
6. Si `DESIGN_SYSTEM.md` donne un numéro de salle à La Boutique, l'utiliser dans `eyebrow` ;
   sinon `Le cabinet · La Boutique`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `typecheck` passe ; `createCheckout` n'envoie que `packKey` ; aucun `fetch` ni `axios`. |
| 2 | Chaque code d'erreur exigé par le brief a un message français ; les prix sortent en `4,99 €` / `9,99 €` / `19,99 €` / `44,99 €`. |
