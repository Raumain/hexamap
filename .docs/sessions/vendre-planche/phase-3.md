---
status: pending
---

# Instruction: le banc E2E, la revue et la mémoire de session

## Architecture projection

```txt
.
├── packages/
│   └── e2e/
│       └── tests/
│           └── market-sell.spec.ts ✅
└── .docs/
    └── sessions/
        └── vendre-planche/
            ├── plan.md ✅
            ├── phase-3.md ✅
            ├── review.md ✅
            └── journal.md ✅
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | ouvrir `/market/mine` avec le compte de démonstration | le tiroir liste les cartes du combo E2E, aucune `combobox` | browser |
| Happy path   | chercher `E2E-C-RARE-0`, cliquer la planche, saisir 250, publier | un `POST /market/listings` part avec `{ userCardId, price: 250 }`, l'annonce rejoint « Mes annonces » | browser |
| Edge case    | après la vente, la même recherche dans le tiroir | la carte verrouillée a quitté la liste, l'état vide s'affiche | browser |
| Edge case    | 1280 px de large | le tiroir, le prix et le bouton restent visibles, aucun débordement | browser |
| Teardown     | annuler l'annonce créée | la carte redevient offerte à la vente | browser |

## Wireframe

```txt
┌───────────────────────────────────────────────┐
│ (1) Mes ventes                                 │
│  ┌───────────────────────────────────────────┐ │
│  │ (2) Mettre une carte en vente              │ │
│  │  recherche · puces · liste bornée          │ │
│  │  prix · « Mettre en vente »                │ │
│  └───────────────────────────────────────────┘ │
│  (3) Mes annonces : planche, prix, « Annuler » │
└───────────────────────────────────────────────┘
```

1. La salle garde son titre et sa structure.
2. La section de vente, seule touchée : le tiroir remplace la liste déroulante.
3. La liste des annonces existante reçoit la nouvelle vente.

## Tasks to do

### `1)` Écrire le cas E2E de vente

> Le parcours n'existait pas : il couvre sélection, envoi et verrouillage.

1. Créer `packages/e2e/tests/market-sell.spec.ts` : absence de `combobox`, bornage des lignes rendues, filtres, sélection `aria-pressed`, corps de requête capturé, annonce visible, carte retirée du tiroir.
2. Ajouter le passage à 1280 px dans le même fichier.
3. Rejouer le banc complet dans Docker et constater le vert.

### `2)` Relire le diff et écrire la revue

> Une passe séparée, hostile, avant de committer.

1. Relire chaque fichier touché, relever gravité, écrire `.docs/sessions/vendre-planche/review.md`.
2. Corriger tout défaut *deal-breaker* et rejouer `ci:check` puis le banc.

### `3)` Committer, pousser, ouvrir la PR

> Une branche par phase, une PR en brouillon vers `v2`.

1. Commits atomiques en français, journal daté dans `.docs/sessions/vendre-planche/journal.md`.
2. Vérifier `git ls-remote --exit-code --heads origin v2` avant `gh pr create --base v2 --draft`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1... | Le cas passe sur `chromium`, prouve la sélection par planche, le corps exact de la requête et le verrouillage de la carte. |
| 2... | La revue nomme chaque défaut avec sa gravité et se conclut « prêt à livrer » ou « bloqué ». |
| 3... | La branche est poussée, la PR en brouillon cible `v2`, `ci:check` est vert avec le nombre de spécifications relevé. |
