---
objective: "Choisir la carte à vendre dans un tiroir de planches filtré et virtualisé à la place de la liste déroulante de /market/mine, sans toucher au contrat d'API."
status: pending
---

# Plan: Phase 51 — vendre une carte par planches

Source: `.docs/09-idees.md` I-001, brief de la phase 51, `.docs/01-architecture.md` §4.5 et §4.9

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | module pur et spec | [`phase-1.md`](./phase-1.md) | none |
| 2   | tiroir, route et libellés | [`phase-2.md`](./phase-2.md) | 1 |
| 3   | banc E2E et mémoire de session | [`phase-3.md`](./phase-3.md) | 2 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none | Aucune source externe : le contrat est dans `.docs/` et dans le brief de phase |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | La liste déroulante de `apps/web/src/routes/market.mine.tsx:160-172` disparaît : sélection par planches, virtualisée, filtrée. `POST /market/listings` reste `{ userCardId, price }` (`apps/api/src/routes/market.ts:362-374`). | 2 |
| regression | Le parcours de vente n'avait aucun cas E2E (`grep 'Mettre en vente' packages/e2e/tests` ne rend que `mobile.spec.ts` via `/market/mine` dans les salles secondaires) : un cas neuf couvre sélection, envoi et verrouillage. | 3 |
| architecture | Aucune table, colonne, route ni champ d'API. Le module pur vit dans `apps/web/src/lib/card-picker.ts`, le composant dans `apps/web/src/components/card-picker.tsx`, `tableau.tsx` n'est pas touché. | 1, 2 |
| documentation | `plan.md`, `review.md` et `journal.md` dans `.docs/sessions/vendre-planche/`. Aucun autre document de mémoire ne change : ni la base, ni l'architecture. | 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Spec-first : un cas neuf vu rouge avant le code | Le module pur se verrouille par `packages/spec/src/card-picker.spec.ts`, écrit avant lui. |
| Aucun cas de `packages/spec` existant réécrit | La spec de cette phase est un fichier neuf ; le code s'adapte. |
| Tout passe par Docker | `ci:check` se lance par `docker compose --profile tools run --rm -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_51' dev bun run ci:check`, le banc par `docker compose -f docker-compose.e2e.yml` ; jamais `bun` sur l'hôte. |
| Français unique, libellés dans `src/content/` | Recherche, puces, état vide et compte de cartes sont des textes visibles neufs. |
| Aucune couleur littérale, aucun `filter` en liste virtualisée | `.docs/01-architecture.md` §4.9 et le brief. |
| La rareté n'est jamais recopiée | `RARITY_LABELS` de `@hexamap/shared`, `RarityBadge` et `RaritySeal` restent les seuls écrivains. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Un seul écran, `/market/mine` | I-001 laissait la question ouverte : le choix, le prix et le bouton tiennent dans une section dont la liste est bornée en hauteur, donc le prix reste au-dessus du clavier sans route ni navigation nouvelles. |
| Composant `card-picker.tsx` neuf, `CardDrawer` intact | Le tiroir de `tableau.tsx` est couplé aux emplacements et au tri par compatibilité ; il sert un autre travail, et `tableau.tsx` est interdit par le brief. |
| Filtres en mémoire, jamais au serveur | Les cartes sont déjà chargées par `collectionQueryOptions` (plafond 5 000) ; filtrer localement évite une route et une requête par frappe. |
| `refCode` cherché pour toutes les catégories | Le brief demande « nom ou code ». Une rue porte un identifiant interne en `refCode` : sa recherche reste un filtre de texte, sans heuristique de nom. |
