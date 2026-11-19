---
status: pending
---

# Instruction: Mémoire, registre et clôture

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
.
├── DESIGN_SYSTEM.md              ✏️ modify  (§9.2, la barre passe à cinq cibles et nomme la feuille)
├── ROADMAP.md                    ✏️ modify  (§2, l'entrée P2 BUG-005 disparaît)
└── .docs/
    ├── 01-architecture.md        ✏️ modify  (§4.9, la coquille nomme la feuille)
    ├── 03-active-task.md         ✏️ modify  (phase, critères, journal, sortie rouge)
    └── 04-bugs.md                ✏️ modify  (BUG-005 → Corrigé)
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | Pile du banc en marche  | Le garde-fou peut interroger PostgreSQL et les spécifications | system |
| Happy path   | `bun run ci:check` dans le conteneur `dev` | Les quatre étapes passent, 158 spécifications inchangées | system |
| Edge case    | Banc Playwright complet sur les quatre projets | 39 cas existants verts, plus les nouveaux cas mobiles sur les deux projets tactiles | system |
| Teardown     | Aucun fichier de code touché par cette phase | `git status` ne montre que de la prose | system |

## Tasks to do

### `1)` Le contrat visuel

> `DESIGN_SYSTEM.md` est le document que §4.9 cite : il ne peut pas rester faux.

1. En §9.2, remplacer « quatre onglets de 44 px minimum » par cinq cibles : les quatre salles principales et le contrôle « Plus ».
2. Décrire la feuille : `role="dialog"`, recouvre la barre, `rounded-t-panel`, trois entrées `SECONDARY_NAV`, cible de 44 px, `aria-current` sur la salle courante, fermeture par Échap, par le voile et par le bouton, retour de focus au contrôle, et un cinquième contrôle monté seulement quand une session est ouverte.
3. Ajouter une phrase qui relie §9.1 et §9.2 : les salles secondaires sont celles du rail sur bureau, celles de la feuille sur mobile.

### `2)` La coquille et l'architecture

> Une seule ligne, mais elle est lue par tout agent qui reprend la coquille.

1. En `.docs/01-architecture.md` §4.9, dans la puce « La coquille est unique », nommer `more-sheet.tsx` à côté de `sidebar.tsx` et `bottom-tab-bar.tsx`, et rappeler que la feuille passe par `OverlayPortal`.
2. Ajouter que le cinquième onglet est un `button` et non un `Link`, pour que le raisonnement ne se perde pas.

### `3)` Le registre

> BUG-005 ne se supprime pas, il se ferme.

1. Dans `.docs/04-bugs.md`, passer la ligne d'index de BUG-005 en `Corrigé` et donner le numéro de PR.
2. Dans l'entrée de BUG-005, ajouter une section « Correction » qui nomme la solution retenue (cinquième onglet et feuille), les fichiers touchés et le motif du choix face au menu de compte.
3. Y consigner que `DESIGN_SYSTEM.md` §9.1 rend `/import-status` conditionnel (« si l'utilisateur y a droit ») alors que ni le rail ni la feuille ne portent ce contrôle, et que la feuille et le rail partagent désormais la même règle de visibilité (session ouverte) : deux écarts connus, non traités ici.

### `4)` La tâche active et le roadmap

> Le journal cite la sortie rouge puis la sortie verte ; le roadmap perd l'entrée.

1. Dans `.docs/03-active-task.md`, remplacer l'en-tête par la phase 20 → 21 (ou le numéro suivant) : objectif, étapes cochées, critères d'acceptation, branche `fix/bug-005-salles-secondaires-mobile`.
2. Y citer la sortie rouge observée en phase 1 et la sortie verte de la phase 2, avec les commandes complètes.
3. Dans `ROADMAP.md` §2, retirer l'entrée « P2 — BUG-005 » ; si c'est la seule entrée P2 restante traitée, laisser les autres P2 en place sans renuméroter.

### `5)` Le garde-fou

> La seule preuve qui compte.

1. Lancer `docker compose --profile tools run --rm dev bun run ci:check` et exiger les quatre étapes vertes, 158 spécifications.
2. Lancer `docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test` et exiger le banc complet vert.
3. Ne pas commiter : la branche reste locale jusqu'à demande explicite.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | §9.2 décrit cinq cibles avec session et la feuille ; plus aucune phrase n'affirme que la barre en porte quatre, ni que les salles secondaires sont offertes à un visiteur anonyme. |
| 2 | §4.9 nomme `more-sheet.tsx` et `OverlayPortal`. |
| 3 | BUG-005 est `Corrigé` dans l'index et son entrée porte la section « Correction ». |
| 4 | La tâche active porte la phase, ses critères et les deux sorties de test ; le roadmap ne liste plus BUG-005. |
| 5 | `ci:check` vert à 158 spécifications et banc Playwright vert sur les quatre projets. |
