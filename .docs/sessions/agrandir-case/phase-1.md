---
status: done
---

# Instruction: Agrandir une case grattée

## Architecture projection

```txt
.
├── apps/web/src/
│   ├── content/
│   │   └── tickets.ts                            ✏️  detail des panneaux, libellés, revealedCellLabel
│   ├── components/
│   │   ├── revealed-cell.tsx                     ✏️  bouton superposé + onOpen
│   │   └── revealed-cell-modal.tsx               ✅  le dialogue unique
│   └── routes/
│       └── tickets.$ticketId.tsx                 ✏️  openCell, modale hors de <main>
├── packages/e2e/tests/
│   └── core-loop.spec.ts                         ✏️  un test.step neuf
└── .docs/sessions/agrandir-case/
    ├── plan.md                                   ✅
    ├── phase-1.md                                ✅
    ├── review.md                                 ✅
    └── journal.md                                ✅
```

Aucune migration, aucune route API, aucun champ de `maskedCellSchema`.

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| -------- | ------ | ------------------ | ----- |
| Setup | Gratter le bordereau jusqu'à épuisement (`core-loop.spec.ts`, étape « grattage complet ») | 16 cases révélées, chacune un bouton `Agrandir la case N — …` | browser |
| Happy path | Activer un bouton de case révélée | Dialogue `aria-modal` visible, hors de `<main>`, portant le Cartel ou le texte du panneau, `transform` de `<main>` = `none` | browser |
| Edge case | Échap sur le dialogue | Dialogue retiré, focus rendu au bouton d'origine | browser |
| Edge case | Cliquer/glisser une case **non** révélée | Aucun dialogue ne s'ouvre ; seul le grattage part au serveur | browser |
| Teardown | — | L'état du ticket est inchangé par l'ouverture (aucune requête) | browser |

## Wireframe

```txt
┌──────────────────────────────────────────┐
│ (1) En-tête de salle                     │
├──────────────────────────────────────────┤
│ (2) Grille 4 × 4                         │
│  ┌──────┬──────┬──────┬──────┐           │
│  │ (3)  │ (3)  │ (3)  │ (3)  │           │
│  ├──────┼──────┼──────┼──────┤           │
│  │ (3)  │ (3)  │ (3)  │ (3)  │           │
│  └──────┴──────┴──────┴──────┘           │
├──────────────────────────────────────────┤
│ (4) Carnet de bord                       │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│            (5) Dialogue                  │
│  ┌────────────────────────────────────┐  │
│  │ (6) Titre de la case               │  │
│  │ ┌────────────────────────────────┐ │  │
│  │ │ (7) Cartel ou texte du panneau │ │  │
│  │ └────────────────────────────────┘ │  │
│  │              (8) Fermer            │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

1. En-tête de salle : titre et sous-titre du Relevé, inchangés.
2. Grille `grid-cols-4` : géométrie du domaine, jamais responsive.
3. Case : `aspect-[3/5]`, bandeau de 16 px et planche ; une case révélée porte en plus le bouton d'ouverture superposé.
4. Carnet de bord : la liste des cases relevées, inchangée.
5. Dialogue : `role="dialog"`, `aria-modal`, rendu dans `document.body` par `OverlayPortal`, hors de `<main>`.
6. Titre : le nom de la carte ou du panneau, cible d'`aria-labelledby`.
7. Contenu : la planche `variant="detailed"` avec son attribution, ou le titre et le texte du panneau.
8. Fermer : bouton recevant le focus à l'ouverture ; Échap et clic sur le fond ferment aussi et rendent le focus à la case.

## Tasks to do

### `1)` Le texte des panneaux et les libellés de la modale

> `content/tickets.ts` porte tout le français de la salle ; la modale n'écrit aucune chaîne.

1. Ajouter `detail: string` à `PanelContent` et le renseigner sur les trois entrées avec la lettre de `.docs/01-architecture.md` §2.6 : Station-service « +2 coups de grattoir sur ce ticket. », Belvédère « Une carte Commune et la révélation gratuite d'une case adjacente. », Rénovation « +1 palier de rareté à la prochaine carte découverte. ».
2. Ne pas toucher à `description` (rendu `line-clamp-3` dans la case).
3. Ajouter au bloc `TICKET` : `cellDialogEyebrow`, `cellDialogClose`, `cellDialogCardFallback` ; et une fonction `revealedCellLabel(index, name)` rendant `Agrandir la case ${index + 1} — ${name}`.

### `2)` La modale, composant unique

> Un seul dialogue, deux contenus, rendu par `OverlayPortal`.

1. Créer `components/revealed-cell-modal.tsx`, `props { cell: TicketCell; onClose: () => void }`.
2. `useId()` pour `aria-labelledby` ; `role="dialog" aria-modal="true"` ; plein écran `fixed inset-0 z-50 grid place-items-center bg-cabinet/85 p-6`, fermeture sur `onPointerDown` quand `event.target === event.currentTarget` (même geste que la modale de Pépite de la route).
3. `useEffect` de montage : mémoriser `document.activeElement`, focaliser le bouton Fermer, écouter `Escape` sur `document`, et au nettoyage retirer l'écouteur et rendre le focus à l'élément mémorisé.
4. Carte (`CARD` | `TREASURE` | `TWIN` avec `cell.card`) → `<Card variant="detailed" … />` avec `type`, `rarity`, `name` (`card.nom || cell.nom || TICKET.cellDialogCardFallback`), `score`, `refCode`, `blasonUrl`, `blasonCredit`, et un `className` de largeur (`w-full max-w-[268px] mx-auto`).
5. Panneau (`STATION` | `BELVEDERE` | `RENOVATION`) → `PANEL_CONTENT[kind].label` en titre, `PANEL_CONTENT[kind].description` puis `.detail` en corps, et l'icône en SVG décoratif.
6. Titre `h2#id` du dialogue = le nom affiché, quelle que soit la branche.

