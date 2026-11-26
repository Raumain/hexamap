# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

# La v2 — implémentée, non fusionnée

## Statut

- **Phase** : v2.0 et v2.1 — les douze phases (32 à 43) sont **fusionnées dans `v2`**
- **État** : `v2` est poussée à `9f8bf9c` et **vérifiée sur place** — `ci:check` vert
  (**548 spécifications**, 28 fichiers, 0 échec) et banc E2E complet (**106 cas**). Aucune pull
  request ouverte. Les huit vagues sont fusionnées (#71, #72, #76, #77, #78) ou fermées avec
  explication (#73, #74, #75, dont le contenu est arrivé par `feat/v2-wave-8`).
- **Priorité** : P1
- **Mis à jour** : 2026-11-22
- **Branche** : `v2` — c'est elle qui porte la v2 ; `main` n'a rien reçu
- **Accumulation** : `feat/v2-wave-1` … `feat/v2-wave-8` ; `feat/v2-wave-8` porte les douze
  phases et a été fusionnée dans `v2` (`ca0d0d0`)

## Objectif

Trois demandes ouvertes côté produit, et une quatrième à moitié construite : **voir sa collection
sur une carte** (L'Atlas, trois niveaux, descente guidée), **être prévenu de ce qui arrive** (Le
Guichet et sa cloche, puis La Sonnette), **gérer son compte et échanger** (Les Comptes, La Vitrine,
Le Troc, L'Atelier, Le Palmarès), avec **Le Cadastre filtrable** alimenté par la carte. Écartés et
restés écartés : enchères, guildes, objectifs hebdomadaires, partage d'image, rues sur la carte,
comparaison inter-joueurs, chat, SSE et websockets.

## Les douze phases

| Phase | Salle / objet | Branche | Migration | PR |
| --- | --- | --- | --- | --- |
| 32 | Le Socle | `feat/v2-32-socle` | `0014_ref_integrity` | #59 → `v2` |
| 33 | la donnée de l'Atlas | `feat/v2-33-assemblage-data` | `0015_atlas_paths` | #61 |
| 34 | l'API de l'Atlas | `feat/v2-34-assemblage-api` | — | #62 |
| 35 | L'Atlas (la salle) | `feat/v2-35-assemblage-salle` | — | #65 |
| 36 | Le Cadastre filtrable | `feat/v2-36-cadastre` | — | #67 |
| 37 | Les Comptes | `feat/v2-37-comptes` | — | #63 |
| 38 | La Vitrine, la planche | `feat/v2-38-vitrine-planche` | — | #60 |
| 39 | Le Guichet | `feat/v2-39-guichet` | `0016_notifications` | #64 |
| 40 | Le Troc | `feat/v2-40-troc` | `0017_trade_offers` | #66 |
| 41 | L'Atelier | `feat/v2-41-atelier` | `0018_card_source` | #68 |
| 42 | Le Palmarès | `feat/v2-42-palmares` | `0019_tableau_score` | #69 |
| 43 | La Sonnette | `feat/v2-43-sonnette` | `0020_push` | #70 |

Les douze pull requests sont **en brouillon**. Seule #59 cible `v2` ; les onze autres ciblent la
branche d'accumulation de leur vague parente, dans l'ordre des vagues. Aucune n'a été fusionnée.

## Preuves par vague

Mesures faites **dans Docker**, sur la branche d'accumulation de chaque vague, par `ci:check`
(lint, typecheck, préparation de la base, spécifications) **et** par le banc E2E complet, avant
d'accumuler la vague suivante.

| Vague | Phases | Specs | E2E |
| --- | --- | ---: | ---: |
| 1 | 32 | 348 | 72 |
| 2 | 33 · 38 | 371 | 75 |
| 3 | 34 · 37 | 408 | 82 |
| 4 | 35 · 39 | 418 | 92 |
| 5 | 36 · 40 | 469 | 101 |
| 6 | 41 | 487 | 102 |
| 7 | 42 | 506 | 103 |
| 8 | 43 | 548 | 105 |

Le compte d'`expect()` n'est pas un invariant (certaines assertions vivent dans une boucle sur le
référentiel) : les chiffres stables sont le nombre de **spécifications** et le nombre de **cas
E2E**. Aucun `skip`, aucun `.fixme`, aucun délai relâché n'a été ajouté sur ces huit passages.

## Les huit défauts du lanceur corrigés

Aucun ne vivait dans le code du jeu ; tous venaient de l'outillage qui enchaîne les phases.

1. **Réinstallation des dépendances après une fusion** — une fusion qui touche `package.json` ou le
   verrou laissait un `node_modules` périmé, et la phase suivante échouait au typecheck.
2. **Réutilisation d'un worktree existant à la reprise** — `--keep` laissait les worktrees en
   place ; une relance retrouvait le chemin occupé et `git worktree add` échouait en `fatal: already
   used by worktree`, alors que le lanceur venait d'annoncer « reprise ». L'arbre est désormais
   réutilisé quand il est déjà monté sur la branche demandée.
3. **Migrations sérialisées et base préparée avant les workers** — `runMigrations` prend un
   `pg_advisory_lock` tenu sur une seule connexion, et la base de test est préparée une fois,
   sérialement, avant que les fichiers de spec ne s'exécutent en parallèle.
4. **`prepare` renommé `db:prepare`** — `prepare` est un crochet de cycle de vie npm : le nommer
   ainsi le faisait exécuter par tout `bun install`, et cassait le build de l'image.
5. **Refus d'une phase sans commit** — une session qui rendait la main sans avoir committé laissait
   une branche identique à sa base, où `ci:check` est vert parce qu'il n'y a rien à casser. Le
   lanceur compte désormais les commits au-delà de la branche de base et refuse la phase à zéro.
6. **Refus d'accumuler un worktree non propre** — le complément du précédent : une session peut
   aussi laisser du travail **sur le disque**. `ci:check` le voit et passe au vert, la fusion ne
   transporte que la branche, et le travail disparaît. Le contrôle a lieu **après la session et
   avant l'accumulation**, et nomme les fichiers en cause.
7. **Message de conflit de fusion corrigé** — le message annonçait une résolution qui n'avait pas
   eu lieu (voir la session, plus bas).
8. **Interdiction de finir un tour en attendant un sous-agent** — une session qui s'arrêtait en
   attendant un sous-agent rendait la main sans rien committer, et le lanceur croyait la phase
   finie.

## Ce qui reste à faire

1. **Relire `v2`** — c'est l'état de référence désormais, et il a été mesuré sur place, pas sur
   une branche. Les douze pull requests de phase sont fusionnées ou fermées ; les branches de
   phase ont été supprimées sur l'origine après fusion.
2. **`main` n'a rien reçu** : une release fusionne `v2` dans `main`, sur demande explicite,
   jamais automatiquement.
3. **`GET /tableaux` recalcule encore le score** alors que `tableaux.score` existe depuis `0019` :
   deux surfaces, deux valeurs possibles pour le même tableau. Le Palmarès ne lit que la colonne
   figée ; unifier demanderait de toucher une attente gelée de `packages/spec/src/tableaux.spec.ts`.
   À trancher avant que la divergence ne devienne réelle.
4. **La suppression de compte reste derrière `LEGAL_PAGES_ENABLED`** tant que la PR #58 (documents
   légaux) n'est pas fusionnée : on ne publie pas une suppression de compte dont la politique de
   confidentialité répond `404`.
5. **Le test de charge de l'Atlas (`p95 ≤ 200 ms`) a expiré une fois sous contention** — p95 mesuré
   **23 ms** en vague 3, **61 ms** aujourd'hui. Il faudra réduire la concurrence des fichiers de
   spec ou isoler ce test de mesure.
6. **`market — un double-appui n'achète qu'une fois` a été instable une fois** (2 appels au lieu de
   1, passé au retry) : à surveiller, non expliqué.
7. **Le service `dev` monte `./node_modules:/app/node_modules`**, donc le `bun install` du lanceur
   installe dans le `node_modules` de l'arbre principal et pas dans celui du worktree. Sans effet
   aujourd'hui, latent sinon.

---

# Journal

### 2026-11-26 — Le troc devient proposable depuis les amis

Branche `feat/v2-troc-depuis-amis`. Le diagnostic d'abord : `POST /api/v1/trades`
fonctionnait, mais aucun chemin atteignable ne pouvait le nourrir. Le seul bouton
`ProposeTrade` vivait dans Le Cartel, et `GET /cards/:id` ne révèle une carte d'autrui
que si elle est en vente (`locked`) ou déjà engagée dans une offre `PENDING` — exactement
les deux états que `proposeTrade` refuse en `409 CARD_LOCKED` / `409 CARD_ALREADY_IN_TRADE`.
Rester sur sa propre carte rend `400 TRADE_SELF_OFFER`. Les quatre chemins échouaient donc,
et le banc proposait par l'API.

La surface ajoutée est amicale et fermée : `GET /api/v1/trades/friends/:friendId/cards`
ouvre la collection **troquable** d'un ami `ACCEPTED` — `403 FRIEND_REQUIRED` sinon,
`400 FRIEND_SELF` pour soi-même, `404 USER_NOT_FOUND` pour un joueur disparu. Elle exclut
`locked = true` et toute carte citée par une offre `PENDING`, offerte ou demandée (les deux
index partiels rendent tout autre état impossible), et rend au plus 50 cartes triées par
score. `loadFriendTradeCards` réutilise `pairCondition` de `services/friends.ts`,
`resolveCardNoms`/`resolveCardAssets` et `toCard` — aucune résolution de nom dupliquée.
Aucune migration. `proposeTrade` n'est pas touché : la surface respecte ses règles, elle
ne les relâche pas.

Côté navigateur, `ProposeTradeDialog` est exporté et piloté par `open`/`onOpenChange`
(Le Cartel garde son bouton et son wrapper). `FriendTradePanel` s'ajoute à chaque ami
accepté dans `/friends` : il liste les cartes de l'ami (planche `w-14`, nom, rareté, score),
puis ouvre le dialogue de proposition déjà existant pour la carte choisie. La vitrine
publique ne rend rien de tout cela.

Mesuré dans Docker : `ci:check` vert aux cinq étapes, **594 spécifications** (22 dans
`trade.spec.ts`, dont 5 neuves) ; banc E2E, cas du troc rejoué sur le seul projet
`chromium`, 1 passed — la proposition part cette fois du produit (`/friends`, liste de
l'ami, dialogue, propre carte), et l'acceptation déplace toujours les deux cartes.

### 2026-11-26 — Pages légales sans vente, suppression de compte ouverte

Branche `feat/v2-legal-sans-vente`, partie de `v2` (`59e7dce`). Deux demandes du titulaire, une
dans chaque sens : retirer du droit la boutique qui n'existe plus, et rendre effective la
suppression de compte que le droit décrivait déjà.

**Les pages légales ne vendent plus rien.** La boutique est éteinte (`SHOP_ENABLED = false`), la
CGV retirée, l'éditeur non professionnel ; `apps/web/src/content/legal.ts` décrivait pourtant
encore Stripe, des packs d'écus, des factures, un médiateur de la consommation et un achat réservé
aux majeurs. Disparaissent : la clause Stripe du stockage, le bloc « Le paiement », le bloc
« Médiation de la consommation » et sa constante, la conservation décennale des factures
(`L. 123-22`), l'achat de packs dans « Mineurs », la mention de carte bancaire, la conversion des
écus en euros et les pièces comptables. Restent les seules phrases vraies : hébergement OVHcloud,
jeu de divertissement sans gain en argent réel, grand-livre supprimé avec le compte. `LAST_UPDATED`
passe au 26 novembre 2026.

**La suppression de compte n'attend plus un interrupteur.** Le mécanisme existait de bout en bout
(`DELETE /api/v1/account`, `DangerSection`, `capabilities.deletion`) mais restait invisible :
`ACCOUNT_DELETION_ENABLED` valait `false` par défaut, et `.env` ne le posait pas. La condition
documentée — les pages légales publiées — est remplie (`LEGAL_PAGES_ENABLED = true`) : le défaut
passe à `true`, la variable devenant l'échappatoire (`false` referme, `503
ACCOUNT_DELETION_DISABLED`). `packages/spec/src/account.spec.ts` exerce désormais les deux états
**explicitement** (`'false'` au lieu d'une variable absente) et gagne un cas qui verrouille le
défaut ouvert ; aucun cas gelé n'est supprimé. `.docs/05-deploiement.md` §7 suit.

**Mesuré, dans Docker.** `ci:check` vert : **592 spécifications**, 0 échec, mesure de charge
p95 31,7 ms pour un seuil de 200 ms. Banc E2E complet vert : **134 cas**. La revue a corrigé deux
choses que le premier jet laissait : un commentaire qui annonçait `403` là où la route répond
`503`, et deux formulations encore financières (« coordonnée de carte de crédit », « pièces
comptables ») que le grep de la phase n'attrapait pas.

### 2026-11-25 — Le Cadastre s'épure, L'Atelier repart en v3

Branche `feat/v2-cadastre-epure`, partie de `v2` (`f747d98`). Quatre demandes du titulaire,
trois dans Le Cadastre, une qui en sort.

**Le filtre « Département » disparaît.** Il était le seul filtre du Cadastre qui demandait une
donnée serveur : le `<select>` était alimenté par `atlasSummaryQueryOptions()`, donc une requête
`/atlas/summary` était tirée à l'ouverture du panneau pour lister 101 codes. Le retrait emporte
la clé `departement` du contrat d'URL (`CollectionFilters`, `CollectionSearchWire`,
`parseCollectionSearch`, `serializeCollectionSearch`), `isDepartementCode`, `matchesDepartement`
et les trois libellés. Un `?departement=75` qui traîne devient une **clé inconnue** : la
normalisation existante l'écarte et réécrit l'adresse — c'est verrouillé par un cas de spec
(« un code de département entrant n'est plus un filtre ») et par un cas E2E (l'URL revient à
`/collection`, aucune `combobox` « Département », la liste reste entière). **Écart assumé** : le
lien « Voir les cartes au Cadastre » de L'Atlas posait `search={{ departement }}` ; il pose
désormais `search={{ q: code }}`. La recherche par code retrouve le département *et* ses communes
(les codes INSEE sont préfixés par le code du département), donc le parcours survit — il est
prouvé par `cadastre — le parcours depuis L'Atlas` et `atlas — le département mène au Cadastre`,
tous deux réécrits. La catégorie « Département » reste, elle : c'est un filtre à puces, sans
requête.

**Filtrer ne remonte plus la page.** `CollectionTable` montait un `useWindowVirtualizer` et, dès
que le nombre de lignes changeait, appelait `rowVirtualizer.scrollToOffset(0)` — c'est-à-dire un
défilement de la **fenêtre** vers le haut de page. Le remplacement ne bouge la fenêtre que si
l'en-tête de la liste est **sorti par le haut du viewport** (`getBoundingClientRect().top < 0`),
et il le ramène à 12 px du bord, sans animation. Un clic sur un filtre visible ne déplace donc
rien. **Ce comportement n'a pas de cas E2E** : le panneau de filtres vit en haut de page, si bien
que tout clic y ramène la vue et que l'assertion ne distinguerait plus l'ancien du nouveau. La
vérification est faite dans le navigateur (captures desktop 1280 px et mobile 390 px), et le
journal le dit comme le demande la règle 10.

**Les exemplaires ont une colonne.** La puce `×N`, minuscule, n'apparaissait qu'au-delà d'un
exemplaire et jamais sur mobile. Le tableau gagne une septième colonne **« Exemplaires »**, entre
le score et la date, qui dit toujours ce qu'elle compte — « 1 exemplaire », « 3 exemplaires » —
en laiton mono tabulaire, triable. Sur mobile, où les colonnes au-delà de la première sont
masquées, le même libellé rejoint la ligne de métadonnées sous le nom. `gridTemplate` passe à
sept pistes ; la capture montre `1 exemplaire` sur une ligne et `4 exemplaires` sur l'autre, sans
débordement horizontal (1280 et 390 mesurés à `documentElement.scrollWidth === clientWidth`).
Le tiroir de La Planche et le Cartel gardent la marque compacte `×3`, qui est leur vocabulaire.

**L'Atelier est retiré du produit.** Ce n'était pas une salle : un panneau `<CraftPanel>` monté
dans Le Cadastre et une route `POST /cards/craft` dans `routes/cards.ts`. Disparaissent donc le
panneau, `apps/web/src/lib/atelier.ts`, `apps/api/src/services/atelier.ts`, le bloc `ATELIER` et
ses quatre formateurs, la route et son schéma, plus `packages/spec/src/atelier.spec.ts`,
`packages/e2e/tests/atelier.spec.ts` et `packages/e2e/fixtures/atelier-fixture.ts` (vérifié : seul
consommateur). **Le socle reste** : migration `0018_card_source`, `CRAFT` dans `CardSource`,
`t.CRAFT` dans les schémas de réponse, et `packages/shared/src/atelier.ts` — `craftGroupKey` est
le pivot de la fonctionnalité **exemplaires**, qui reste livrée et verte. Aucune migration n'est
touchée : une migration livrée ne se réécrit pas. `.docs/02-database.md` §4.2 et
`.docs/07-roadmap-v2.md` (phase 41) disent désormais que la valeur existe sans écrivain.

**Mesuré, dans Docker.** `ci:check` vert aux cinq étapes : lint, typecheck, base de test (21
migrations), **544 spécifications** et 0 échec (le compte baisse de 4 : `atelier.spec.ts` disparaît
et trois cas département sont remplacés par un cas de non-filtre), puis mesure de charge (p95 du
résumé d'Atlas à 10,0 ms pour un seuil de 200 ms). Banc E2E complet vert : **118 cas**, 0 échec,
sur `chromium`, `pwa`, `Pixel 7` et `iPhone 13` — dont les huit cas du Cadastre, le parcours
d'Atlas réécrit et `trois identiques font une ligne, deux éditions en font deux` qui lit maintenant
« 3 exemplaires ».

Rien n'est commité : la branche porte le diff, le titulaire décide du découpage.

### 2026-11-25 — Atlas, descente région et possession lisible

Demande du titulaire sur `/atlas` : rendre la possession immédiatement lisible et
ouvrir la région. La descente passe à **trois niveaux** (national → région →
département) par une pile `AtlasLevel` : remonter dépile d'exactement un niveau,
et le libellé du retour nomme le parent (`Revenir à la région …`) ou la France
entière. Le clic sur une région de la carte fait ce que fait sa ligne de table, et
la table équivalente suit la sélection — au national régions et départements, en
région ses seuls départements (nouvelle `RegionTable`), au département ses
communes, inchangé.

Le **conteneur ouvert porte un contour de laiton** (`path[data-map-outline="true"]`,
tracé au-dessus de ses enfants, `pointer-events: none`, sans `data-entity-code`
pour que la parité lignes/tracés tienne). Une entité possédée s'éclaire désormais
d'un **fond doré clair** (`fill-brass-pale`) au lieu du vert sombre : département
et commune possédés se lisent à l'aplat, le vert restant la couverture des
non possédées. La région reste un contour, doré quand elle est possédée. Aucune
couleur littérale : uniquement les jetons de `styles.css`.

Les **contours sont épaissis** pour se voir : région 3,5 px (possédée) et 2 px
(manquante), département 3 / 1,5, commune 2,5 / 1,25, cadre de l'entité ouverte
**5**. Tous restent des pixels écran (`vector-effect: non-scaling-stroke`), donc
lisibles même très zoomés ; aucun remplissage n'a bougé.

Le **recadrage est animé**, et c'est lui qui fait le zoom : un seul `<svg>`
persiste du national au département (aucun remontage), et à chaque descente son
`viewBox` est interpolé **480 ms** par `requestAnimationFrame` (easing cubique
`1 − (1 − t)³`) jusqu'à un cadre **carré et centré** sur la boîte du tracé cliqué
(`getBBox()`, marge de 12 %). Ce carré n'est pas cosmétique : avec
`preserveAspectRatio` `meet` dans un viewport carré, l'échelle perçue vaut
`S / max(width, height)`, et un cadre allongé la ferait reculer au milieu du vol —
le « dézoom avant rezoom ». Pour la même raison, le **centre** est interpolé en
linéaire et la **taille en logarithme** : le plan se resserre à vitesse constante,
et la largeur des frames ne remonte jamais (verrouillé par le banc).
La prop React reste `transition.from` pendant tout le vol, donc un re-rendu (le
détail du département qui arrive) ne réécrit pas l'attribut. La carte du niveau
précédent reste dessinée sous la nouvelle (`data-ghost`, sans `data-entity-*`,
retirée à la fin), ce qui supprime l'impression de rafraîchissement. Hors
métropole (DROM), le cadre reste **exactement** celui du groupe — c'est le repère
où ses tracés sont projetés — et le changement de repère s'applique d'un coup,
sans interpolation. Sous `prefers-reduced-motion: reduce`, aucune animation : le
cadre est posé immédiatement. Limite assumée : sur la carte, une région ne se
clique que sur son **contour** (le tracé ne remplit pas) ; la ligne de table reste
le chemin accessible et fiable, et les cas E2E passent par elle.

Cinq cas E2E ajoutés (région ouverte, fond plus clair, cadre doré + communes,
zoom sans remontage — marqueur DOM et sonde de frames —, cadre immédiat sous
mouvement réduit). La possession n'étant pas devinable depuis le code, les
contre-épreuves sont lues dans le DOM (`data-possession="false"`) — `E2E-C-COMMUNE-0`
peut être tirée par le ticket du compte, et un cas qui la supposerait libre
deviendrait faux une fois sur deux.

### 2026-11-22 — Phase 32, Le Socle (vague 1, 348 specs · 72 E2E)

Le découpage par route demandé par le brief était **déjà fait** (`autoCodeSplitting: true` depuis
`eb18205`) : le gain restant était le vendor absorbé par le chunk d'entrée (478,09 Ko bruts /
145,61 Ko gzip avant la phase), et c'est là que porte le lot. Le 404 a reçu un composant français,
et le navigateur a trouvé un vrai défaut que le typecheck n'aurait jamais vu : le composant de
repli rendu **dans l'`Outlet`** de la route qui gère le défaut produisait deux `<main>`, deux rails
et deux barres d'onglets.
`0014_ref_integrity` protège là où le dégât se produit : gardes `TRUNCATE` sur les trois tables de
référentiel, `--merge` + `pruneUnreferencedReferenceRows` dans l'import, `orphan_user_cards()`, et
`isFrenchRegionCode` avant la première écriture. **Écart mesuré, pas négocié** : la FK
`(category, ref_code)` et le `CHECK` sur `ref_regions.code` du brief sont inatteignables sans
réécrire `packages/spec` — les fixtures fabriquent volontairement de l'hors-référentiel, dont le
référentiel `E2E-*` du banc entier. BUG-001 est écrit comme **procédure d'opérateur**, non exécuté.

### 2026-11-22 — Phase 33, la donnée de l'Atlas (vague 2, 371 specs · 75 E2E)

L'audit demandé a renversé le brief : `geom` valait `NULL` sur **18/18 régions, 99/99 départements
et 34 509/34 509 communes**, et aucun écrivain du dépôt ne la remplissait (`gouv.ts` la posait à
`null` en dur ; `blasons.ts` téléchargeait une vraie géométrie pour la projeter en SVG 100 × 100
sans jamais la persister). La chaîne a donc été rendue vraie de bout en bout : l'import enregistre
la géométrie, `0015_atlas_paths` dérive `path_d`. Couverture métropolitaine obtenue : 13 régions,
96 départements et 34 740 communes tracés ; les 129 communes d'outre-mer sont classées
`out_of_viewbox` et non « manquantes ». Seconde passe : **0 tracé réécrit**, l'étape est idempotente.
Les 6 + 6 + 36 lignes « sans géométrie » sont des fixtures de spec fuitées dans la base de
développement (BUG-001), pas des trous de référentiel.

### 2026-11-22 — Phase 38, La Vitrine, la planche (vague 2, 371 specs · 75 E2E)

`loadBestTableau` **jetait** les quatre cartes après le calcul du score, et un tableau troué était
purement ignoré : la salle rend désormais les quatre positions, `null` compris. Les quatre
emplacements coûtent **une seule instruction** (CTE `showcase_slots`, `blasonOf` côté TS),
invariante au nombre de cartes ; la page entière reste à 12 instructions en régime établi, le total
littéral « une requête » n'est donc pas atteint. Deux défauts trouvés en revue, pas en
implémentation : `t.Array(t.Union([objet, t.Null()]))` répondait `422` sur un tableau troué, et la
fixture E2E désignait le compte principal par trois codes stables seulement, donc cassait après un
réensemencement. **Écart** : population d'une commune et occurrences d'une rue affichent `—`, faute
de champ au contrat ; le SQL brut de la requête dévie d'`apps/api/AGENTS.md`, avec le précédent du
même fichier.

### 2026-11-22 — Phase 34, l'API de l'Atlas (vague 3, 408 specs · 82 E2E)

`GET /api/v1/atlas/summary` et `GET /api/v1/atlas/departements/:code`, **une instruction SQL
chacune** (mesuré par un journal Kysely, `toHaveLength(1)`), schémas `response` fermés.
p95 mesuré à **30,0 ms** sur 2 000 cartes et 20 appels, pour un seuil asserté à 200 ms ; la charge
d'un département de 900 communes pèse 337 527 octets. **Écarts consignés** : le plafond de 60 Ko par
département du brief est hors d'atteinte (166 715 octets de `path_d` pour le département 62, 8,5 Mio
de somme nationale) et le critère n'est pas coché ; le SQL brut compose dans un `selectNoFrom`
Kysely, faute de pouvoir exprimer `json_agg` dans le constructeur typé sans rouvrir le N+1 interdit.

### 2026-11-22 — Phase 37, Les Comptes (vague 3, 408 specs · 82 E2E)

Changement de pseudo, courriel et suppression de compte, avec la réauthentification par mot de passe
puis la saisie du pseudo en confirmation. `packages/spec/src/account.spec.ts` : 23 cas ;
`packages/e2e/tests/account.spec.ts` : 7 cas. La spec est d'abord passée rouge
(`Cannot find module '@hexamap/api/lib/mailer'`), puis le cas d'ordre de la suppression a lui aussi
été vu rouge (`400` reçu, `401` attendu). **La reprise a trouvé un vrai défaut** : `deleteAccount`
vérifiait la confirmation du pseudo **avant** le mot de passe, donc deux champs faux rendaient
`400 CONFIRMATION_MISMATCH` au lieu de `401 INVALID_PASSWORD`, et une session volée apprenait le
pseudo sans connaître le mot de passe — `verifyPassword` remonté avant toute lecture de compte.
Écart noté pour plus tard, non corrigé : une cascade `on delete cascade` ferait échouer le webhook
de remboursement Stripe arrivé après une suppression de compte ; la boutique est éteinte, le cas est
inatteignable, mais il devra tolérer un compte disparu le jour de sa réouverture.

### 2026-11-22 — Phase 35, L'Atlas, la salle (vague 4, 418 specs · 92 E2E)

Trois niveaux en descente guidée : national, département, commune (qui ne s'ouvre pas mais mène au
Cadastre). Le SVG est **purement décoratif** (`aria-hidden`, `role="presentation"`, aucun
gestionnaire de pointeur) : toute l'interaction vit dans la table équivalente, ce qui tient à la fois
« aucun état React par mouvement de pointeur » et « le SVG ne porte aucune information exclusive ».
`/assemblage` ne rend plus de teaser : un `beforeLoad` redirige vers `/atlas` en conservant la
recherche. Huit cas E2E neufs. **Écart assumé** : `nav-items.ts` annonce encore « L'Assemblage » —
le fichier appartient à la phase 39, la dette est basculée là-bas.

### 2026-11-22 — Phase 39, Le Guichet (vague 4, 418 specs · 92 E2E)

Table `notifications` (`0016_notifications`), une seule fonction d'émission `emitNotification`
appelée **dans la transaction existante** de cinq sites (demande d'ami, acceptation, médaille, vente,
achat) ; aucune contrainte `CHECK` sur `kind`, la liste fermée vivant dans `packages/shared`. Deux
lectures distinctes — liste paginée et compteur — pour que la cloche, montée sur toutes les pages, ne
télécharge pas trente charges utiles toutes les 60 s. La purge est un balayage **borné au lecteur**
dans `GET /notifications` ; le compteur ignore l'expiré au lieu de purger, donc pastille et salle ne
peuvent pas diverger. Le curseur porte la microseconde et est validé structurellement : six curseurs
invalides répondent `422` au lieu de `500`. Deux cas E2E ajoutés (84 au total sur la branche, la
vague en portait déjà 82).

### 2026-11-22 — Phase 36, Le Cadastre filtrable (vague 5, 469 specs · 101 E2E)

Phase entièrement web : `collection-search.ts` (module pur, 34 cas de spec) et un format d'URL
normalisé `?categorie=…&rarete=…&departement=…&q=…`, listes triées dans l'ordre du domaine, pour que
deux URL équivalentes soient **identiques à la chaîne**. Trois bugs réels trouvés par le travail : le
sérialiseur par défaut du routeur décode en JSON (`?departement=99` arrivait en `number`), un
`stringifySearch` qui oublie son `?` produit `/collectioncategorie=REGION` et fait disparaître la
salle, et le panneau avait supprimé la puce « Toutes » dont `global-setup.ts` a besoin — rétablie,
parce que c'était l'affordance manquante et non une concession au test. Virtualisation inchangée :
une ligne vaut 213 px sous deux jeux de filtres différents. **Friction consignée** : `departement`
n'accepte pas les codes `E2E-D1` du banc, donc un lien depuis un département de test arrive sur un
Cadastre nu.

### 2026-11-22 — Phase 40, Le Troc (vague 5, 469 specs · 101 E2E)

`0017_trade_offers`, `packages/shared/src/trade.ts` (durée 7 jours), service et routes (proposition,
acceptation atomique, refus, annulation, deux boîtes), garde `CARD_IN_TRADE` sur la mise en vente,
17 cas de spec et un banc E2E. L'expiration est un balayage **paresseux borné à l'utilisateur** : le
runtime n'a aucun ordonnanceur, et un balayage global ferait payer à un lecteur les offres des
autres. `locked` n'est jamais posé par le troc ; deux gardes symétriques suffisent.
**Écarts assumés** : le premier troc ne s'invente pas dans l'interface seule — il n'existe aucun
annuaire de joueurs, donc pas de découverte d'une carte à demander ; l'annulation notifie par
`TRADE_DECLINED` avec `withdrawn: true` faute de `kind` déclaré. **Défaut préexistant trouvé, non
corrigé** : `0014_ref_integrity` crée trois triggers sans `drop trigger if exists`, donc le test de
rejouabilité de `.docs/02-database.md` §8 échoue en `42710` — la rejouabilité de `0017` a été
prouvée séparément.

### 2026-11-22 — Phase 41, L'Atelier (vague 6, 487 specs · 102 E2E)

`0018_card_source` (`source` à quatre valeurs, `CRAFT` inclus), règle pure dans
`packages/shared/src/atelier.ts` (seuil 3, palier suivant, `craftGroupKey`), fusion sous transaction
avec `SELECT … FOR UPDATE` ordonné par `id`. **Aucun aléatoire** : la fusion n'ouvre rien, elle
transforme trois exemplaires identiques en une carte du palier suivant, donc aucun angle « coffre à
butin » et aucun test statistique. Un groupe de six reste **une** fusion ; toute la grappe est
consommée. Les cartes engagées dans un tableau, une annonce ouverte ou une offre `PENDING` sont
refusées (`409 CARD_ENGAGED`), parce que les colonnes de `tableaux` sont en `on delete set null` et
qu'une offre tomberait par cascade. **Écart assumé** : le score produit est l'`EDITION_SCORE` du
palier visé, donc une commune ÉPIQUE très peuplée peut valoir plus que la LÉGENDAIRE produite.

### 2026-11-22 — Phase 42, Le Palmarès (vague 7, 506 specs · 103 E2E)

`0019_tableau_score` fige le score dans une colonne — une colonne, pas une table d'instantanés —
avec rétro-remplissage SQL borné (`score is null`), puis `not null` et défaut `0` ; la formule est
recopiée **une seule fois**, dans la migration, parce que `packages/db` ne dépend pas de
`@hexamap/shared`. Semaine **ISO 8601** en UTC (`2027-W53` répond `400` au lieu de déborder), et
départage total `score desc, created_at asc, id asc` : plus d'ex æquo partagé, classement identique
entre deux lectures. `0014_ref_integrity` reçoit la garde `drop trigger if exists` qui la rend
rejouable. **Écarts** : `GET /tableaux` recalcule encore son total (voir « Ce qui reste » §3) ; la
salle ne montre que la semaine courante et 20 lignes quand `total` en annonce davantage ; la revue
laisse neuf points `suggestion`, aucun `deal-breaker`.

### 2026-11-22 — Phase 43, La Sonnette (vague 8, 548 specs · 105 E2E)

`0020_push` et six modules côté API, la paire VAPID générée par un script qui **n'écrit aucun
fichier** et lue **à l'appel** — c'est ce qui permet à la fonctionnalité de s'éteindre proprement
sans casser le démarrage. `push_preferences` est séparée de `push_subscriptions` parce que le
désabonnement supprime la ligne d'abonnement. Le quota (`last_sent_on`, en `text`) et l'anti-doublon
(`last_notified_charge_at`) sont deux colonnes distinctes ; un envoi **tenté** consomme le jour,
après qu'un abonnement durablement cassé se soit fait réessayer toutes les 60 s indéfiniment. Un
battement émet **deux `SELECT`**, jamais une requête par utilisateur : 0,15 ms et 21 lignes lues
dans le régime réel (20 000 abonnements). Le service worker passe à `injectManifest`, ce qui a obligé
à **réécrire** le cas 4 de `pwa.spec.ts` (aucune assertion relâchée). **Ce que la session ne prouve
pas** : la livraison réelle d'une poussée, faute de service de push dans le banc.

### 2026-11-22 — Session : orchestration, reprises et conflits

Les douze phases sont passées par un lanceur unique, une branche par phase, accumulées en huit
vagues, avec `ci:check` et le banc E2E complet mesurés sur chaque branche d'accumulation avant de
passer à la suivante. Les phases ont été distribuées en respectant deux fichiers partagés — une
seule migration et un seul propriétaire de `components/layout/` par vague.

**Trois phases perdues, trois récupérées.** La 35 a été perdue **deux fois** et la 42 **une fois** :
des sessions se sont arrêtées en attendant un sous-agent, l'une sans committer, l'autre en laissant
un worktree en vrac. Le travail n'était jamais détruit — un worktree modifié survit à la mort de sa
session —, mais **rien n'était prouvé** : une sortie de session morte (« all green ») est une
déclaration, pas une preuve. Chaque reprise a donc commencé par relire le diff puis rejouer les
mesures, jamais par croire le journal. C'est ce qui a produit le huitième correctif du lanceur :
interdiction de finir un tour en attendant un sous-agent.

**Deux conflits.**
1. **La base de test corrompue du 19 novembre.** Une phase a retiré sa ligne de `kysely_migration`
   puis appelé `runMigrations` pour prouver la rejouabilité d'une migration. Dès qu'une migration
   **postérieure** existe, la liste exécutée n'est plus le préfixe de l'ordre du code : Kysely lève
   `corrupted migrations` avant toute réapplication, et la base reste cassée pour les autres
   fichiers de spec. Corrigé en appelant directement `up()` du module de migration, sans perdre une
   assertion — et en sérialisant `runMigrations` par `pg_advisory_lock` (correctif 3 du lanceur).
2. **`DESIGN_SYSTEM.md`.** Deux phases de la même vague y écrivaient leur section en même temps ;
   l'une a dû prendre la sous-section suivante libre (§8.9 plutôt que §8.6) plutôt que renuméroter,
   ce qui a donné un diff plus petit et un conflit sans arbitrage. C'est ce qui a fait ajouter un
   seul propriétaire de `components/layout/` par vague.

**La porte est restée verte sur du vide, et c'est le vrai enseignement.** Un `ci:check` vert sur une
branche ne dit rien de la phase : il prouve la branche. Il est vert sur la base quand la phase n'est
pas encore là, vert quand un correctif n'a pas été appliqué, vert quand un worktree est resté sur le
commit d'intégration précédent. Toutes les preuves consignées plus haut ont donc été **re-mesurées
sur la branche d'accumulation** de chaque vague, et non reprises d'un journal de session — y compris
celles des phases dont la session morte avait déjà annoncé des chiffres. Plusieurs reprises ont
trouvé un défaut réel que la porte verte n'avait pas signalé : l'ordre de la réauthentification de
la phase 37, la garde d'idempotence de `0014` pour la phase 42, le rejeu de la spec du Palmarès pour
la phase 43. C'est la preuve que la porte verte ne suffisait pas.

**Portée de cette consolidation.** Aucun fichier de `apps/`, de `packages/spec` ni de migration n'a
été touché ; aucune branche n'a été fusionnée ni poussée. Cette entrée est écrite sur `v2`, qui ne
contient encore aucun code de la v2 : elle décrit ce que porte `feat/v2-wave-8`.

### 2026-11-22 — Fusion des huit vagues dans `v2`, et trois défauts attrapés au passage

**Ce qui a été fusionné.** Les huit vagues sont arrivées dans `v2` par `feat/v2-wave-8`
(`ca0d0d0`), qui porte les douze phases. Les pull requests de vague #71, #72, #76, #77 et #78 ont
été fusionnées ; #73, #74 et #75, dont le contenu était déjà passé par la vague 8, ont été
**fermées avec explication** plutôt que laissées en conflit — une PR ouverte qui ne peut plus
fusionner laisse croire qu'elle attend encore une action.

**Pourquoi les PR ne suffisaient pas.** Fusionner une PR met à jour sa **base**, jamais sa tête :
après #71–#78, les branches de vague avaient divergé les unes des autres, et `v2` n'aurait
contenu que la vague 1. Les vagues sont cumulatives par construction ; la seule intégration juste
est la dernière branche, fusionnée une fois.

**Décisions du titulaire sur l'identité légale.** Le SIREN est retiré des trois documents — avec
lui la qualité de micro-entrepreneur et la mention « TVA non applicable, article 293 B du CGI »,
qui tombent ensemble : un éditeur non professionnel ne les porte pas. Le domicile, le téléphone et
l'adresse électronique restent `nd` et seront publiés tels quels, par décision explicite. Le
bandeau provisoire est **retiré** : il promettait une complétion qui n'aura pas lieu. La fermeture
de compte est ouverte par `.env.example` (`ACCOUNT_DELETION_ENABLED=true`), le défaut du code
restant `false` parce qu'une spécification exerce les deux états en supprimant la variable.

**Trois défauts attrapés, tous par un contrôle différent de celui qu'on attendait.**
1. `web-push`, dépendance ajoutée par la phase 43, manquait dans `node_modules` : la fusion
   manuelle avait omis l'étape que le lanceur fait désormais tout seul. Typecheck rouge.
2. Une résolution de conflit a **dupliqué** `export const PUBLISHER = {` — la ligne était en
   contexte, hors des marqueurs. Fichier syntaxiquement invalide.
3. Et le plus instructif : **les 106 cas E2E passaient sur ce fichier cassé**, alors que le lint
   a vu l'erreur en 180 ms. Une suite de navigateur teste un produit qui démarre ; elle ne dit
   rien de la validité de tous les fichiers. C'est exactement pourquoi la porte a quatre étapes
   et s'arrête à la première.

**Ce qui n'est pas prouvé.** Aucune poussée de notification réelle (pas de service de push dans
le banc). `GET /tableaux` recalcule encore son total alors que `tableaux.score` existe. Sur une
route appariée qui lève `notFound()`, la page française s'affiche **sans `<main>`**, alors qu'une
URL inconnue en rend un : défaut de structure préexistant, consigné dans le cas E2E et **non
figé** par une assertion. Enfin `market — un double-appui n'achète qu'une fois` a vacillé deux
fois sur les huit passages de la vague 8, sans explication.
