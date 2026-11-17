# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

## Statut

- **Phase** : 10 — Direction artistique procédurale
- **État** : Terminé
- **Priorité** : P0
- **Mis à jour** : 2026-11-16
- **Branche conseillée** : `feat/phase-10-procedural-art`

---

## Objectif

Créer le composant React `<Card />` unique et réutilisable qui génère visuellement les 4 types de cartes (Région, Département, Commune, Rue) et les 6 paliers de rareté en utilisant uniquement du CSS (Tailwind) et du SVG.

À la fin de cette tâche :
- Les cartes "Rue" ressemblent à de vraies plaques émaillées bleues françaises (100% CSS).
- Les cartes géographiques utilisent des formes SVG ou des blasons locaux (pré-téléchargés, pas d'appels externes).
- Chaque palier de rareté possède un effet visuel distinct (ex: brillance, bordure animée, effet holographique) géré par des `keyframes` CSS légères.
- L'affichage de 50 cartes simultanées ne fait pas chuter les FPS.

---

## À lire avant de coder

1. `.docs/01-architecture.md` (Sections 5.1 et 10 sur les raretés et la DA).

---

## Étapes

### 1. Composant Core (`apps/web/src/components/ui/Card.tsx`)
- [x] Créer le squelette du composant acceptant les props : `type`, `rarity`, `name`, `score`, et des métadonnées (ex: population ou blason).
- [x] Prévoir un mode "compact" (pour l'inventaire) et un mode "détaillé" (pour l'inspection).

### 2. Design des Types
- [x] **Rues :** Implémenter le design plaque émaillée (fond bleu nuit, bordure verte/blanche, texte centré en blanc, 4 points pour les vis).
- [x] **Territoires (Région/Dép/Commune) :** Créer un gabarit épuré avec l'espace pour le blason ou la forme géographique, la hiérarchie et le score bien visible.

### 3. Effets de Rareté (Tailwind/CSS)
- [x] Créer un fichier ou des classes utilitaires pour les 6 paliers de rareté (Commune = gris/neutre, Inhabituelle = vert, Rare = bleu, Epique = violet, Légendaire = or/brillant, Mythique = holographique/glitch).
- [x] Utiliser des pseudo-éléments (`::before`, `::after`) avec `mix-blend-mode` et `linear-gradient` pour les effets de reflets métalliques ou holographiques sans surcharger le DOM.

### 4. Intégration globale
- [x] Remplacer les affichages temporaires dans `/collection`, `/tableau` et `/market` par ce nouveau composant `<Card />`.
- [x] S'assurer que le composant est `memoized` (`React.memo`) si nécessaire pour éviter les re-rendus inutiles dans les listes.

### 5. Qualité
- [x] `bun run typecheck`
- [x] `bun run lint`

---

## Critères d'acceptation
1. Zéro requête réseau vers l'extérieur (ex: requêtes Wikipedia ou requêtes d'images à la volée) lors du rendu d'une carte.
2. Les 6 raretés sont visuellement distinctes et utilisent les standards de couleurs des TCG.
3. Le composant est responsive et s'adapte à son conteneur parent (via les classes `w-full h-full` avec un `aspect-ratio` strict, ex: `aspect-[63/88]`).

---

## Commandes
```sh
docker compose --profile tools run --rm dev bun run --cwd apps/web lint
```

## Interdits
- N'installe pas de lourdes librairies 3D (Three.js, React Three Fiber) ou de physique. Garde le DOM propre.
- Pas d'images externes : tout doit être généré en CSS/SVG, ou utiliser des assets statiques dans le dossier public/.
- N'utilise pas de JS pour les animations de brillance au survol : utilise uniquement le :hover et le group-hover de Tailwind.

---

## Journal

