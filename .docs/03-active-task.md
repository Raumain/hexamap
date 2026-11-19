# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

# Phase 15 — Le Cartel (fiche de planche)

## Statut

- **Phase** : 15 — Le Cartel (fiche de planche)
- **État** : Terminé
- **Priorité** : P1
- **Mis à jour** : 2026-11-19
- **Branche** : `feat/phase-15-cartel`

---

## Objectif

Donner à chaque planche une **salle** : `/card/$cardId` affiche la fiche complète d'une carte
possédée — le montage, le cartel, le lieu, les réserves, et l'action de vente ou d'achat quand
elle a lieu d'être. Toute vignette de l'application y mène : Le Cadastre, Le Comptoir, Mes
Offres, La Planche. La salle lit une seule réponse serveur (`GET /api/v1/cards/:id`) et ne
recalcule rien.

---

## Étapes

### 1. Client et libellés
- [x] `apps/web/src/lib/card-detail.ts` : `cardDetailQueryKey`, `CardDetailApiError`,
      `fetchCardDetail`, `CardDetail`, `cardDetailQueryOptions`, `cardDetailErrorMessage`
      (`CARD_NOT_VISIBLE`, `CARD_NOT_FOUND`), calqué sur `lib/market.ts`.
- [x] `apps/web/src/content/card-detail.ts` : `CARD_DETAIL`, `CARD_SOURCE_LABELS`, `stateLabel`.

### 2. La salle
- [x] `apps/web/src/components/ui/card-link.tsx` : `CardLink` (passe-plat typé vers
      `/card/$cardId`) et `cardLinkLabel`.
- [x] `apps/web/src/routes/card.$cardId.tsx` : garde de session identique aux autres salles
      (`isPending` → ligne mono, sans utilisateur → `/login`), états chargement / erreur
      avec `Réessayer` / succès.
- [x] Deux colonnes à partir de `lg` : à gauche le montage (`lg:sticky`), à droite quatre
      feuilles — cartel (vélin), lieu (carton sombre), réserves (tuiles pointillées
      « À paraître »), mise à l'offre (formulaire, annonce en cours, verrou, ou `Acquérir`).

### 3. Les planches deviennent cliquables
- [x] `routes/collection.tsx` (cellule `nom` du registre).
- [x] `routes/market.index.tsx` (`ListingCard`), `routes/market.mine.tsx` (`MyListingCard`).
- [x] `routes/tableau.tsx` (`SlotRow`) : le lien enveloppe la planche seule, jamais les boutons
      Modifier/Retirer ; l'épingle de laiton reste hors du lien.
- [x] Inchangés volontairement : `components/revealed-cell.tsx` (la charge utile de révélation
      ne porte pas `user_cards.id`) et `components/tableau/combo-board.tsx` (planche déjà dans
      un `<button>` : contenu interactif imbriqué interdit).

### 4. Navigation et documentation
- [x] `components/layout/nav-items.ts` : `salonForPath('/card/…')` → `'Le Cartel'`.
- [x] `DESIGN_SYSTEM.md` §2 (ligne de salle) et §8.7 (Le Cartel).
- [x] Cette entrée.

---

## Critères d'acceptation

1. [x] `/card/$cardId` rend la fiche depuis `GET /api/v1/cards/:id`, sans requête
       supplémentaire ni recalcul côté navigateur.
2. [x] Chaque planche du Cadastre, du Comptoir, de Mes Offres et de La Planche mène à la fiche.
3. [x] Une planche du joueur, ni verrouillée ni en vente, propose un formulaire « Mettre à
       l'offre » fonctionnel (prix entier 1 → 1 000 000, validation identique à Mes Offres).
4. [x] Une planche d'autrui en vente propose « Acquérir » avec le même jeu d'invalidations que
       Le Comptoir.
5. [x] Mobile et desktop occupent toute la largeur, sans défilement horizontal ; cibles
       tactiles ≥ 44 px.
6. [x] Uniquement les jetons du `@theme`, libellés français, aucune dépendance nouvelle.
7. [x] `lint`, `typecheck`, `bun test packages/spec`, `build` passent dans Docker.

---

## Journal

### 2026-11-19 — Phase 15 exécutée : Le Cartel livré

**Ce qui a été construit**
- `lib/card-detail.ts` : client de la fiche (même extraction d'erreur Eden que `lib/market.ts`,
  clé de requête `['cards', 'detail', id]`, `staleTime` 15 s, `retry: false`).
- `content/card-detail.ts` : tous les libellés de la salle, `CARD_SOURCE_LABELS` et `stateLabel`.
- `components/ui/card-link.tsx` : `CardLink` + `cardLinkLabel`, anneau de laiton au focus.
- `routes/card.$cardId.tsx` : le montage (`enter-plate`, cône de lumière, code de référence
  entre deux filets, attribution du blason) et les quatre feuilles. Le formulaire de vente
  invalide `myListings`, `marketListings`, `collection`, `collectionStats`, `tableauxList` et
  la fiche ; l'achat ajoute la session. Chaque panneau porte son propre `useMutation`, donc
  aucun hook conditionnel.
- Quatre registres rendent la planche cliquable (`CardLink` porte la largeur, la planche garde
  ses classes) ; `salonForPath` nomme la salle.

