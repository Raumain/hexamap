# Journal — Phase 35, L'Atlas

## Ce qui a été livré

- **`apps/web/src/routes/atlas.tsx`** : la salle. Trois niveaux en descente guidée — national
  (régions + départements), département (ses communes), commune (elle ne s'ouvre pas, elle mène au
  Cadastre). Alimentée par `GET /api/v1/atlas/summary` puis
  `GET /api/v1/atlas/departements/:code`, deux clés de requête distinctes : le niveau national
  n'est jamais rechargé par la descente.
- **`apps/web/src/content/atlas.ts`** : tous les libellés neufs et trois formateurs purs
  (`coveragePercent`, `nationalSummary`, `departementSummary`).
- **`apps/web/src/lib/atlas.ts`** : `queryOptions` + client Eden, sur le modèle exact de
  `player-profile.ts`.
- **`apps/web/src/routes/assemblage.tsx`** : réduit à un `beforeLoad` qui lève
  `redirect({ to: '/atlas', search: true, replace: true })`. La recherche est conservée, l'ancien
  lien ne rend jamais un 404, et il n'existe qu'une salle.
- **`apps/web/src/routes/collection.tsx`** : six lignes de `validateSearch` (deux paramètres
  optionnels, aucune logique). C'est l'exception bornée du brief : sans elles, TanStack Router
  refuserait le typage de `search={{ commune }}`.
- **`apps/web/src/lib/france-outline.ts`** : conservé et **désormais utilisé** comme repli —
  contour métropole + Corse pendant le chargement et quand aucun `pathD` n'est revenu.
- **`packages/e2e/tests/atlas.spec.ts`** : huit cas.
- **`packages/e2e/tests/mobile.spec.ts`** : le cas qui assertait le teaser est réécrit.
- **`DESIGN_SYSTEM.md`** : une ligne, `/atlas` → **L'Atlas**, au §2.

## Les deux lectures de la carte, et d'où viennent les nombres

Aucun nombre n'est recalculé côté navigateur :

- **remplissage** = `communesOwned / communesTotal` (`ownedCards > 0` pour une commune, qui est
  binaire par nature : `100,0 %` ou `0,0 %`), exprimé en `fillOpacity` de 0,06 à 0,45 ;
- **filet de laiton** = `hasRegionCard` / `hasDepartementCard` / `hasCommuneCard`, en `stroke` de
  2 px, `vector-effect: non-scaling-stroke`.

Le pourcentage affiché dans la table est une **mise en forme** à une décimale de ces deux entiers,
pas un troisième calcul. Aucun seuil n'est inventé.

## Décisions d'implémentation

1. **Le SVG est purement décoratif.** `aria-hidden="true"`, `role="presentation"`, aucun
   gestionnaire de pointeur, aucun `tabIndex` sur un tracé. Toute l'interaction vit dans la table
   équivalente : c'est ce qui rend tenables à la fois « le SVG ne porte aucune information
   exclusive » et « aucun état React par mouvement de pointeur ». Le survol n'existe pas.
2. **Deux actions distinctes sur un département**, parce que le brief en demande deux : un
   `<button>` qui l'ouvre (« Ouvrir les communes de … ») et un `<a>` qui mène au Cadastre
   (« Voir les cartes au Cadastre »), dans la même ligne. Le point 7 et le point 8 des paramètres
   se contredisaient ; les deux sont tenus sans en privilégier un.
3. **Le focus revient au titre du niveau** à chaque descente et à chaque remontée (`h2` avec
   `tabIndex={-1}`), et le résumé de niveau vit dans une zone `aria-live="polite"`.
4. **Mouvement réduit par utilitaire** (`motion-reduce:transition-none`) : aucune règle CSS
   ajoutée, aucun jeton ajouté, donc aucun risque de conflit sur `styles.css`.
5. **Aucune couleur littérale** : `fill-vellum-2`, `stroke-brass`, `stroke-veil-strong`. Seuls
   styles en ligne : `fillOpacity` et `strokeWidth`, deux nombres.

## Écarts assumés

1. **Le lien vers le Cadastre est livré avant que le Cadastre sache le lire.**
   `/collection?departement=…` et `/collection?commune=…` survivent au routage, mais la salle du
   Cadastre **n'applique aucun filtre** — la phase 36 est en vague 5. C'est testé dans cet état
   précis (les deux URL sont assertées, ancrées), pas contourné.
2. **`nav-items.ts` garde le libellé « L'Assemblage ».** Le fichier appartient à la phase 39 :
   interdit d'y toucher, y compris pour renommer. Conséquence visible : la feuille des salles
   secondaires et le titre de barre mobile annoncent encore l'ancien nom, alors que la salle
   s'intitule « L'Atlas ». Le cas E2E correspondant a été réécrit pour suivre le lien tel qu'il est
   et vérifier qu'il mène bien à `/atlas`. **Dette à basculer en phase 39.**
