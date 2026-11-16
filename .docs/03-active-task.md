# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

## Statut

- **Phase** : 7 — Interface ticket (Grille & Grattage)
- **État** : Terminée (typecheck + lint verts)
- **Priorité** : P0
- **Mis à jour** : 2026-11-15
- **Branche conseillée** : `feat/phase-7-ticket-ui`

---

## Objectif

Créer l'interface de jeu principale : la vue du ticket à gratter (`/tickets/$ticketId`), la grille 4x4, la mécanique de grattage via Canvas HTML5, et l'intégration avec TanStack Query pour les appels API.

À la fin de cette tâche :
- Le joueur voit son ticket actif avec les cases masquées et celles déjà révélées.
- Le joueur peut gratter une case avec sa souris/doigt.
- Au bout de 40% de surface grattée, une requête API est envoyée pour révéler le contenu.
- Le résultat s'affiche (Carte + Distance Radar ou Panneau).
- L'inventaire de cartes est invalidé en arrière-plan.

---

## À lire avant de coder

1. `.docs/01-architecture.md` (Sections 5.5 et 5.6 pour les effets des cases).
2. `apps/web/src/lib/api.ts` pour l'utilisation d'Eden Treaty.

---

## Étapes

### 1. Composant Case à Gratter (`ScratchCell`)
- [x] Créer un composant utilisant `<canvas>` et `useRef` (sans état React pour le mouvement du pinceau).
- [x] Dessiner un masque opaque (ex: motif de peinture à gratter) sur le canvas.
- [x] Gérer les événements de souris/touch (`pointerdown`, `pointermove`, `pointerup`) pour rendre les pixels transparents (via `globalCompositeOperation = 'destination-out'`).
- [x] Calculer le pourcentage d'effacement et déclencher une callback `onScratchComplete` à 40%.

### 2. Page du Ticket (`/tickets/$ticketId`)
- [x] Utiliser TanStack Query (`useQuery`) pour récupérer l'état du ticket depuis l'API (`GET /api/v1/tickets/current`).
- [x] Afficher la grille 4x4 (`grid-cols-4`).
- [x] Afficher le compteur de grattages restants (`scrapes_remaining`).
- [x] Gérer les cases déjà révélées (les afficher directement sans le canvas de grattage).

### 3. Mutations et Synchronisation
- [x] Utiliser `useMutation` pour appeler `POST /api/v1/tickets/:id/scratch` lors du `onScratchComplete`.
- [x] En cas de succès, afficher la carte (ou le panneau) et l'indice de distance (radar).
- [x] Invalider les requêtes correspondantes (`tickets/current`, `collection/stats`) via `queryClient.invalidateQueries`.

### 4. Qualité et Accessibilité
- [x] Gérer l'accessibilité : permettre la révélation d'une case via le clavier (Focus + Entrée) sans Canvas.
- [x] `bun run typecheck`
- [x] `bun run lint`

---

## Critères d'acceptation
1. Le grattage est fluide (60 FPS) car géré par le DOM/Canvas natif et non par le cycle de rendu de React.
2. Une case ne lance l'appel réseau qu'une seule fois, même si l'utilisateur continue de gratter frénétiquement.
3. Le radar kilométrique s'affiche proprement après révélation.
4. L'UI se met à jour correctement quand les grattages tombent à 0.

---

## Commandes
```sh
docker compose --profile tools run --rm dev bun run --cwd apps/web typecheck
```

## Interdits
- Ne JAMAIS lier les coordonnées (X, Y) du pointeur à un useState React.
- Ne pas pré-charger les résultats : le composant frontend ne doit pas savoir ce qu'il y a sous la case avant l'appel API.

---

## Journal

### 2026-11-15 — Implémentation