### `3)` La case révélée devient une cible

> Le DOM de la case ne bouge pas : un bouton transparent le recouvre.

1. `RevealedCell` reçoit `onOpen: (cell: TicketCell) => void`.
2. La racine reste la `<div>` `relative flex aspect-[3/5] …` ; aucun `h-*`/`min-h-*`.
3. Ajouter, en **dernier enfant** de cette div, un `<button type="button" aria-haspopup="dialog" className="absolute inset-0 z-10 rounded-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass">` portant un `<span className="sr-only">{revealedCellLabel(cell.index, name)}</span>` et `onClick={() => onOpen(cell)}`.
4. Aucun `stopPropagation`, aucun gestionnaire ailleurs.

### `4)` La route monte le dialogue hors de `<main>`

1. `const [openCell, setOpenCell] = useState<TicketCell | null>(null)` ; `const closeCell = useCallback(() => setOpenCell(null), [])`.
2. `<RevealedCell key={cell.index} cell={cell} onOpen={setOpenCell} />`.
3. Rendre `{openCell ? <RevealedCellModal cell={openCell} onClose={closeCell} /> : null}` en frère de la modale de Pépite, après `</fieldset>` — le portail se charge de `document.body`.
4. Aucun `useQuery`, aucune mutation, aucune invalidation ajoutée.

### `5)` Le cas E2E

> `core-loop.spec.ts`, un `test.step` après « grattage complet ».

1. Compter les requêtes `/api/` avec `page.on('request', …)` avant l'ouverture.
2. Sélectionner `page.getByRole('button', { name: /^Agrandir la case \d+/ }).first()`, lire son nom accessible, le cliquer.
3. Assertions : dialogue visible ; `closest('main') === null` ; `getComputedStyle(main).transform === 'none'` ; `dialog.getByRole('heading')` porte le suffixe du nom du bouton ; le dialogue contient `article` **ou** un texte de panneau (`/grattages|case voisine|palier de rareté/`) par `.or()`.
4. Échap → dialogue détaché ; le bouton d'origine est `toBeFocused()` ; aucune requête `/api/` nouvelle.
5. Aucun sélecteur CSS, aucun `skip`, aucun délai ajouté.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Les trois panneaux portent un `detail` conforme à §2.6 ; aucun texte visible hors de `content/tickets.ts`. |
| 2 | Le dialogue est `role=dialog` + `aria-modal`, rendu dans `document.body`, fermé par bouton, Échap et fond. |
| 3 | Une case révélée est un `button` nommé « Agrandir la case N — … » ; une case non révélée n'est ni bouton d'ouverture ni cliquable. |
| 4 | `getComputedStyle(main).transform` reste `none` après ouverture ; aucune requête émise. |
| 5 | Échap ferme, le focus revient au bouton d'origine ; le banc du fichier touché est vert. |