- 2026-11-16 — Composant `<Card />` créé (`apps/web/src/components/ui/Card.tsx`) : `React.memo`, ratio `aspect-[2.5/3.5]`, DOM plat (racine + 2 enfants), blason SVG procédural (teinte `hsl()` dérivée d'un hash du nom) et plaque émaillée CSS pour les rues (4 vis, relief).
- 2026-11-16 — Palette de rareté dans `apps/web/src/components/ui/card-styles.ts` : 6 paliers distincts (gris/vert/bleu/violet/or/fuchsia) + accents de catégorie.
- 2026-11-16 — Effets CSS purs dans `styles.css` : balayage `card-foil`, halo `card-glow`, holographie `card-holo` (conique + trame), glitch subtil `card-glitch`, et `prefers-reduced-motion` respecté. Seules `transform`/`opacity` sont animées.
- 2026-11-16 — Intégration dans `/collection` (vignette compacte dans la colonne nom), `/tableau` (aperçu détaillé dans les slots + vignettes compactes du tiroir) et `/market` (vignette détaillée dans les annonces).
- 2026-11-16 — Corrections de revue : effets de rareté passés en `z-index: 0` (contenu en `z-10`, texte lisible sur MYTHIQUE/LEGENDAIRE/EPIQUE, `inset: -30%` pour la rotation holographique), prop `decorative` → `aria-hidden` sur les 4 vignettes intégrées (fin de l'annonce en double), et tailles de police du mode détaillé relevées (9–10px).

### Hors phase — Blasons et contours

- 2026-11-16 — Pipeline `scripts/import/src/blasons.ts` : blasons réels via Wikidata `P94` (`P374`/`P2586`/`P2585` pour les codes INSEE) téléchargés depuis Wikimedia Commons, assainis sans dépendance (pas de `<script>`, pas de référence externe, `viewBox` garanti), puis repli en contour IGN Admin Express (`ADMINEXPRESS-COG-CARTO.LATEST:commune`, simplification Ramer–Douglas–Peucker) pour les communes sans armoiries.
- 2026-11-16 — Migration `0007_blasons` : `blason_url`, `contour_url`, `blason_credit` sur `ref_communes` ; `blason_credit` sur `ref_departements` et `ref_regions`. `.docs/02-database.md` mis à jour en premier.
- 2026-11-16 — Stockage : volume Docker `blasons` monté sur `/data/blasons` (`api` et `dev`), servi par l'API sur `GET /blasons/*` (cache `immutable` 30 j, ETag/304, anti path-traversal) avec proxys nginx et Vite. Aucun appel réseau au rendu.
- 2026-11-16 — Robustesse mesurée : retry 6 tentatives à backoff jitteré honorant `Retry-After`, concurrence 4 et espacement 100 ms. Avant : 55 échecs sur 89 départements ; après : 0 échec sur 88.
- 2026-11-16 — Intégré à `scripts/bootstrap.sh` (sautable via `SKIP_BLASONS=1`).

### Incident et reprise (contours IGN)

- 2026-11-17 — Crash en phase contours (1 753 / 14 977) : une page WFS non-JSON a fait échouer `response.json()` et interrompu tout le streaming. Correctif : lecture texte + `JSON.parse` protégé, validation `FeatureCollection`, 4 tentatives (1/3/7/15 s), page sautée avec ligne de diagnostic (`HTTP`, `content-type`, 120 premiers caractères) au lieu de tuer le run. Même défense appliquée à SPARQL, Commons et `geo.api.gouv.fr`.
- 2026-11-17 — `blason_url` était resté à `0` : le crash avait eu lieu avant l'upsert final. Rattrapage via `blasons --only=communes` (7 min, 0 échec, aucun téléchargement) → **19 945** communes reliées avec crédit.
- 2026-11-17 — Nouveau mode `--contours-only` (idempotent, `--limit` compatible) qui ne met à jour que `contour_url` et ne touche jamais `blason_url`. Reprise : *13 102 contours en 54 s, 0 échec*.
- 2026-11-17 — Couverture finale : **19 945 blasons + 14 923 contours = 34 868 / 34 869 communes**.
- 2026-11-17 — `bootstrap.sh` sépare désormais blasons et contours en deux commandes : un incident sur les contours ne peut plus faire perdre l'upsert des blasons.

### Couverture visuelle complète

- 2026-11-17 — Cascade de résolution : `P94` → **recherche Commons ciblée** (`intitle:"<nom>" intitle:blason`, score strict écartant `famille`, `ville`, `commune`, `proposition`, `branche`) → **forme de secours** (agrégation des communes en un seul `<path>` pour les départements et régions). `P18` est écarté : il renvoie des photos (tour Eiffel, vues Landsat).
- 2026-11-17 — Rasters (PNG/JPEG) redimensionnés à 320 px et convertis en **WebP q80** via `sharp` ; l'API sert désormais `.svg` **et** `.webp`. Migration `0008_entity_contours` : `contour_url` sur `ref_regions` et `ref_departements`.
- 2026-11-17 — Couverture finale : **18/18 régions, 101/101 départements, 34 869/34 869 communes**. Lint (103 fichiers) et typecheck monorepo propres.
- 2026-11-16 — L'API expose `blasonUrl`/`blasonCredit` sur `/cards` et `/market/listings` via `resolveCardAssets` (groupé par catégorie ; `coalesce(blason_url, contour_url)` en repli visuel pour les communes).
- 2026-11-16 — `<Card />` affiche le blason réel empilé sur le SVG procédural (repli sans état React, `onError` → masquage) dans `/collection`, `/tableau` (slot + tiroir) et `/market` ; `scripts/bootstrap.sh` refait les imports complets (référentiel + BAN sautable `SKIP_BAN=1` + blasons avec contours).