**Vérification (Docker uniquement)**
```
docker compose --profile tools run --rm dev bun run lint
  Checked 146 files in 105ms. No fixes applied.

docker compose --profile tools run --rm dev bun run typecheck
  tsc --noEmit × 6 workspaces (dont `tsr generate && tsc --noEmit` sur apps/web)

docker compose --profile tools run --rm dev bun test packages/spec
  140 pass, 0 fail, 746 expect() calls, 9 fichiers

docker compose --profile tools run --rm dev bun run build
  ✓ built in 869ms — chunk `card._cardId-CDcK01i0.js` 21,62 kB
```
- Pile de développement (`docker compose ps`) : `api`, `db`, `web` en marche. La route
  `/card/$cardId` figure dans `routeTree.gen.ts` (généré par `tsr generate`, jamais édité à la
  main) et Vite sert le module (`200` sur `/src/routes/card.$cardId.tsx`) ainsi que la page
  (`200` sur `/card/<id>`) sans redémarrage.

**Correctif BUG-004 (2026-11-19)**
- La modale « Pépite découverte » n'est plus dérivée de `ticket.treasureFound` : elle
  s'ouvre uniquement sur l'effet `TREASURE_FOUND` de la mutation de grattage, se ferme
  par bouton, `Escape` ou clic sur le fond, rend le focus à la grille, et laisse une
  ligne non bloquante « Pépite trouvée » quand le ticket est revisité. Fichiers :
  `apps/web/src/routes/tickets.$ticketId.tsx`, `apps/web/src/content/tickets.ts`,
  `.docs/04-bugs.md`. Aucune évolution d'API ni de schéma.

**Portée**
- Aucune migration, aucune évolution du schéma. Le seul contrat d'API concerné est
  `GET /api/v1/cards/:id`, déjà livré et laissé intact.
- `components/revealed-cell.tsx` et `components/tableau/combo-board.tsx` restent sans lien,
  pour les raisons consignées ci-dessus.
- Aucun commit.

---
---

# Historique — Phase 14 — Le Cabinet de cartographie (design system v4)

## Statut

- **Phase** : 14 — Le Cabinet de cartographie (design system v4)
- **État** : Terminé
- **Priorité** : P1
- **Mis à jour** : 2026-11-18
- **Branche** : `feat/phase-14-cabinet`

---

## Objectif

Remplacer la direction « papier IGN + signalétique routière » de la phase 13 par celle du
**cabinet de cartographie** décrite par `DESIGN_SYSTEM.md` (révision 4) : une pièce sombre,
des planches de vélin, du laiton et de la cire, la rareté rendue par le métal du cadre et non
par une pastille de couleur. La refonte couvre la documentation, la coquille de navigation et
tous les écrans, à domaine et contrats d'API constants.

---

## Étapes

### 1. Jetons, polices et coquille
- [x] `apps/web/src/styles.css` : unique bloc `@theme` (pièce, vélin, encre, laiton, cire, six métaux, rayons, ombres, durées), grain fixe `body::after`, `.vellum`, utilitaires de planche.
- [x] Six `@font-face` auto-hébergées sous `apps/web/public/fonts/` — Fraunces, Instrument Sans, JetBrains Mono, chacune en deux sous-ensembles (`latin`, `latin-ext`) ; `index.html` précharge les deux `latin` et déclare `viewport-fit=cover`.
- [x] `components/layout/app-shell.tsx` + `sidebar.tsx` (rail desktop) + `bottom-tab-bar.tsx` (onglets mobiles), zones de sécurité `env(safe-area-inset-*)`, un seul `main` par route.

### 2. Rareté en métaux
- [x] `RARITY_ACCENT_HEX` (`packages/shared/src/rarity.ts`) porte les six métaux (étain, cuivre, argent, émail, or, électrum) ; `RARITY_LABELS` porte les libellés français.
- [x] `apps/web/src/lib/rarity-theme.ts` n'ajoute que l'initiale du sceau, l'épaisseur du filet et l'encre lisible.
- [x] `components/ui/rarity-seal.tsx` : unique marque de rareté ; `rarity-badge.tsx` reste le libellé inline.

