---
status: pending
---

# Instruction: La page de succès

## Architecture projection

```txt
apps/web/src/
  routes/
    boutique.succes.tsx      ✅ create
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | `/boutique/succes?session_id=cs_test_x`, aucun crédit en base | La page rend « Paiement en cours de confirmation… » | browser |
| Happy path | Le webhook crédite, une interrogation suivante lit `CREDITED` | Les écus crédités et le nouveau solde s'affichent, l'interrogation s'arrête | browser |
| Edge case | Le webhook n'arrive pas | Après ~10 s, l'interrogation cesse, un bouton `Rafraîchir` reste disponible | browser |
| Edge case | `session_id` absent | Message dédié, aucune requête | browser |
| Teardown | none | Aucune écriture en base | — |

## Wireframe

```txt
┌───────────────────────────────────────────┐
│ (1) En-tête : sur-titre, titre, filet      │
├───────────────────────────────────────────┤
│ (2) Feuille de statut                      │
│     ┌───────────────────────────────────┐ │
│     │ (3) message PENDING / CREDITED     │ │
│     │ (4) écus crédités + nouveau solde  │ │
│     │ (5) [Rafraîchir]                   │ │
│     └───────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

1. En-tête : même gabarit que les autres salles.
2. Feuille : `rounded-sheet border border-veil bg-cabinet-raised p-6`.
3. Message : `aria-live="polite"`, texte selon `PENDING`, `CREDITED`, erreur.
4. Détail : seulement quand `CREDITED` ; les écus viennent de l'ordre, le solde de la session.
5. Bouton : `min-h-11`, visible en `PENDING` après le plafond et en erreur.

## Tasks to do

### `1)` `routes/boutique.succes.tsx`

> La page lit l'API, jamais `?session_id` comme preuve de paiement.

1. `createFileRoute('/boutique/succes')` + `validateSearch` → `{ session_id?: string }`.
2. `useQuery({ ...shopOrderQueryOptions(sessionId), enabled: Boolean(sessionId),
   refetchInterval: (query) => query.state.data?.status === 'PENDING' &&
   query.state.dataUpdateCount < 6 ? 2_000 : false })` : cinq relectures, ~10 s, puis arrêt.
3. `PENDING` : message et détail de `BOUTIQUE_SUCCESS` ; `CREDITED` : écus
   (`priceLabel(order.ecus ?? 0)` — le schéma rend `number | null`) et nouveau solde ; erreur :
   `checkoutErrorMessage` (qui couvre déjà `ORDER_NOT_FOUND`) + bouton `Rafraîchir`.
4. Solde : `useQuery({ ...sessionQueryOptions, enabled: order.data?.status === 'CREDITED',
   staleTime: 0 })` puis `priceLabel(user.currency ?? 0)` — aucun `useEffect`, aucune écriture.
5. `session_id` absent : message dédié, `enabled: false`, aucune requête émise.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | `PENDING` s'affiche sans crédit optimiste ; `CREDITED` affiche écus et solde ; l'interrogation s'arrête d'elle-même ; `Rafraîchir` fonctionne sans recharger la page. |
