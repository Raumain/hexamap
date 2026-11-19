---
objective: "Sur mobile, chaque salle secondaire (`/tableaux`, `/market/mine`, `/import-status`) est listée et atteinte en deux appuis depuis `/`, la barre basse annonce la salle courante et le cinquième contrôle respecte 44 px."
status: pending
---

# Plan: BUG-005 — les salles secondaires atteignables sur mobile

Source: `ROADMAP.md` §2 « P2 — BUG-005: secondary rooms unreachable on mobile », et `.docs/04-bugs.md` §BUG-005 (lignes 285–336)

## Phases

| #   | Phase                                        | File                         | Depends on |
| --- | -------------------------------------------- | ---------------------------- | ---------- |
| 1   | Le filet rouge (cas e2e de la barre basse)    | [`phase-1.md`](./phase-1.md) | none       |
| 2   | Le cinquième onglet et sa feuille             | [`phase-2.md`](./phase-2.md) | 1          |
| 3   | Mémoire, registre et clôture                  | [`phase-3.md`](./phase-3.md) | 2          |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none  | Le patron de feuille basse existe déjà dans le dépôt (`apps/web/src/routes/tableau.tsx:442-578`) et aucun comportement de navigateur n'est incertain ici : aucune documentation externe n'a été consultée. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | none — aucun appel d'API, aucune requête base, aucun asset externe. Le défaut est entièrement du routage client : `SECONDARY_NAV` existe (`nav-items.ts:49-68`) et les trois routes existent (`tableaux.tsx`, `market.mine.tsx`, `import-status.tsx`). | none |
| regression | Faible. Trois cas de `mobile.spec.ts` touchent la barre : « la barre d'onglets est visible… » attend exactement une `nav` visible ; « les cibles tactiles font au moins 44 px » itère `nav.getByRole('link')`, donc un `<button>` ajouté ne l'atteint pas ; « aucun débordement horizontal » à 390 et 320 px (cinq colonnes `flex-1` à 320 px font ~64 px chacune). Bureau intact : la barre est `md:hidden` et le rail garde `SECONDARY_NAV`. Aucun de ces cas ne verrouille l'absence du cinquième contrôle. | 1, 2 |
| architecture | La coquille ne gagne aucune frontière : `OverlayPortal` (`components/ui/overlay-portal.tsx`) rend la feuille dans `document.body`, comme les deux overlays de route, et `nav-items.ts` reste seul propriétaire du modèle de salles. Aucune dépendance nouvelle, aucun contrat d'API, aucun schéma. | 2 |
| documentation | `DESIGN_SYSTEM.md` §9.2 fixe la barre basse à **quatre** onglets (`Relevé`, `Cadastre`, `Planche`, `Comptoir`) et ne nomme aucun chemin mobile vers les salles secondaires, qui n'apparaissent qu'en §9.1 — il doit être amendé. `.docs/04-bugs.md` BUG-005 passe en Corrigé. `.docs/01-architecture.md` §4.9 nomme les deux fichiers de la coquille. `ROADMAP.md` §2 perd l'entrée P2. `.docs/03-active-task.md` reçoit la phase et son journal. | 3 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Spec-first : le cas rouge est écrit et observé avant toute modification de composant | `AGENTS.md` règle 2, et le précédent du dépôt est la phase 20 (« Spec-first — trois cas rouges »). |
| Tout overlay passe par `OverlayPortal` | `.docs/01-architecture.md` §4.9 — un `transform` sur un ancêtre re-casserait un `fixed` ; `document.body` rend la récidive impossible. |
| Aucune couleur littérale, jetons du bloc `@theme` unique | §4.9 — `apps/web/src/styles.css` est le seul propriétaire des couleurs. |
| Français uniquement, aucun i18n | `AGENTS.md` règle 3. |
| Cibles tactiles de 44 px minimum | Critère d'acceptation de BUG-005 et `DESIGN_SYSTEM.md` §9.2. |
| `packages/spec` intact | §4.8 — le défaut est de la présentation et du routage, aucune formule de domaine ne change. |
| Tout s'exécute dans Docker, une phase se livre sur sa branche, aucun commit sans demande | `AGENTS.md` règles 1 et 8, section Git. Branche : `fix/bug-005-salles-secondaires-mobile`. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Le cinquième contrôle est un onglet ouvrant une feuille, pas le menu de compte | Le roadmap laisse les deux ouverts. L'en-tête mobile ne porte aucune affordance de compte (seulement la bourse et `Entrer`, `app-shell.tsx:16-47`), un menu de compte serait donc à inventer ; et sortir d'une barre de navigation est plus découvrable que de cacher trois salles derrière un contrôle de compte. |
| La feuille recouvre la barre au lieu de s'empiler dessus | S'empiler coudrait le `bottom` de la feuille à la hauteur mesurée de la barre, que `min-h-[56px]` rend variable alors que `DESIGN_SYSTEM.md` §9.2 la déclare à 64 px. Recouvrir réutilise la géométrie prouvée de `CardDrawer` (`fixed inset-x-0 bottom-0`, `rounded-t-panel`, `max-h-[76vh]`) sans aucune constante partagée. |
| Le cinquième contrôle n'apparaît qu'avec une session ouverte | `sidebar.tsx:56` enveloppe **tout** le bloc de navigation — principal et secondaire — dans `{user ? … : « Le cabinet ouvre ses tiroirs… »}`. La barre basse, elle, est rendue sans condition. Afficher la feuille à un visiteur anonyme exposerait donc trois salles que le rail lui cache. La parité est rétablie en montant le contrôle derrière `useSession()`, et prouvée par un cas anonyme. |
| `/import-status` est listé dans la feuille mais n'est pas suivi par le cas e2e | `DESIGN_SYSTEM.md` §9.1 rend cette salle conditionnelle (« si l'utilisateur y a droit ») ; ni le rail ni la feuille ne portent ce contrôle. La feuille garde la parité avec le rail et la preuve suit `/tableaux` et `/market/mine`, les deux salles que le roadmap nomme. L'écart de §9.1 est consigné au registre, pas traité ici. |
| Le calcul d'état actif reste dans `apps/web`, prouvé au niveau navigateur | `isNavItemActive` distingue déjà `/tableau` de `/tableaux` par égalité stricte (`nav-items.ts:90-97`) : il n'y a rien à corriger, seulement à verrouiller. Déplacer le modèle vers `packages/shared` pour atteindre `packages/spec` refactorerait la navigation pour une assertion, alors que tous les invariants d'UI de ce dépôt sont prouvés dans `packages/e2e`. |