### 3. Les quatre planches
- [x] `components/ui/Card.tsx` aiguille vers `region-card.tsx`, `departement-card.tsx`, `commune-card.tsx`, `rue-card.tsx`, sur le châssis commun `cards/card-shell.ts`.
- [x] `apps/web/src/lib/commune-vignette.ts` : silhouette de village déterministe depuis le code INSEE.
- [x] Budget DOM ≤ 18 nœuds non-SVG par planche (internes d'un `<svg>` exclus).

### 4. Les salles
- [x] Le Relevé (`/`), Le Cadastre (`/collection`), La Planche (`/tableau`), Le Comptoir (`/market`), Le Seuil (`/login`, `/register`), Les Archives (`/import-status`).

### 5. Qualité
- [x] `packages/e2e/tests/design-system.spec.ts` réécrit pour la v4 : fond `cabinet`, couche de grain, quatre gravures distinctes, budget ≤ 18 nœuds, déterminisme de la vignette communale, multiplicateur piloté par le serveur.

---

## Critères d'acceptation

1. [x] Aucune trace de la direction routière (EB10, plaque émaillée, liseré rouge de commune) dans `apps/web`.
2. [x] Un seul bloc `@theme`, six `@font-face`, aucun `tailwind.config.ts`.
3. [x] Six métaux de rareté alignés entre `packages/shared`, `rarity-theme.ts` et les specs.
4. [x] Quatre planches aux gravures distinctes, toutes ≤ 18 nœuds non-SVG.
5. [x] Coquille unique (rail desktop, barre basse mobile) et un seul `main` par route.
6. [x] Les effets restent interdits dans les listes virtualisées et autour du canvas de grattage.

---

## Journal

### 2026-11-18 — Phase 14 exécutée : cabinet de cartographie livré

**Vérification** (dans le conteneur)
- `bun run lint` : propre, 139 fichiers.
- `bun run typecheck` : propre sur les six workspaces.
- `bun test packages/spec` : **133 pass, 0 fail**.
- `bun run build` : OK.
- `playwright test` (banc `docker-compose.e2e.yml`, image de production) : **12 pass,
  1 skip**. Parcours critique, CORS, et huit contrôles du design system (fond, grain,
  Fraunces, chiffres tabulaires, quatre gravures, budget ≤ 18 nœuds, vignette déterministe,
  absence de filtre dans la liste et autour du canvas). Le cas ignoré est la comparaison du
  multiplicateur, qui exige une collection plaçable dans le tiroir de démonstration.

**Corrections trouvées par le banc**
- La planche forçait `w-full` sur sa racine : les vignettes `w-11` du registre étaient
  écrasées et la carte occupait toute la ligne. La largeur est désormais portée par l'appelant.
- Le libellé accessible de la case de grattage est « Case N, non révélée » ; les sélecteurs
  E2E du parcours clavier ont suivi.
- Le parcours critique s'exécute dans un contexte vierge (`storageState` vide), l'inscription
  redirigeant un utilisateur déjà connecté.
- La plaque de calcul lit `preview.alignment` et `preview.total` : plus aucun recalcul
  d'alignement ni de total dans le navigateur.
- La plaque Rue tombe à 17 nœuds pour rester sous le budget même en variante détaillée ; la
  Commune affiche son code INSEE à défaut de population.

**Ajustements du 2026-11-18 (retour utilisateur)**
- **Contraste.** `--color-ink-faint` assombri à `#6a5e4c` ; plus aucun texte utile sous
  `text-vellum/55` sur la pièce ; la pastille de rareté passe en **aplat de métal** avec texte
  éclairci par `color-mix`, ce qui garantit ≥ 4,5:1 pour les six paliers (l'émail était
  illisible). La rareté reste toujours nommée, jamais portée par la couleur seule.
- **Taille.** `.exhibit` ouvre un conteneur (`container-type: inline-size`) et toutes les
  tailles internes (nom, étiquettes, blason, sceau) passent en `cqi` bornés par `clamp()`.
  Une seule planche, lisible de 56 px à 320 px, au lieu d'une vignette appauvrie.
- **Cohérence et blasons.** Le registre n'utilise plus `decorative` : il affiche la planche
  entière, comme Le Comptoir et La Planche. Le serveur servant déjà `blason_url ?? contour_url`
  dans `blasonUrl`, le contour apparaît quand il existe ; le blason est visible sur les trois
  catégories qui en portent.
- **Espace.** Colonne de contenu portée à `max-w-[1600px]`, registre à 152 px de ligne et
  hauteur calculée sur `100dvh`, Comptoir à quatre colonnes en `2xl`, chapiteau du Relevé à
  240 px.
- **Favicon.** `apps/web/public/favicon.svg` (hexagone de laiton), déclaré dans `index.html`.

**Ajustements du 2026-11-19 (Cadastre mobile)**
- **Un seul défilement.** Le registre quitte le conteneur à hauteur fixe pour
  `useWindowVirtualizer` : la fenêtre est l'unique zone de défilement. Plus de barre
  imbriquée, plus de `calc(100dvh - …)` à recalculer.
- **Mobile.** L'en-tête de colonnes et les colonnes secondaires sont masqués sous `md` ; la
  ligne devient une colonne unique d'environ 142 px qui montre la planche (84 px), le nom,
  `Catégorie · score pts`, la pastille de rareté, la date et l'état verrouillé. **Aucun
  défilement horizontal.**
- **Filtres.** Sur mobile : recherche pleine largeur avec loupe, puis onglets de catégorie,
  puis rareté ; sur desktop, l'ordre inverse. La barre reste collante sous l'en-tête de salle
  (`calc(3.5rem + env(safe-area-inset-top))`) et devient **opaque** pour qu'aucune ligne ne
  passe derrière. Les compteurs passent en quatre colonnes dès le mobile.
- **Vérifié** en captures 390 × 844 et 1600 × 1000 : un seul défilement, lignes rendues après
  défilement, aucune colonne coupée.

**Portée**
- Aucune modification de domaine métier, de migration ou de contrat d'API. Aucun commit.

---
---

# Historique — Phase 13 — Design system IGN & signalétique routière

> Archive. La direction papier IGN et signalétique routière a été remplacée par le cabinet de
> cartographie (phase 14). Le journal ci-dessous décrit l'état au 2026-11-18.

## Statut

- **Phase** : 13 — Design system IGN & signalétique routière française
- **État** : Terminé — couverture E2E écrite, exécution à valider sur la pile Docker
- **Priorité** : P1
- **Mis à jour** : 2026-11-18
- **Branche** : `feat/phase-13-design-system`

---

## Objectif

Passer l'interface d'un thème sombre « SaaS » à la direction **cartographie IGN + panneaux
routiers français** décrite par `DESIGN_SYSTEM.md`, sans toucher au domaine ni aux contrats
de l'API. Les jetons, les polices, les quatre gabarits de carte, le tableau de combo et
l'ensemble des routes web sont repris ; la rareté reste une donnée du domaine partagé.

À la fin de cette phase :
- `apps/web/src/styles.css` porte l'unique bloc `@theme`, les quatre `@font-face` et le
  `@layer base` ; les classes `card-foil` / `card-glow` / `card-holo` / `card-glitch` ont
  disparu, avec leurs keyframes et le bloc `prefers-reduced-motion`.
- Les polices sont auto-hébergées sous `apps/web/public/fonts/`, sans CDN au runtime.
- Six paliers de rareté dans `packages/shared`, un seul `RarityBadge`, quatre gabarits
  procéduraux mesurés sous 12 nœuds.
- Le tableau de combo lit l'alignement du serveur et ne recalcule rien.
- Toute l'application est passée en mode papier clair : plus de dégradé, de mode de fusion,
  de `backdrop-blur`, d'ombre floutée ni de `transition-all`.

Cette phase **n'écrit pas de nouveau comportement métier** : elle change l'habillage et
extrait des composants, à comportement constant.

---

## À lire avant de coder

1. `DESIGN_SYSTEM.md` — §3 (jetons, polices), §3.2 (rareté), §5 (gabarits et budget),
   §6.3 (tableau de combo).
2. `.docs/01-architecture.md` §4.5 (frontend), §4.9 (design system) et §6.1 (une seule origine).
3. `packages/shared/src/rarity.ts` et `packages/shared/src/tableau.ts`.

---

## Étapes

### 1. Jetons et polices
- [x] Remplacer le thème sombre de `apps/web/src/styles.css` par un unique bloc `@theme` (surfaces, encres, accents `sign-*`, trois `--shadow-tactile-*` à 0 px de flou).
- [x] Ajouter `@layer base` (`body` sur `--color-canvas`, `--color-ink`, `--font-sans`) et les pseudo-éléments `.rue-plaque::before/::after`.
- [x] Supprimer `.card-foil`, `.card-glow`, `.card-holo`, `.card-glitch`, leurs keyframes et le bloc `prefers-reduced-motion` devenu inutile.
- [x] Poser quatre `@font-face` : Space Grotesk et JetBrains Mono, chacune en `latin` + `latin-ext` avec `unicode-range`, `font-display: swap`.
- [x] Versionner les cinq fichiers sous `apps/web/public/fonts/` (`SpaceGrotesk-latin.woff2`, `SpaceGrotesk-latin-ext.woff2`, `JetBrainsMono-latin.woff2`, `JetBrainsMono-latin-ext.woff2`, `OFL.txt` — SIL OFL, sous-ensembles Fontsource).
- [x] Précharger les deux fichiers `latin` seulement depuis `apps/web/index.html`. Aucun CDN.
- [x] Activer `css.parser.tailwindDirectives: true` dans `biome.json` : sans quoi Biome 2.6 ne parse pas `@theme` et l'étape 1 de `ci:check` échoue.

### 2. Rareté et thème
- [x] `packages/shared/src/rarity.ts` : exporter `RARITY_LABELS` (`INHABITUELLE` = « Peu commune ») et `RARITY_ACCENT_HEX`.
- [x] `packages/spec/src/rarity.spec.ts` : parité six paliers, libellés exacts, format hexadécimal, `RARITY_WEIGHTS` somme à 100.
- [x] Créer `apps/web/src/lib/rarity-theme.ts` (`RARITY_THEME`, libellé et accent réexportés depuis shared).
- [x] Créer `apps/web/src/lib/category-theme.ts` : il absorbe `CATEGORY_ACCENT` et les anciens motifs SVG par catégorie.
- [x] Supprimer `apps/web/src/components/ui/card-styles.ts` et les cinq copies locales de `RarityBadge`.
- [x] Créer `apps/web/src/components/ui/rarity-badge.tsx` : l'unique badge de rareté.

### 3. Gabarits de carte
- [x] Créer le châssis commun `apps/web/src/components/ui/cards/card-shell.ts`.
- [x] `region-card.tsx` : courbes de niveau IGN en SVG, `bg-paper`, blason en calque de fond.
- [x] `departement-card.tsx` : bouclier octogonal en `clip-path`, code en filigrane, blason en calque de fond, pied `DÉP. · {score} pts`.
- [x] `commune-card.tsx` : cartouche EB10 à liseré rouge, puce population, un `<img>` de blason.
- [x] `rue-card.tsx` : plaque émaillée, `bg-sign-blue` pour `COMMUNE`/`INHABITUELLE`, `bg-sign-green` à partir de `RARE`, deux rivets en pseudo-éléments.
- [x] Transformer `apps/web/src/components/ui/Card.tsx` en aiguilleur sur `type`, en conservant `CardProps` (`variant` ne pilote que le pied).
- [x] Mesurer les quatre gabarits : Région 11, Département 9, Commune 10 (11 avec le blason), Rue 6.

### 4. Tableau de combo
- [x] Extraire `apps/web/src/components/tableau/combo-board.tsx` (`grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4`).
- [x] Extraire `alignment-connector.tsx` : ligne SVG entre cases à partir de `lg`, badges `✓ Aligné` / `✗ Hors-zone`, plus `AlignmentLinkList` pour le rendu sous `lg`.
- [x] Extraire `multiplier-panel.tsx` : `×N` en `font-mono tabular-nums`, `aria-live`.
- [x] Dériver chaque état de `alignment.breakdown[].valid` et `alignment.multiplier` ; ne jamais itérer `alignment.links`, qui est un nombre.
- [x] Retirer les halos floutés et le `scale-[1.02]` de `MULTIPLIER_TIERS` ; quatre paliers conservés.

### 5. Balayage de l'application
- [x] Migrer toutes les routes et les composants partagés (`button`, `text-field`, `form-error`, `revealed-cell`, `scratch-cell`) du slate sombre vers les jetons clairs.
- [x] Supprimer dégradés, modes de fusion, `backdrop-blur`, ombres floutées, `rounded-2xl/3xl`, `transition-all` et `animate-pulse`.
- [x] Remplacer les couleurs littérales des composants par les jetons de `styles.css`.

### 6. E2E et qualité
- [x] Écrire `packages/e2e/tests/design-system.spec.ts` : fond papier, aucun dégradé ni `backdrop-filter`, chiffres mono tabulaires, quatre gabarits distincts, budget ≤ 12 nœuds (internes SVG exclus), multiplicateur piloté par le serveur.
- [ ] Exécuter la suite Playwright dans le conteneur : à valider sur la pile Docker.
- [ ] `bun run lint`, `bun run typecheck`, `bun test packages/spec`, `bun run build` : à rejouer dans le conteneur après la phase.

### 7. Documentation
- [x] `.docs/01-architecture.md` §4.9 : jetons, rareté, gabarits, budget, blason, tableau, interdits.
- [x] `DESIGN_SYSTEM.md` : Revision 3 (comptes mesurés, deux rivets, politique du blason, sous-ensembles de police, `alignment.links`).
- [x] `README.md` : sous-section « Design system ».
- [x] `.docs/03-active-task.md` : cette entrée.

---

## Critères d'acceptation

1. [x] Un seul bloc `@theme` et quatre `@font-face` dans `styles.css` ; aucun fichier de configuration Tailwind.
2. [x] Les polices sont servies depuis `apps/web/public/fonts/` ; aucune requête tierce au runtime.
3. [x] Six paliers de rareté alignés entre `packages/shared`, `rarity-theme.ts` et les specs.
4. [x] Les quatre gabarits rendent des structures distinctes, tous à ≤ 12 nœuds (racine + non-SVG).
5. [x] Aucun dégradé, mode de fusion, `backdrop-blur`, ombre floutée ni `transition-all` dans `apps/web`.
6. [x] Le tableau de combo n'a aucun calcul d'alignement ni de multiplicateur côté navigateur.
7. [ ] La suite `design-system.spec.ts` est verte dans le conteneur Playwright.

---

## Journal

### 2026-11-18 — Phase 13 exécutée : design system IGN livré

**Jetons et polices**
- `apps/web/src/styles.css` : un `@theme` (surfaces `surface`/`paper`/`muted`/`border`, encres
  `ink`/`ink-secondary`/`ink-muted`/`ink-inverse`, accents `sign-blue|green|red|ochre|gold`,
  `--shadow-tactile-sm|tactile|tactile-lg` à 0 px de flou), quatre `@font-face` en deux
  sous-ensembles (`latin`, `latin-ext`) avec `unicode-range`, un `@layer base` et les rivets
  `.rue-plaque::before/::after`.
- Suppression de `.card-foil`, `.card-glow`, `.card-holo`, `.card-glitch`, de leurs keyframes et
  du bloc `prefers-reduced-motion`.
- `apps/web/public/fonts/` : quatre `woff2` (Space Grotesk, JetBrains Mono, chacun `latin` +
  `latin-ext`) et `OFL.txt`. `index.html` précharge les deux `latin` uniquement.
- `biome.json` : `css.parser.tailwindDirectives: true`, indispensable pour que Biome 2.6 parse
  `@theme`.

**Domaine et thème**
- `packages/shared/src/rarity.ts` : `RARITY_LABELS` et `RARITY_ACCENT_HEX` exportés ;
  `packages/spec/src/rarity.spec.ts` verrouille six paliers, libellés, hex et poids à 100.
- `apps/web/src/lib/rarity-theme.ts` et `apps/web/src/lib/category-theme.ts` remplacent
  `card-styles.ts` (supprimé). Un seul `rarity-badge.tsx` remplace cinq copies locales.

**Gabarits**
- `cards/card-shell.ts` plus `region-card.tsx`, `departement-card.tsx`, `commune-card.tsx`,
  `rue-card.tsx` ; `Card.tsx` devient un aiguilleur sur `type`, `CardProps` inchangé.
- Budget mesuré, racine incluse et internes SVG exclus : Région **11**, Département **9**,
  Commune **10** (**11** avec le blason), Rue **6**. Les 10/7/9/6 du §5 d'origine étaient faux
  pour le Département et la Commune.
- Blason : calque `background-image` pour Région et Département (zéro nœud), un `<img>` dans le
  cartouche EB10 pour la Commune, aucun pour la Rue.

**Tableau de combo**
- `components/tableau/` : `combo-board.tsx`, `alignment-connector.tsx` (ligne SVG + `✓ Aligné` /
  `✗ Hors-zone`, `AlignmentLinkList`), `multiplier-panel.tsx` (`×N` en `font-mono tabular-nums`,
  `aria-live`). Connecteurs à partir de `lg` seulement ; sous `lg`, la liste `✓`/`✗` par case.
- `alignment.links` est un **nombre** ; le détail vient de `alignment.breakdown[].valid` et le
  multiplicateur de `alignment.multiplier`, tous produits par le serveur.
- `MULTIPLIER_TIERS` garde ses quatre paliers, sans halo flouté ni `scale-[1.02]`.

**Balayage**
- Toutes les routes et les composants partagés (`button`, `text-field`, `form-error`,
  `revealed-cell`, `scratch-cell`) sont passés sur les jetons clairs. Plus de dégradé, de mode
  de fusion, de `backdrop-blur`, d'ombre floutée, de `rounded-2xl/3xl`, de `transition-all` ni
  d'`animate-pulse`.

**Écarts assumés**
- **Deux rivets** sur la plaque de rue, pas quatre : CSS ne positionne pas un `box-shadow`
  relativement au coin opposé sans unités de conteneur, et l'astuce `999px` du §5.4 dessinait un
  trait hors cadre. Quatre rivets coûteraient deux nœuds de plus.
- Le pied du Département lit **`DÉP. · {score} pts`** pour que le score reste visible.
- La carte Rue **n'affiche pas de score**, conformément au §5.4.
- La **population de la Commune** et le **nombre de communes de la Rue** restent masqués tant que
  la charge utile ne porte pas `ref_commune.population` et `ref_odonyme.nb_communes`.

**Vérification**
- `packages/e2e/tests/design-system.spec.ts` **écrit** : fond papier, absence de dégradé et de
  `backdrop-filter`, chiffres mono tabulaires, quatre gabarits distincts, budget ≤ 12 nœuds
  (internes SVG exclus), multiplicateur serveur.
- Aucun résultat de test n'est consigné ici : la suite Playwright et `ci:check` sont **à exécuter**
  dans le conteneur. Ne pas lire cette entrée comme une validation verte.

**Portée**
- Aucune modification de domaine métier, de migration ou de contrat d'API. Aucun commit.

---

## Suite

Deux suivis, hors phase 13 :
- **Champs de charge utile (spec-first).** Exposer `ref_commune.population` et
  `ref_odonyme.nb_communes` dans les réponses de cartes pour remplir la puce population et le
  compteur d'occurrences. Commencer par `.docs/02-database.md` et `packages/spec`, ensuite le
  select et le type Eden.
- **Phase 14 — coquille mobile.** `app-shell`, barre latérale, barre d'onglets basse et
  `env(safe-area-inset-*)` : le §6.1 de `DESIGN_SYSTEM.md` décrit la cible, pas le code livré.

---
---

# Historique — Phase 12 — Documentation de la production mono-conteneur

> Archive. La phase 12 a documenté la production à un seul conteneur ; la phase 13 a repris
> la branche pour le design system. Le journal ci-dessous décrit l'état au 2026-11-18.

## Statut

- **Phase** : 12 — Documentation de la production mono-conteneur
- **État** : Terminé
- **Priorité** : P1
- **Mis à jour** : 2026-11-18
- **Branche** : `docs/phase-12-production-mono-conteneur`

---

## Objectif

Aligner la mémoire projet sur ce qui est réellement livré : la production tient dans
**un seul conteneur applicatif** qui sert l'API et le SPA construit, et le garde-fou
local est `bun run ci:check`. C'est une phase de **documentation uniquement**.

À la fin de cette tâche :
- `README.md` ne décrit plus de conteneur web ni de Nginx, et documente les quatre
  étapes du `Dockerfile`, `ci:check` et sa base de test dédiée.
- `.docs/01-architecture.md` §6.1 décrit les deux topologies : deux conteneurs en
  développement, un seul en production.
- `.docs/03-active-task.md` consigne la phase et son journal.

L'implémentation est déjà faite et vérifiée ; cette phase n'écrit que de la prose.

---

## À lire avant de coder

1. `README.md` (sections « Démarrage », « Vérification avant PR », « Déploiement »).
2. `.docs/01-architecture.md` §4.5 (origine unique), §4.8 (tests) et §6.1 (topologie réseau).

---

## Étapes

### 1. `README.md`
- [x] Remplacer la topologie de production (db + api + web derrière Nginx) par le conteneur de bord unique.
- [x] Ajouter le tableau des quatre étapes du `Dockerfile` : `deps`, `dev`, `build`, `prod`.
- [x] Ajouter la section `bun run ci:check` : les quatre étapes, l'exigence `TEST_DATABASE_URL` et les trois refus.
- [x] Dire explicitement que **le développement reste à deux conteneurs** (API + Vite pour le HMR) et que **la production en a un**.
- [x] Corriger la commande du banc E2E (`db api`, plus de `web`) et documenter `docker compose -f docker-compose.prod.yml up -d --build` avec le port 8080.

### 2. `.docs/01-architecture.md`
- [x] §6.1 scindée en « Développement — `compose.yml` » et « Production — un seul conteneur de bord ».
- [x] Documenter la règle d'exclusion `/api`, `/api/*`, `/blasons/*` et pourquoi elle est vérifiée dans le handler plutôt que par l'ordre des routes.
- [x] Documenter `apps/api/src/static.ts` : garde de chemin, liste blanche d'extensions, politique de cache, ETag, en-têtes de sécurité.
- [x] Documenter `WEB_DIST_DIR` / `SERVE_WEB` et `createApp(options)`.
- [x] Documenter le garde-fou `ci:check` et sa base de test dédiée (§4.8), et rappeler qu'en production l'API et le SPA partagent l'origine (§4.5).
- [x] Mettre à jour la date du document.

### 3. `.docs/03-active-task.md`
- [x] Entrée Phase 12 (checklist + journal), Phase 11 conservée en historique.

---

## Critères d'acceptation

1. [x] Aucune instruction restante qui fasse passer par un conteneur `web` ou par Nginx en production.
2. [x] Les trois documents décrivent la même topologie : un conteneur applicatif, port 8080.
3. [x] `ci:check`, ses quatre étapes et ses trois refus sont décrits.
4. [x] La distinction développement (deux conteneurs) / production (un seul) est explicite.
5. [x] Aucun fichier de code, `Dockerfile`, compose, `.github/`, `scripts/`, `apps/` ou `packages/` modifié.

---

## Journal

### 2026-11-18 — Phase 12 exécutée : documentation alignée

**Ce qui était faux**
- `README.md` décrivait encore db + api + web derrière Nginx, avec `Dockerfile.api`,
  `Dockerfile.web`, et un `up -d --build db api web` pour le banc E2E.

**Ce qui a été écrit**
- `README.md` : conteneur de bord unique (`api` publie `${WEB_HOST_PORT:-8080}` →
  `3000`, rattaché à `backend` + `public`), tableau des étapes
  `deps`/`dev`/`build`/`prod`, section « Vérification avant PR » (`ci:check`, quatre
  étapes, `TEST_DATABASE_URL`, refus de `NODE_ENV=production` et d'une base de test
  égale à `DATABASE_URL`), et la règle « dev = deux conteneurs, prod = un ».
- `.docs/01-architecture.md` §6.1 : deux topologies, le pourquoi du plugin
  `static.ts`, l'exclusion `/api` et `/blasons` vérifiée dans le handler, le
  partage de cache (assets hachés immuables / `index.html` `no-cache`),
  `WEB_DIST_DIR` et `SERVE_WEB`, et `createApp(options)` avec un 404 JSON global.
  §4.8 porte désormais `ci:check`.

**Vérification**
- Les deux cas `Plan §5.6` qui échouaient à la phase 11 sont **verts** : le fixture
  remplace la suppression de 1,0 M / 2,2 M lignes dans la transaction par un
  `TRUNCATE` transactionnel.
- Suite de spécifications : **122 tests verts**, dont les 11 cas `Archi §6.1 — `
  de `packages/spec/src/static.spec.ts`.
- `bun run ci:check` : `1/4 Lint`, `2/4 Typecheck`, `3/4 Base de données`,
  `4/4 Spécifications` — 4/4 vertes.

**Portée**
- Aucune modification de code, `Dockerfile`, compose, `.github/`, `scripts/`,
  `apps/` ou `packages/`. Aucun commit.

---

## Commandes

```sh
docker compose --profile tools run --rm dev bun run ci:check
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.e2e.yml run --rm playwright
```

## Interdits
- Ne jamais réintroduire un conteneur `web` en production : le SPA est servi par l'API (`SERVE_WEB=true`).
- Ne pas faire pointer `TEST_DATABASE_URL` sur `DATABASE_URL` : `ci:check` le refuse, et le contourner détruirait les référentiels de développement.
- Ne JAMAIS utiliser une image Docker node:XX pour l'API. Utiliser exclusivement oven/bun.
- Ne pas désactiver le CSRF ou alléger le CORS "pour que ça marche plus vite".

---

## Suite

La V1 est complète et tient dans un conteneur de production.
- Réduire le bundle web (> 500 kB, avertissement Vite) par découpage dynamique.
- Ajouter le TLS (reverse proxy HTTPS) devant `api` : `useSecureCookies` l'exige en
  production réelle, et `PROD_FRONTEND_URL` doit alors être en `https://`.

---
---

# Historique — Phase 11 — Durcissement, E2E, Déploiement, Release

> Archive. `Dockerfile.api`, `Dockerfile.web` et `apps/web/nginx.conf` ont depuis été
> fusionnés dans le `Dockerfile` racine (phase 12) ; le journal ci-dessous décrit
> l'état du dépôt au 2026-11-18, avant cette fusion.

## Statut

- **Phase** : 11 — Durcissement, E2E, Déploiement, Release
- **État** : Terminé
- **Priorité** : P0
- **Mis à jour** : 2026-11-18
- **Branche** : `chore/phase-11-release`

---

## Objectif

Finaliser la préparation pour la production. Configurer les conteneurs Docker définitifs (multi-stage avec Bun), écrire les tests de bout en bout (E2E) avec Playwright, verrouiller la sécurité (CORS, Rate Limit, Cookies) et rédiger la documentation légale de distribution des données.

À la fin de cette tâche :
- Les fichiers `Dockerfile.api` et `Dockerfile.web` sont créés et optimisés.
- Un `docker-compose.prod.yml` permet de lancer la stack complète (DB + API + Web) simulée en production.
- Les tests Playwright valident le parcours critique (Inscription -> Ticket -> Grattage -> Collection -> Marché).
- Le `README.md` inclut les mentions légales obligatoires pour l'utilisation de la BAN et de l'INSEE.

---

## À lire avant de coder

1. `.docs/01-architecture.md` (Sections 11 et 12 pour les risques, mitigations et la Definition of Done globale).

> Note : le document s'arrête à la section 7 dans sa version actuelle. Les règles de
> durcissement effectivement suivies sont la section 6.1 (topologie réseau Docker) et
> les règles d'architecture 4.x.

---

## Étapes

### 1. Dockerisation de Production
- [x] Créer `Dockerfile.api` : Image de base `oven/bun:alpine`, multi-stage (install, build, run).
- [x] Créer `Dockerfile.web` : Build Vite avec Bun, puis servir statiquement avec Caddy ou Nginx dans un second stage.
- [x] Créer `docker-compose.prod.yml` orchestrant PostgreSQL, l'API et le Web.
- [x] Ajouter les scripts de santé (`healthcheck`) sur le conteneur API (`GET /api/v1/health`).

### 2. Sécurité & Production Better Auth
- [x] Dans `apps/api/src/auth.ts`, forcer `useSecureCookies: true` si `NODE_ENV === 'production'`.
- [x] Vérifier que le middleware CORS (`@elysiajs/cors`) est strictement limité au domaine du frontend en production, avec `credentials: true`.
- [x] S'assurer que le stockage du Rate Limiter Better Auth est bien configuré sur la base de données.

### 3. Tests End-to-End (Playwright)
- [x] Installer Playwright dans un nouveau paquet `packages/e2e` ou directement à la racine.
- [x] Écrire `core-loop.spec.ts` : Inscription, génération d'un ticket, grattage complet, vérification de l'inventaire. Utiliser des sélecteurs liés à l'accessibilité (`getByRole`, `getByText` en français).
- [x] Tous les tests sont joués dans une base de données dédiée, jamais sur la base de donnée locale pour éviter de supprimer tous les imports des scripts

### 4. Documentation Légale
- [x] Mettre à jour `README.md` (ou créer `LEGAL.md`) avec les attributions obligatoires : "Licence Ouverte v2.0 (Etalab)", Base Adresse Nationale (BAN), Institut National de la Statistique et des Études Économiques (INSEE) et les blasons Wikimedia Commons.

### 5. Qualité Finale
- [x] `bun run typecheck`
- [x] `bun run lint`
- [x] `bun test` (tous les tests specs).

---

## Critères d'acceptation

1. [x] `docker compose -f docker-compose.prod.yml up --build` démarre l'application complète sans erreur.
2. [x] Les tests Playwright passent localement avec succès.
3. [x] Les attributs légaux de l'Open Data sont explicitement écrits dans la documentation.
4. [x] L'API refuse les requêtes d'une origine non listée (CORS) en mode production.

---

## Journal

### 2026-11-18 — Phase 11 exécutée

**Docker**
- `Dockerfile.api` : `base` (`oven/bun:1`, install + cache partagé), `dev` (watch),
  `build` (bundle API + script de migration), `prod` (`oven/bun:alpine`, utilisateur
  `bun`, bundle autonome sans `node_modules`, `HEALTHCHECK` sur `/api/v1/health`).
- `Dockerfile.web` : `oven/bun:1` pour `bun run build`, `nginx:1.27-alpine` pour servir
  `dist/` (gzip, cache immuable des assets, repli SPA, proxy `/api` et `/blasons`).
- `docker-compose.prod.yml` : db + api + web, réseau `backend` interne, seul le web
  publie un port (`WEB_HOST_PORT`, 8080 par défaut), migrations appliquées au
  démarrage (`scripts/prod-entrypoint.sh`, `RUN_MIGRATIONS=0` pour désactiver),
  `depends_on: service_healthy` + `service_completed_successfully` correctement chaînés.

**Sécurité**
- `FRONTEND_URL` devient la source de vérité CORS en production. `apps/api/src/env.ts`
  la valide et la rend **obligatoire** dès `NODE_ENV=production`.
- `apps/api/src/app.ts` : liste blanche stricte (`FRONTEND_URL` + `TRUSTED_ORIGINS`),
  `credentials: true`, en-tête `Access-Control-Allow-Origin` absent pour toute autre
  origine. Vérifié par test Playwright et en curl sur la pile de production.
- `apps/api/src/auth.ts` : `trustedOrigins` dérivé des mêmes origines, dédoublonné ;
  `useSecureCookies` forcé en production, surchargeable par `AUTH_COOKIE_SECURE`
  uniquement pour le banc E2E en HTTP simple ; rate limiter `storage: 'database'`.

**E2E**
- `packages/e2e` : config Playwright (1 worker, locale `fr-FR`, traces à l'échec) et
  `tests/core-loop.spec.ts` (inscription → ticket → grattage complet → collection →
  marché + 2 tests CORS). Sélecteurs uniquement `getByRole`/`getByLabel`.
- `docker-compose.e2e.yml` : base `hexamap_e2e` dédiée (volume `hexamap_e2e_pgdata`,
  supprimé par `down -v`), API en image de production, `scripts/import/src/e2e-seed.ts`
  pour un référentiel minimal déterministe, runner `mcr.microsoft.com/playwright:v1.65.1-noble`.
- 3 tests verts : parcours critique (2,7 s) + CORS autorisé/refusé.

**Documentation**
- `README.md` : section « Mentions légales et Open Data » (BAN, INSEE, Licence Ouverte
  v2.0 Etalab, IGN Admin Express, Wikimedia Commons/Wikidata) et section
  « Déploiement » / « Tests de bout en bout ».

**Qualité**
- `bun run lint` : 0 erreur (112 fichiers).
- `bun run typecheck` : 6 paquets, 0 erreur (dont `packages/e2e`).
- `bun run build` : OK (API + web).
- `bun test packages/spec` : 110 pass, 2 échecs **préexistants**
  (`Plan §5.6 — un référentiel totalement vide reste une erreur explicite` et son hook,
  timeout 5 s) ; reproduits à l'identique sur le commit de référence avant modification.