Fichiers créés :
- `apps/web/src/components/scratch-cell.tsx` — canvas impératif (`useRef`), masque peint au montage (dégradé + hachures + mouchetures), grattage en `destination-out` (trait de 26 px, `pointerdown`/`pointermove`/`pointerup`/`pointercancel`/`pointerleave`, `setPointerCapture`, `touch-none`). Le taux d'effacement est calculé par échantillonnage d'alpha (`getImageData`, `willReadFrequently`) tous les 6 mouvements et au relâchement ; à 40 % un `firedRef` verrouille l'appel. Aucune coordonnée en `useState`.
- `apps/web/src/components/revealed-cell.tsx` — carte (nom, catégorie, badge de rareté, score `Intl.NumberFormat('fr-FR')`), radar de distance (affiche « Pépite » à 0, jamais masqué par un test de véracité), panneaux Station/Belvédère/Rénovation avec icône et description.
- `apps/web/src/lib/tickets.ts` — clés `['tickets','current']` et `['collection','stats']`, `fetchCurrentTicket` (404 → `null`, sinon erreur), `createTicket`, `scratchTicketCell`, `currentTicketQueryOptions` (`retry: false`, `staleTime` 15 s), types dérivés d'Eden.
- `apps/web/src/content/tickets.ts` — libellés français (raretés, catégories, panneaux, états, pluriels, libellés a11y).
- `apps/web/src/routes/tickets.$ticketId.tsx` — page `/tickets/$ticketId` : garde de session, écrans chargement / erreur / aucun ticket / ticket non courant / épuisé, `fieldset` 4×4, `useMutation` avec verrou par case (`useRef(new Set)`), `setQueryData` du ticket retourné + invalidation de `collection/stats` et `tickets/current`, région `aria-live` pour annoncer la révélation.

Fichiers modifiés :
- `apps/web/src/routes/index.tsx` — CTA « Reprendre mon ticket » / « Obtenir un ticket » et branche d'erreur avec « Réessayer ».

Choix et écarts :
- Le conteneur de case est un `<button>` natif (et non un `<div role="button">`) pour satisfaire `a11y/useSemanticElements` ; `onKeyDown` sur Entrée/Espace court-circuite le canvas et révèle directement.
- `role="group"` remplacé par un `<fieldset aria-label>` ; la grille verrouillée utilise un texte `sr-only` plutôt qu'`aria-label` sur un `div`.
- Indicateur d'attente par case via `mutation.variables?.cellIndex` : la grille n'est jamais désactivée globalement pendant une requête.
- En cas d'échec de mutation, la case est retirée du verrou pour autoriser une nouvelle tentative.

Vérifications (Docker) :
- `bun run --cwd apps/web typecheck` → exit 0 (`tsr generate && tsc --noEmit`).
- `bun run lint` → `Checked 75 files. No fixes applied.`

Reste à faire : créer la branche `feat/phase-7-ticket-ui`, commiter et ouvrir la PR (aucun commit effectué).

### 2026-11-16 — Correctif : tirage tolérant aux référentiels incomplets

Symptôme : `POST /api/v1/tickets` renvoyait 503 `REFERENCE_DATA_MISSING` de façon quasi systématique avec l'import `--lite` (Bretagne).

Cause : `drawRue` filtre `ref_odonymes.rarete = rarity` de façon stricte. Le palier `COMMUNE` (rue présente dans plus de 500 communes) est structurellement vide dans un import régional ; les routes communales étant tirées en `RUE` × `COMMUNE`, le tirage échouait. Cas résiduels identifiés même avec un import national : rue `MYTHIQUE` (`N = 1`, une seule commune), rue `LEGENDAIRE` dont les communes sont trop petites pour être jumelées, et Pépite `DEPARTEMENT` = Paris dont l'unique commune est `MYTHIQUE` (aucun jumelé possible).

Correctif :
- `draw.ts` — `fallbackRarities` ordonne le palier demandé puis les voisins par distance croissante (palier bas prioritaire) ; `drawCommune` / `drawRue` bouclent sur cet ordre et **retournent la rareté réelle de la ligne tirée**, ce qui garde `user_cards.rarity` cohérent avec `score_base`.
- `ticket.ts` — `drawTwins` élargit la recherche commune → département → région → national, déduplique par `category:ref_code`, puis complète avec un vivier national. `REFERENCE_DATA_MISSING` ne subsiste que si moins de 2 candidats existent dans tout le référentiel.
- `apps/api/package.json` — export `./services/*` pour permettre les tests de service depuis `packages/spec`.

Spec (écrite avant le code, `packages/spec/src/tickets.spec.ts`) : palier vide → repli et rareté alignée sur la ligne, rue unique `N = 1` → grille 1 Pépite / 2 jumelés distincts / 3 panneaux / 10 cartes, référentiel vide → `REFERENCE_DATA_MISSING`.

Vérifications : `apps/api` et `apps/web` typecheck OK, `bun test packages/spec` → 63 pass / 0 fail, `bun run lint` OK. Contrôle sur la base réelle (`--lite`) : 3 créations consécutives en 201, chacune avec 1 Pépite, 2 jumelés, 3 panneaux et 10 cartes.
