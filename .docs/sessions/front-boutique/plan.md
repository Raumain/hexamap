---
objective: "La salle /boutique vend les quatre packs d'écus par redirection Stripe et /boutique/succes confirme le crédit en lisant GET /shop/orders/:id, sans clé Stripe la salle l'annonce et ne propose rien."
status: pending
---

# Plan: Phase 30.4 — La salle de la Boutique et la page de succès

Source: brief de session phase 304 + `ROADMAP.md` §2.B (30.6), contrat API livré par la vague 2
(`apps/api/src/routes/shop.ts`, `packages/shared/src/packs.ts`).

## Phases

| #   | Phase                | File                                       | Depends on |
| --- | -------------------- | ------------------------------------------ | ---------- |
| 1   | Client et contenu    | [`phase-1.md`](./phase-1.md)               | none       |
| 2   | La salle             | [`phase-2.md`](./phase-2.md)               | 1          |
| 3   | La page de succès    | [`phase-3.md`](./phase-3.md)               | 1          |
| 4   | La preuve            | [`phase-4.md`](./phase-4.md)               | 2, 3       |

## External sources

| URL | What it settled |
| --- | --- |
| none | Le contrat API est dans le dépôt (vague 2) ; aucune documentation externe consultée. |

## Impact

| Category | Verdict and evidence | Handled in |
| -------- | -------------------- | ---------- |
| runtime | Deux routes client et un module client s'ajoutent ; aucun appel réseau nouveau hors `POST /shop/checkout` et `GET /shop/orders/:id`, déjà servis par l'API de la vague 2. Aucun changement serveur. | 1, 2, 3 |
| regression | `nav-items.ts` alimente le rail desktop, la feuille `Plus` et `salonForPath` : les cas existants de `mobile.spec.ts` qui parcourent `SECONDARY_NAV` sont **à rejouer** (ils itèrent une liste fixe, donc rien ne casse par construction, mais la preuve est l'exécution, pas la lecture). | 2, 4 |
| architecture | Aucune décision nouvelle : §2.8 (prix serveur, aucun crédit client) et §4.5 (TanStack Query, libellés dans `content/`) suffisent. Aucun jeton `@theme` ajouté. | none |
| documentation | Aucun contrat de données ni de schéma touché (aucune migration réservée). Le journal de phase porte les écarts ; `.docs/02-database.md` reste inchangé. | 4 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Toute commande passe par Docker | `ci:check`, `playwright` et `tsr generate` tournent dans les conteneurs `dev` / `playwright`. |
| Français uniquement, aucun i18n | Tous les libellés vivent dans `content/boutique.ts`. |
| `routeTree.gen.ts` n'est jamais édité à la main | Les deux routes sont produites par `tsr generate`, lancé par `typecheck`. |
| Aucune dépendance nouvelle | TanStack Query, Eden et `@hexamap/shared` suffisent. |
| Ajout à la fin des listes partagées | `SECONDARY_NAV`, `SalonPath` et `SALON_TITLES` reçoivent l'entrée en fin de liste. |
| Serveur autoritaire, aucun crédit client | Le client n'envoie que `packKey` ; le solde n'est jamais écrit localement. |
| Pas de sixième onglet | `PRIMARY_NAV` reste à quatre salles ; la feuille `Plus` porte La Boutique. |

## Decisions

| Decision | Why |
| -------- | --- |
| La salle de succès vit sur `/boutique/succes`, et `/boutique?session_id=…` y **redirige** | L'API (`shop.ts:111-118`) construit `successUrl` sur `/boutique?session_id={CHECKOUT_SESSION_ID}`, alors que le brief nomme `boutique.succes.tsx`. Un `Navigate` de trois lignes réconcilie les deux sans toucher au serveur. |
| Fichiers `boutique.index.tsx` + `boutique.succes.tsx`, jamais `boutique.tsx` | En routage fichier, `boutique.succes.tsx` devient **enfant** de `boutique.tsx` : la page de succès se rendrait dans la salle et exigerait un `<Outlet />`. Deux frères, comme `market.index.tsx` / `market.mine.tsx`, évitent le piège. |
| La session est rafraîchie par `useQuery({ ...sessionQueryOptions, enabled: statut === 'CREDITED', staleTime: 0 })` | TanStack Query v5 n'a plus `onSuccess` sur `useQuery` : activer l'observateur au moment du crédit déclenche la relecture du solde sans `useEffect`, sans invalidation dans un rappel de minuterie et sans écriture optimiste. |
| Les codes `SHOP_DAILY_CAP_REACHED` et `UNKNOWN_PACK` sont mappés bien que l'API ne les émette pas encore, et `ORDER_NOT_FOUND` l'est aussi | Le plafond quotidien est un pas postérieur (`ROADMAP` 30.7) ; les mapper maintenant évite une salle muette le jour où il arrive. `ORDER_NOT_FOUND` est **déjà** émis par `shop.ts:159` sur une commande d'autrui. Aucun code serveur n'est ajouté ici. |
| `checkoutErrorMessage` n'a qu'un propriétaire, `lib/shop.ts` | Le brief le nomme dans `lib/shop.ts` **et** dans `content/boutique.ts` : les textes vivent dans le contenu, la fonction de mapping dans la lib. Une seule fonction, aucun doublon. |
| Les écus réutilisent `priceLabel` de `content/market.ts`, les euros passent par `Intl.NumberFormat` | Un seul formateur d'écus dans le dépôt ; les prix TTC sont des centimes (`priceCents / 100`) et jamais un flottant affiché brut. |
