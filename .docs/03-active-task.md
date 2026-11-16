# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

## Statut

- **Phase** : 8 — Collection & Tableau
- **État** : Terminé — en attente de revue
- **Priorité** : P0
- **Mis à jour** : 2026-11-16
- **Branche** : `feat/phase-8-collection-tableau` — empilée sur `feat/phase-7-ticket-ui` (la phase 7 n'est pas encore fusionnée dans `main` et la phase 8 en dépend)

---

## Objectif

Créer l'interface de gestion de l'inventaire des cartes du joueur (`/collection`) et le créateur de combos géographiques (`/tableau`), en s'assurant de l'homogénéité des calculs de score entre le client et le serveur.

À la fin de cette tâche :
- Le joueur peut voir toutes ses cartes dans une liste virtualisée et filtrable (par type, rareté, région).
- Le joueur peut sélectionner 1 Région, 1 Département, 1 Commune et 1 Rue pour former un Tableau.
- Le score prévisionnel et les liens géographiques s'affichent en temps réel.
- Le joueur peut soumettre son Tableau (validation serveur).

---

## À lire avant de coder

1. `.docs/01-architecture.md` (Sections 5.1, 5.2 et 5.7 pour les formules de score et le multiplicateur territorial).
2. `packages/shared/src/scoring.ts` (ou équivalent) pour y centraliser la logique métier.

---

## Étapes

### 1. Logique métier partagée (`packages/shared/`)
- [x] Créer `packages/shared/src/tableau.ts` (exporté par `src/index.ts`) : `TABLEAU_SLOTS`, `TABLEAU_SLOT_LABELS`, `TABLEAU_LINK_LABELS`, `slotMatchesCategory`, `rueExistsInCommune`, `TableauGeography`, `evaluateTableauAlignment`, `evaluateTableau`.
- [x] Le multiplicateur d'alignement (1.0x à 5.0x) reste calculé par `alignmentMultiplier` (`scoring.ts`) et le total par `tableauScore` : **aucune formule n'est dupliquée** ni côté API, ni côté web. La décision « la rue existe dans la commune » est dans `rueExistsInCommune` : l'API ne fournit que les lignes de `commune_odonymes`.
- [x] Spec pure `packages/spec/src/tableau.spec.ts` (bornes 0/1/2/3 liens, sélections partielles, parité `evaluateTableau` ↔ GDD).

### 2. Page Collection (`apps/web/src/routes/collection.tsx`)
- [x] TanStack Table **v9** (`useTable` + `tableFeatures({ rowSortingFeature, columnFilteringFeature, globalFilteringFeature })`) pour le tri et les filtres.
- [x] `@tanstack/react-virtual` (`useVirtualizer` sur `table.getRowModel().rows`) : seules les lignes visibles sont dans le DOM, jamais de `.map()` sur l'inventaire.
- [x] Filtres texte (recherche), Rareté et Catégorie + tri (nom, catégorie, rareté, score, date).
- [x] `apps/web/src/lib/collection.ts` (query Eden, `CollectionCard`) et `apps/web/src/content/collection.ts` (libellés).

### 3. Page Tableau (`apps/web/src/routes/tableau.tsx`)
- [x] 4 emplacements (Région, Département, Commune, Rue) avec bouton d'ouverture et action de retrait.
- [x] Tiroir accessible (`role="dialog"`, `Échap`, overlay) listant les cartes éligibles, **virtualisé**, avec recherche.
- [x] Score prévisionnel en temps réel calculé côté client avec `evaluateTableauAlignment` + `tableauScore` de `@hexamap/shared` (géographie fournie par l'API).
- [x] Multiplicateur mis en valeur : panneau dédié, `×1,0` → `×5,0` en grand, 4 paliers visuels croissants (slate → sky → violet → ambre avec halo), 3 segments de progression, `aria-live` d'annonce. Le palier 3 affiche « Combo géographique complet ».
- [x] Liens territoriaux affichés via `TABLEAU_LINK_LABELS` + `alignment.breakdown` (✓/✗).
- [x] Mutation `POST /api/v1/tableaux`, panneau de confirmation, gestion des codes d'erreur en français.
- [x] `apps/web/src/lib/tableaux.ts` et `apps/web/src/content/tableau.ts`.

### 4. API & Sécurité (`apps/api/src/routes/tableaux.ts`)
- [x] `GET /api/v1/tableaux/preview` (sélection partielle) : géographie + alignement + total, calculés par `@hexamap/shared`.
- [x] `GET /api/v1/tableaux` : liste des tableaux du joueur, score et multiplicateur recalculés côté serveur, triée par `total` décroissant. Requêtes batchées (1 `tableaux` + 1 `user_cards` + 4 référentiels + 1 `resolveCardNoms`), aucun N+1.
- [x] `POST /api/v1/tableaux` transactionnel (`db.transaction()`).
- [x] **Sécurité vitale** : possession et absence de verrou vérifiées par le prédicat exact `id IN (...) AND user_id = ... AND locked = false` (Kysely + `forUpdate()`), refus si le compte n'est pas 4 → `403 CARD_NOT_OWNED`. Le client ne fournit jamais ni score, ni catégorie, ni géographie.
- [x] Catégorie = emplacement (`slotMatchesCategory`) → `400 INVALID_CARD_SET` ; doublons → `400` ; carte déjà utilisée dans un autre tableau → `409 CARD_IN_USE`.
- [x] Le backend recalcule le score, mais **ne l'insère pas** (voir journal : pas de colonne score au contrat DB).
- [x] Spec d'intégration `packages/spec/src/tableaux.spec.ts` (10 tests, effets de bord en base vérifiés).

### 5. Vue « Mes tableaux » (`apps/web/src/routes/tableaux.tsx`)
- [x] Liste des tableaux créés, classés par **score total décroissant** par défaut, avec tri alternatif par **multiplicateur** (départage au total) et par **date de création**.
- [x] Rang d'affichage (`#1`, `#2`, …) et mise en avant du premier (anneau ambre).
- [x] Chaque carte affiche le score total, le badge multiplicateur du palier correspondant, les 4 emplacements (nom, catégorie, rareté, score, état « Emplacement vide »), les 3 liens géographiques (`alignment.breakdown`) et la date.
- [x] États chargement / erreur / liste vide, CTA vers le constructeur.
- [x] La liste est invalidée après création d'un tableau (`invalidateQueries({ queryKey: tableauxListQueryKey })`).

### 6. Qualité
- [x] `bun run typecheck` (5 packages, y compris les imports workspace de `@hexamap/shared` par `api` et `web`)
- [x] `bun run lint`
- [x] `bun test packages/spec` (95 tests)
- [x] `bun run build`

---

## Critères d'acceptation

1. La page Collection reste fluide (60 fps) même si on simule un inventaire de 5000 cartes.
   → rendu virtualisé : seules les lignes visibles (+ `overscan: 8`) existent dans le DOM.
2. Le score calculé dans le frontend est strictement identique à celui calculé par le backend (source de vérité partagée).
   → les deux appellent `evaluateTableauAlignment` / `tableauScore` ; la spec d'intégration compare `total` à `tableauScore(...)` importé.
3. Impossible de soumettre une carte qu'on ne possède pas en bidouillant l'API.
   → couvert par les tests 2 (carte d'un autre utilisateur), 3 (carte verrouillée) et 4 (catégorie incohérente) de `tableaux.spec.ts`, avec vérification d'absence d'insertion.

---

## Journal

### 2026-11-16 — Phase 8 implémentée

**Livré**
- `packages/shared/src/tableau.ts` + export dans `packages/shared/src/index.ts` — règles pures des Tableaux.
- `apps/api/src/routes/tableaux.ts` + montage dans `apps/api/src/app.ts`.
- `apps/web/src/routes/collection.tsx`, `apps/web/src/routes/tableau.tsx`, `apps/web/src/lib/{collection,tableaux}.ts`, `apps/web/src/content/{collection,tableau}.ts`, liens de navigation dans `apps/web/src/routes/__root.tsx`.
- `apps/web/package.json` : ajout de `@tanstack/react-virtual` (^3.14.26).
- `packages/spec/src/tableau.spec.ts` (règles pures) et `packages/spec/src/tableaux.spec.ts` (intégration, 10 tests).

**Écarts assumés par rapport à la rédaction initiale de la tâche**
1. **Score non stocké en base.** `.docs/02-database.md` ne définit aucune colonne de score sur `tableaux` (le score est calculé au moment de la lecture). Plutôt que d'inventer une colonne, le serveur recalcule le score à la soumission et le renvoie dans la réponse ; il n'est pas persisté. Aucune migration n'a été nécessaire.
2. **Les cartes d'un Tableau ne sont pas verrouillées.** Aucune règle documentée ne lie `user_cards.locked` aux tableaux (`.docs/02-database.md` §7.1 réserve `locked` à la vente/suppression, et les FK de `tableaux` sont en `on delete set null`). La soumission **exige** donc `locked = false`, mais ne passe pas les cartes à `true`.
3. **Unicité d'usage appliquée au niveau applicatif.** L'intention « pas déjà verrouillées dans un autre tableau » est honorée par une vérification `CARD_IN_USE` (409) dans la transaction, sans ajouter de contrainte d'unicité au schéma (le contrat DB n'en prévoit pas). Si une contrainte DB est souhaitée plus tard, elle doit commencer par `.docs/02-database.md` puis une migration.
4. **`GET /cards` : `limit` max porté de 100 à 5000** pour permettre le tri/filtrage client sur l'inventaire complet. Le défaut reste 20 ; aucun test de spec ne dépendait de l'ancien plafond.
5. **Pas de pagination sur `GET /tableaux`.** La liste est plafonnée à 200 tableaux et triée côté serveur ; suffisant tant que le nombre de tableaux par joueur reste faible. Paginer exigera de trier en SQL sur un score calculé (vue matérialisée ou score figé — voir point 1).
6. **Branche `feat/phase-8-collection-tableau` empilée sur `feat/phase-7-ticket-ui`.** La phase 7 n'est pas encore fusionnée dans `main` et la phase 8 en dépend (`apps/web/src/lib/tickets.ts`, routes `/tickets`) : partir de `main` aurait produit un arbre non compilable. La PR de la phase 8 cible donc `feat/phase-7-ticket-ui` et sera rebasée sur `main` après fusion de la phase 7.

**Vérifications (Docker, toutes vertes)**
- `bun run typecheck` : `packages/shared`, `packages/db`, `apps/api`, `apps/web`, `packages/spec`.
- `bun test packages/spec` : 100 pass / 0 fail (5 fichiers).
- `bun run lint` : 86 fichiers, aucune erreur ni avertissement.
- `bun run build` : API + web, chunks `collection-*.js`, `tableau-*.js` et `tableaux-*.js` émis (avertissement préexistant de chunk > 500 kB sur le bundle principal).

### 2026-11-16 — Ajout de la vue « Mes tableaux »

- Nouvelle route `GET /api/v1/tableaux` (`apps/api/src/routes/tableaux.ts`) : expose `id`, `name`, `createdAt`, `complete`, `total`, `alignment` et les 4 `cards`. Le score est recalculé à la volée avec `evaluateTableau` (jamais stocké, cf. écart 1).
- La résolution de géographie a été factorisée : `buildTableauGeography(cards, refs)` est un helper pur partagé par le POST (`resolveGeography`) et la liste, donc les règles de mapping ne sont écrites qu'une fois. Les 3 liens restent calculés par `evaluateTableauAlignment` / `rueExistsInCommune` de `@hexamap/shared`.
- Nouvelle page `/tableaux` (`apps/web/src/routes/tableaux.tsx`) + `tableauxQueryOptions`, `TABLEAUX_LIST`, `rankLabel` ; lien « Mes tableaux » ajouté à la navigation ; le panneau de confirmation du constructeur renvoie vers la liste et invalide le cache.
- 5 tests d'intégration ajoutés à `packages/spec/src/tableaux.spec.ts` (401, liste vide, tri décroissant avec parité `tableauScore`, isolation entre joueurs, tableau partiel) — les 10 tests existants sont inchangés.
