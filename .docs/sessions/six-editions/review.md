# Review : phase 56 — Une région, six éditions

- Rounds : 1
- Démarré : 2026-11-25

## Round 1 · r-9a4e

- Date : 2026-11-26
- Par : relecteur hostile (auto-revue de session)
- Diff : `feat/v2-idees-wave-3...feat/v2-56-six-editions` + l'arbre de travail au moment de la relecture
- Axes : code, fonctionnel, pertinence
- Verdict : **prêt à livrer**
- Score : 7/7 critères tenus, 0 non tenu, 0 non vérifié à l'exécution, 0 hors diff

### Critères

- [x] **1. Le cas de spec (région et département, `EDITION_SCORE`, bonus)** —
  `packages/spec/src/tickets.spec.ts:1097-1119`, dans `describe('Plan §5.6 — robustesse du tirage')`,
  en ajout strict. Vert sur la suite complète (589/589). Non-vacuité prouvée par inversion locale
  de l'assertion, vue rouge, puis restaurée (journal).
- [x] **2. `/rarete` porte la section « six éditions », les six scores et la phrase « deux
  cartes »** — `apps/web/src/routes/rarete.tsx:202-241`, textes dans
  `apps/web/src/content/rarete.ts:45-55`. Couvert par
  `packages/e2e/tests/rarete.spec.ts:63-96` (4/4 sur le fichier, 134/134 sur le banc).
- [x] **3. Le Cartel d'une région / d'un département affiche « Édition <libellé> » et le lien ;
  commune et rue inchangées** — `apps/web/src/routes/card.$cardId.tsx:212-278` et
  `apps/web/src/content/card-detail.ts:65-75`. Vu dans le navigateur : région `E2E-R1`
  (« ÉDITION — Rare » + note + lien), département `E2E-D2` (note accordée), commune
  `E2E-C-RARE-0` (« RARETÉ — Rare », aucune note).
- [x] **4. Le bandeau d'une case révélée nomme l'édition** —
  `apps/web/src/components/revealed-cell.tsx:31-65`. **Écart assumé et mesuré** : le bandeau
  affiche « Éd. » et non « Édition mythique », parce que 26,5 px restent disponibles à 390 px
  (mesures au journal). La phrase complète est en `title` ; le palier reste au sceau, ce que le
  brief décrit explicitement (« au lieu de répéter la rareté que le sceau montre déjà »).
- [x] **5. Aucun nombre de probabilité écrit à la main** — `git diff` : aucune valeur `%`
  ajoutée ; les scores viennent de `EDITION_SCORE`, les poids déjà présents de `RARITY_WEIGHTS`.
- [x] **6. Aucune migration, aucune table, aucun changement de tirage** — `git diff --stat` :
  sept fichiers, tous dans `apps/web`, `packages/spec` et `packages/e2e` ;
  `apps/api/src/services/draw.ts` absent du diff.
- [x] **7. `ci:check` vert et les cas E2E de `/rarete` verts** — 5/5, 589 spécifications,
  33 fichiers, 0 échec ; banc E2E 134 tests, 0 échec, `rarete.spec.ts` 4/4.

### Constats

- `apps/web/src/components/revealed-cell.tsx:50-56` : le bandeau ne peut afficher que trois
  caractères pleins sur une case de 66 px, et « Jumelé » y est déjà tronqué avant la phase.
  Toute autre rédaction (« Édition », « Édition mythique ») s'affichait « ÉD… ». Remplacer
  l'abréviation par le mot entier exigerait d'élargir le bandeau, ce que le brief interdit
  (« aucun changement de géométrie, aucun `h-*` ajouté ») → l'abréviation reste, le `title`
  porte la phrase — 🟡 majeur, écart de périmètre assumé.
- `apps/web/src/content/card-detail.ts:1-2` : un module de contenu importe `editionLabel` d'un
  autre module de contenu (`content/rarete`). Le vocabulaire d'édition n'a qu'un propriétaire,
  c'est voulu, mais la dépendance entre deux fichiers de contenu est inhabituelle dans le dépôt
  → laisser tel quel, la déplacer dans `packages/shared` élargirait le domaine — 🟢 mineur,
  structure.
- `apps/web/src/routes/card.$cardId.tsx:137-140` : l'en-tête du Cartel écrit encore
  « DÉPARTEMENT · RARE · 750 PTS » alors que le cartel dit « Édition ». Ce n'est pas une
  contradiction (« rare » est le nom du palier) et le brief ne demande pas de toucher l'en-tête
  → inchangé — 🟢 mineur, rédaction.
- `apps/web/src/routes/rarete.tsx:205-241` : le tableau des éditions s'étend sur deux colonnes et
  laisse la colonne « Score » très à droite à 1280 px. C'est le gabarit des autres tableaux de la
  salle (`tiers` compris) → cohérent, inchangé — 🟢 mineur, mise en page.
- `packages/e2e/tests/rarete.spec.ts:80-83` : les scores sont cherchés par expression régulière
  (`\s?`) parce que `Intl.NumberFormat('fr-FR')` rend une espace fine insécable. Une comparaison
  littérale aurait été fragile → conservé — 🟢 mineur, test.

Aucun défaut *deal-breaker*. Aucune assertion de spécification existante réécrite, aucun `skip`,
aucun délai relâché.
