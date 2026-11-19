---
status: pending
---

# Instruction: Le cinquième onglet et sa feuille

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
apps/web/src/components/layout/
├── nav-items.ts         ✏️ modify  (copie de la feuille + prédicat de salle secondaire)
├── more-sheet.tsx       ✅ create  (la feuille « Autres salles »)
└── bottom-tab-bar.tsx   ✏️ modify  (cinquième contrôle, état, retour de focus)
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | `page.goto('/')`, session ouverte | La barre basse expose quatre liens et un bouton « Plus » | browser |
| Happy path   | Appui sur « Plus » puis sur « Les Planches » | `/tableaux` est rendu, la feuille est fermée | browser |
| Edge case    | `page.goto('/')` avec un `storageState` vide (aucune session) | La barre expose quatre cibles, aucun contrôle « Plus », et aucune salle secondaire n'est offerte | browser |
| Edge case    | Fenêtre redimensionnée à 1280 px alors que la feuille est ouverte | Ni voile ni feuille ne subsistent, le rail reprend la navigation | browser |
| Edge case    | Salle courante secondaire (`/market/mine`) | L'onglet « Plus » porte le traitement actif et le lien « Mes Offres » porte `aria-current="page"` | browser |
| Teardown     | Aucun état serveur touché | Base du banc inchangée | system |

## Wireframe

```txt
État fermé — 390 px
┌──────────────────────────────────────────────┐
│ (1) En-tête collant : sceau · salle · bourse  │
├──────────────────────────────────────────────┤
│ (2) Contenu de la salle courante              │
│                                               │
│                                               │
│                                               │
├──────────────────────────────────────────────┤
│ (3) Barre basse — cinq cibles de 44 px        │
│  Relevé  Cadastre  Planche  Comptoir   Plus   │
└──────────────────────────────────────────────┘

État ouvert
┌──────────────────────────────────────────────┐
│ (1) En-tête collant                          │
├──────────────────────────────────────────────┤
│ (4) Contenu assombri par le voile             │
│                                               │
│                                               │
├──────────────────────────────────────────────┤
│ (5) Feuille « Autres salles »                │
│  ┌────────────────────────────────────────┐  │
│  │            ────────  (6) poignée       │  │
│  │ (7) Autres salles            Fermer    │  │
│  ├────────────────────────────────────────┤  │
│  │ (8) ▣ Les Planches                  →  │  │
│  │     ▣ Mes Offres                    →  │  │
│  │     ▣ Les Archives                  →  │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

1. En-tête mobile inchangé : `MobileHeader` d'`app-shell.tsx`.
2. Contenu de la route : inchangé, toujours un seul `main`.
3. Barre basse : les quatre `PRIMARY_NAV` existants, plus un cinquième contrôle — présent seulement avec une session ouverte — qui ouvre la feuille au lieu de naviguer.
4. Voile `bg-cabinet/80` : ferme au toucher, jamais atteint par le clavier.
5. Feuille ancrée en bas : `fixed inset-x-0 bottom-0 z-50`, `rounded-t-panel`, `max-h-[76vh]`. Elle recouvre la barre, qui n'a donc pas de hauteur à partager.
6. Poignée décorative `aria-hidden`.
7. Titre `h2` qui nomme la `dialog` par `aria-labelledby`, et bouton de fermeture.
8. Les trois `SECONDARY_NAV`, chacun une cible d'au moins 44 px ; le lien de la salle courante porte `aria-current="page"`.

## Tasks to do

### `1)` Le modèle de salles

> `nav-items.ts` reste le seul propriétaire des salles ; il gagne un prédicat et une copie.

1. Ajouter `export const MORE_SHEET = { control: 'Plus', title: 'Autres salles', close: 'Fermer' } as const;` à côté de `SECONDARY_NAV`, sans créer de fichier `content/nav.ts` (les libellés de salle vivent déjà ici).
2. Ajouter `export function isSecondaryRoom(pathname: string): boolean { return SECONDARY_NAV.some((item) => isNavItemActive(item, pathname)); }`.

### `2)` La feuille

> Réutiliser la géométrie prouvée de `routes/tableau.tsx:477-500`, sans en copier la virtualisation.

1. Créer `apps/web/src/components/layout/more-sheet.tsx`, composant `MoreSheet({ pathname, onClose }: { pathname: string; onClose: () => void })`.
2. Envelopper le retour dans `<OverlayPortal>` ; conteneur `fixed inset-0 z-50 md:hidden` en `role="presentation"`, voile `absolute inset-0 bg-cabinet/80` en `aria-hidden="true"` avec `onClick={onClose}`.
3. Panneau `role="dialog" aria-modal="true" aria-labelledby={titleId}` (`useId()`), classes `fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-panel border-t border-brass/30 bg-cabinet-raised p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lifted`.
4. Poignée `aria-hidden`, `<h2 id={titleId}>` avec `MORE_SHEET.title`, bouton de fermeture `aria-label={MORE_SHEET.close}`.
5. Lister `SECONDARY_NAV` en `<Link to={item.to} onClick={onClose} aria-current={isNavItemActive(item, pathname) ? 'page' : undefined} className="flex min-h-[44px] items-center gap-3 …">`, glyphe puis libellé `item.label`.
6. Ajouter un `useEffect` de fermeture sur `Escape` avec nettoyage, comme `CardDrawer`.

### `3)` La barre basse

> Le cinquième contrôle est un bouton, jamais un `Link` : il ouvre, il ne navigue pas.

1. Dans `bottom-tab-bar.tsx`, lire la session avec `useSession()` et ne monter le cinquième contrôle que si `session.data?.user` existe — c'est la règle de visibilité du rail (`sidebar.tsx:56`).
2. Ajouter `useState(false)`, `useRef<HTMLButtonElement>(null)` sur le contrôle, et `close()` qui remet l'état à faux puis `plusRef.current?.focus()`.
3. Rendre `<button ref={plusRef} type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => (open ? close() : setOpen(true))}>` avec la même mise en forme que les onglets (`flex-1`, `min-h-[56px]`), un glyphe de trois points et le libellé court `MORE_SHEET.control`.
4. Appliquer le traitement actif (laiton + filet supérieur) quand `isSecondaryRoom(pathname)` est vrai, sans `aria-current` sur le bouton.
5. Monter `{open ? <MoreSheet pathname={pathname} onClose={close} /> : null}` après la `nav`.
6. Vérifier que rien ne change au-dessus de `md:` : la barre reste `md:hidden`.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `isSecondaryRoom('/tableau')` est faux et `isSecondaryRoom('/tableaux')` vrai ; aucune salle principale n'est marquée secondaire. |
| 2 | La feuille porte `role="dialog"`, un nom accessible « Autres salles », se ferme sur Échap et sur le voile, et chaque lien mesure au moins 44 px de haut. |
| 2 | Sur `/market/mine` le lien « Mes Offres » porte `aria-current="page"` et aucun autre lien de la feuille ne le porte. |
| 3 | Avec une session, cinq cibles occupent la barre ; sans session, quatre, et aucun bouton « Plus ». |
| 3 | Depuis `/`, deux appuis mènent à `/tableaux` ; après fermeture, le focus est sur « Plus » ; à 1280 px ni voile ni feuille ne subsistent. |
| 3 | Aucun débordement horizontal à 320 px, et les six cas existants de `mobile.spec.ts` restent verts sur Pixel 7 comme sur iPhone 13. |
