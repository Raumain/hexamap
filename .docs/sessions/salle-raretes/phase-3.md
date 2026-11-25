---
status: done
---

# Instruction: le banc E2E, la revue et la mémoire de session

## Architecture projection

```txt
.
├── packages/e2e/tests/
│   ├── rarete.spec.ts        ✅
│   └── core-loop.spec.ts     ✏  (garde de la Pépite, défaut trouvé par le banc)
└── .docs/sessions/salle-raretes/
    ├── plan.md               ✅
    ├── phase-1.md            ✅
    ├── phase-2.md            ✅
    ├── phase-3.md            ✅
    ├── review.md             ✅
    └── journal.md            ✅
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | vider le contexte de session, ouvrir `/rarete` à 390 px | un seul `h1`, aucun renvoi vers Le Seuil | browser |
| Happy path | lire les six paliers, les deux tables, les exemples | libellés exacts, somme à 100 %, 100 habitants → 400 pts | browser |
| Happy path | ouvrir la feuille « Autres salles » puis le lien | `/rarete` s'ouvre, le titre est visible | browser |
| Edge case | 1280 px | deux colonnes, `scrollWidth === clientWidth` | browser |
| Teardown | — | aucune donnée de joueur lue ni écrite | browser |

## Tasks to do

### `1)` Le cas E2E

> Trois cas dans un fichier neuf, sans fixture et sans référentiel.

1. `packages/e2e/tests/rarete.spec.ts` : contexte sans cookie, six libellés exacts, total à 100 %,
   deux tables de seuils, exemple 100 habitants → 400 pts, paragraphe de la rareté inversée.
2. Deuxième cas : la feuille « Autres salles » ouvre la salle en deux appuis.
3. Troisième cas : 1280 px, deux colonnes, aucun débordement.

### `2)` La revue hostile

> Une passe séparée, après la mesure, sur le diff complet.

1. Relire chaque fichier, relever gravité, écrire `.docs/sessions/salle-raretes/review.md`.
2. Corriger ce qui est *deal-breaker* ou supérieur, puis rejouer `ci:check` et le banc.

### `3)` Committer, pousser, ouvrir la PR

1. Commits atomiques en français ; journal daté dans `.docs/sessions/salle-raretes/journal.md`.
2. Vérifier la présence de `feat/v2-idees-wave-1` sur l'origine avant `gh pr create --base … --draft`.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Les trois cas sont verts, aucun ne dépend du référentiel ni d'une session. |
| 2 | La revue nomme chaque défaut avec sa gravité et conclut « prêt à livrer » ou « bloqué ». |
| 3 | La branche est poussée, la PR brouillon cible `feat/v2-idees-wave-1`, `ci:check` vert avec le compte relevé. |