3. **`DESIGN_SYSTEM.md` : addition, pas renommage.** Le document ne nommait pas la salle (aucune
   occurrence d'« Assemblage ») : la ligne `/atlas` → **L'Atlas** est ajoutée au §2. Le brief
   parlait d'un renommage ; il n'y avait rien à renommer.
4. **Le niveau régional n'est pas ouvrable.** L'API de la phase 34 n'offre pas de route par région.
   Les régions sont lues dans la table (nom, possession, couverture) sans être interactives ; la
   descente va département → commune. Rien n'a été ajouté côté API.
5. **`packages/shared/src/atlas.ts` : un commentaire.** Le commentaire de tête disait « salle
   L'Assemblage » ; il dit « salle L'Atlas ». Aucun type, aucun champ, aucun contrat modifié.
6. **`mobile.spec.ts` a été réécrit, pas supprimé.** L'ancien cas assertait le teaser (URL
   `/assemblage`, titre, « Bientôt disponible », image « Carte de France, encore vide ») : tout cela
   disparaît par construction. Le cas vérifie désormais que le lien mène à `/atlas` et que le titre
   de la salle est « L'Atlas » — plus exigeant sur ce que la phase change, et sans `skip`.

## Vérification

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_35' \
  dev bun run ci:check

  ✓ 1/4 Lint            Checked 288 files. No fixes applied.
  ✓ 2/4 Typecheck       6 workspaces
  ✓ 3/4 Base de données joignable, base de test prête : 15 migrations, dans l'ordre
  ✓ 4/4 Spécifications  408 pass, 0 fail, 22 files

docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test

  90 passed, 0 failed, 0 skipped
  chromium 43 · pwa 7 · Pixel 7 20 · iPhone 13 20
```

Le banc est passé de 68 à **90 cas** : +8 pour L'Atlas, et les 14 autres viennent des phases 34 à
37 déjà fusionnées dans la vague. Aucun `skip`, aucun `.fixme`, aucun délai d'attente relâché,
aucune assertion retirée.

**Ce qui n'a pas été regardé.** Aucune capture ni jugement visuel de la salle : la preuve est le
banc Playwright (qui mesure le débordement à 320 px, la taille de police, le contraste calculé et
le mouvement réduit) et `ci:check`. Le repli de chargement n'est pas observé en E2E — il se résout
avant la première assertion —, il est prouvé par le typecheck et par le chemin partagé
`entities.length === 0`.

**Incident d'environnement, écrit pour la vague.** Le banc E2E partage son nom de projet et son
volume entre tous les worktrees : une session sœur avait appliqué la migration `0016_notifications`
à la même base, ce qui faisait sortir l'API de cette branche en `corrupted migrations`. La pile a
été remise à zéro (`down -v` puis `up --build`) et le banc rejoué deux fois de suite, vert.

## Reprise — vérification indépendante (2026-11-22, 16 h)

Passe séparée sur le diff livré, puis correctifs. Trois défauts réels, invisibles pour
`ci:check` et pour les cas E2E existants, donc trouvés à la lecture des largeurs et des couleurs.

1. **La couverture était rognée à 320 px.** `table-fixed` + `overflow-hidden` sur le cadre : la
   colonne de couverture du département faisait 20 % de 280 px, soit 44 px utiles pour
   `100,0 %` en JetBrains Mono 12 px (≈ 50 px), et le lien « Cadastre » du national débordait de
   même. Colonnes rééquilibrées — national `48/24/28`, département `50/26/24` —, `whitespace-nowrap`
   sur les cellules numériques et `break-words` sur la colonne d'état. Aucun débordement
   horizontal n'était mesuré : le texte était coupé **à l'intérieur** du cadre.
2. **Le message d'erreur échouait AA.** `text-danger` (`#b4463a`) sur `bg-cabinet-raised`
   (`#131b17`) vaut **3,24:1** pour du texte de 14 px, sous le 4,5:1 du critère 3. Le rouge reste
   porté par la bordure (`border-danger/45`) et le fond (`bg-danger/10`), le texte repasse en
   `text-vellum` (≈ 13,5:1). Aucun jeton ajouté.
3. **Le niveau national n'était plus lisible pendant le chargement du département.** La carte
   restait, mais la table — le seul équivalent accessible d'un SVG `aria-hidden` — était remplacée
   par une ligne « Chargement des communes… ». La table nationale reste désormais affichée sous
   `aria-busy="true"`, ce que le point 4 des paramètres demande explicitement.

**Vérification rejouée après correctifs, dans Docker, sur cet état exact :**

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_35' \
  dev bun run ci:check

  ✓ 1/4 Lint            Checked 288 files. No fixes applied.
  ✓ 2/4 Typecheck       6 workspaces
  ✓ 3/4 Base de données 15 migrations, dans l'ordre
  ✓ 4/4 Spécifications  408 pass, 0 fail, 2 519 expect(), 22 fichiers

docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test

  90 passed (2.9m), 0 failed, 0 skipped
```

## Reprise — audit du travail récupéré et rejeu des vérifications

Le code de cette phase a été écrit par deux sessions interrompues avant de vérifier et de
committer. Une reprise a donc relu l'ensemble contre le brief 35 et contre
`.docs/07-roadmap-v2.md` §4, puis rejoué les deux preuves. Aucune assertion de `packages/spec`
n'a été touchée, aucun cas E2E n'a été supprimé, aucun `skip` ajouté.

**Le cas E2E mobile, avant et après.** L'ancien cas (URL `/assemblage`, titre « L'Assemblage »,
« Bientôt disponible », image « Carte de France, encore vide ») devient
`mobile — l'ancienne salle de l'Assemblage mène à L'Atlas` : même clic depuis la feuille, puis URL
`/atlas`, titre de niveau 1 « L'Atlas », **table équivalente « Table équivalente de la carte »
visible**, et **absence** de « Bientôt disponible ». Le cas asserte donc le remplacement, et
conserve la preuve que le teaser a disparu — il n'est ni supprimé, ni affaibli.

**Rejeu, après reconstruction de la pile.** Le banc servait encore un bundle antérieur aux dernières
écritures web : l'image a été reconstruite depuis le worktree, le conteneur `api` recréé de force
(`--force-recreate`), et la fraîcheur du bundle vérifiée dans `/app/public/assets` (« Ouvrir les
communes de », `data-entity-code`). Le référentiel E2E a été resemmé, puis :

- `ci:check` (base `hexamap_test_35`) : **408 spécifications, 22 fichiers, 0 échec**, deux
  passages consécutifs ;
- banc complet : **90 exécutés, 90 passés, 0 échoué, 0 ignoré** (2,6 min) ;
- après renforcement du cas mobile, rejeu ciblé : **3 passés** (chromium : la redirection ;
  Pixel 7 et iPhone 13 : le cas mobile).

**Deux notes de reprise.**

1. `apps/web/src/routes/atlas.tsx` portait un nom de classe `atlas-entity` qu'aucune règle de
   `styles.css` ne définit. Le fichier restait sous un bail d'édition d'une session antérieure au
   moment de la reprise ; la classe est inerte et a été laissée en place plutôt que de forcer le
   bail. Aucun comportement n'en dépend.
2. `packages/shared/src/atlas.ts` ne portait plus qu'une référence textuelle morte à l'ancien nom
   (« salle L'Assemblage »), dans son commentaire de tête : corrigée en « salle L'Atlas », sans
   toucher au contrat.

## Reprise — la coquille rendue intacte, et le rejeu qui suit

**Un commit avait renommé `nav-items.ts`.** Sur cette branche, un commit
(`2568289 fix(web): renommer l'entrée de salle en L'Atlas`) modifiait
`apps/web/src/components/layout/nav-items.ts` : le libellé de la salle et les deux clés
`'/assemblage'` devenaient `'/atlas'`. Ce changement contredisait le brief — `components/layout/`
appartient à la phase 39 — et le critère d'acceptation 8 ; il cassait aussi en silence le cas E2E
mobile, qui clique le lien nommé « L'Assemblage » et ne le trouvait plus.

**Il a été annulé** (`55af7e8 revert(web): rendre la coquille intacte à la phase 39`). La coquille
annonce donc toujours « L'Assemblage » alors que la salle s'intitule « L'Atlas », et `/assemblage`
redirige vers `/atlas`. C'est la dette de la phase 39, désormais réellement intacte :
`git diff --stat feat/v2-wave-3..HEAD -- apps/web/src/components/layout/` est vide.

**La classe inerte a été retirée.** `apps/web/src/routes/atlas.tsx` portait encore `atlas-entity`
sur ses tracés, sans qu'aucune règle de `styles.css` ne la définisse. La note de reprise
précédente l'avait laissée faute de bail d'édition ; elle est supprimée (`64b4528 fix(web):
retirer une classe de L'Atlas sans règle CSS`). Aucun comportement n'en dépendait.

**Rejeu des deux preuves, dans Docker.**

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_35' \
  dev bun run ci:check

  ✓ 1/4 Lint · ✓ 2/4 Typecheck · ✓ 3/4 Base de données · ✓ 4/4 Spécifications
  408 pass, 0 fail, 22 files  (2534 expect() calls)

docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test

  90 passed, 0 failed, 0 skipped  (2,2 min)
  chromium 43 · pwa 7 · Pixel 7 20 · iPhone 13 20
```

Le cas `mobile — l'ancienne salle de l'Assemblage mène à L'Atlas` passe sur les deux projets
mobiles.

**Portée de cette passe.** Aucun cas de spécification, aucun cas E2E et aucun `skip` n'a été
touché ; `packages/spec` est intact. Seuls `nav-items.ts` (annulation) et `atlas.tsx` (retrait de
la classe) ont changé depuis la reprise précédente.
