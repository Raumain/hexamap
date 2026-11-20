---
status: pending
---

# Instruction: La salle La Boutique

## Architecture projection

```txt
apps/web/src/
  components/shop/
    pack-card.tsx            ✅ create
  routes/
    boutique.index.tsx       ✅ create
  components/layout/
    nav-items.ts             ✏️ modify (entrée en fin de SECONDARY_NAV, SalonPath, SALON_TITLES)
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | Session ouverte, sans clé Stripe côté API | `/boutique` rend la salle et le solde | browser |
| Happy path | Lecture de la salle | Quatre planches, prix TTC français, bonus, un bouton par planche | browser |
| Edge case | Appui sur `Acheter` sans clé Stripe | `503 SHOP_DISABLED` → « La boutique n'est pas encore ouverte. », bouton réarmé | browser |
| Edge case | Session absente | Redirection vers `/login` | browser |
| Teardown | none | Aucune mutation en base | — |

## Wireframe

```txt
┌───────────────────────────────────────────┐
│ (1) En-tête de salle : sur-titre, titre,   │
│     filet de laiton, sous-titre            │
├───────────────────────────────────────────┤
│ (2) Bandeau : solde d'écus (laiton)        │
├───────────────────────────────────────────┤
│ (3) Grille de quatre planches              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │ (4) nom │ │         │ │         │      │
│  │ écus    │ │         │ │         │      │
│  │ prix TTC│ │         │ │         │      │
│  │ bonus   │ │         │ │         │      │
│  │ [Acheter]│ │        │ │         │      │
│  └─────────┘ └─────────┘ └─────────┘      │
│  ┌─────────┐                               │
│  └─────────┘                               │
├───────────────────────────────────────────┤
│ (5) Statut aria-live : erreur ou attente   │
└───────────────────────────────────────────┘
```

1. En-tête : même gabarit que `market.index.tsx` (sur-titre, `h1`, filet, sous-titre).
2. Bandeau : le solde vient de la session (`session.data.user.currency ?? 0`) via `priceLabel`.
3. Grille : `grid-cols-1 sm:grid-cols-2 xl:grid-cols-4`, une planche par pack de `PACKS`.
4. Planche : nom, écus, prix TTC, bonus, bouton `Acheter` à cible ≥ 44 px, état « Achat… ».
5. Statut : une seule zone `aria-live="polite"` qui porte l'erreur de checkout.

## Tasks to do

### `1)` `nav-items.ts` — la salle secondaire

> La feuille `Plus` suffit : aucun onglet principal n'est ajouté.

1. `SalonPath` gagne `'/boutique'` en fin d'union.
2. `SECONDARY_NAV` gagne `{ to: '/boutique', label: 'La Boutique', short: 'Boutique', glyph }`
   en **fin de liste** ; le glyphe reste un tracé 24 × 24 au trait (`strokeWidth` par défaut).
3. `SALON_TITLES` gagne `'/boutique': 'La Boutique'` (fin de table).
4. `isSecondaryRoom` est dérivée de `SECONDARY_NAV` : ne pas la modifier, seulement vérifier que
   `/boutique` y répond.

### `2)` `components/shop/pack-card.tsx` — la planche d'un pack

> Une planche porte le prix et un seul bouton.

1. Props : `pack: PackDefinition`, `pending: boolean`, `onBuy: (packKey: PackKey) => void`,
   `disabled: boolean`.
2. Rendu : `article` sur `rounded-sheet border border-veil bg-cabinet-raised p-5`, nom et accroche
   lus dans `PACK_LABELS[pack.key]` (`PackDefinition` ne porte aucun libellé), nom en
   `font-display`, écus via `priceLabel(pack.ecus)`, prix TTC via `packPriceLabel(pack.priceCents)`,
   bonus via `packBonusLabel(pack.bonusPercent)` (rien quand 0).
3. Bouton `type="button"`, `min-h-11` (≥ 44 px), `aria-busy={pending || undefined}`,
   libellé `BOUTIQUE.buy` / `BOUTIQUE.buying`, `aria-label` incluant le nom du pack.

### `3)` `routes/boutique.index.tsx` — la salle

> Même garde de session que Le Comptoir, aucune écriture locale du solde.

1. `createFileRoute('/boutique/')` + `validateSearch` qui rend `{ session_id?: string }` (premier
   `validateSearch` du dépôt : garder la forme `(search: Record<string, unknown>) => …`).
2. Garde : `useSession()`, `isPending` → ligne mono, `!session.data?.user` → `<Navigate to="/login" />`.
3. Si `session_id` est présent, rendre `<Navigate to="/boutique/succes" search={{ session_id }} replace />`
   (l'API renvoie sur `/boutique?session_id=…`).
4. `useMutation({ mutationFn: createCheckout, onSuccess: ({ url }) => window.location.assign(url) })`.
   `onError` laisse `checkoutErrorMessage` alimenter la zone `aria-live`.
5. Quatre `PackCard` depuis `PACKS` ; `disabled` quand aucune planche n'est en vol, `pending`
   seulement sur la planche dont la clé est `mutation.variables`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `/boutique` apparaît dans la feuille `Plus` et dans le rail, s'allume par `aria-current` sur `/boutique`, et `salonForPath('/boutique')` rend « La Boutique ». |
| 2 | Prix affichés en français, bonus absent pour `PACK_500`, bouton ≥ 44 px. |
| 3 | Le corps envoyé est `{ packKey }` ; la redirection suit `url` ; `503` affiche le message français sans laisser un bouton désarmé. |
