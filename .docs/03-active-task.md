# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

# Phase 21 — Les Salles retrouvées (BUG-005)

## Statut

- **Phase** : 21 — Les Salles retrouvées (BUG-005)
- **État** : Terminé
- **Priorité** : P2
- **Mis à jour** : 2026-11-19
- **Branche** : `fix/bug-005-salles-secondaires-mobile`

---

## Objectif

Sur téléphone, un joueur pouvait composer une planche depuis **La Planche** (`/tableau`) mais
aucun chemin ne menait à **Les Planches** (`/tableaux`) ni à **Mes Offres** (`/market/mine`) :
les deux salles n'existaient que dans le rail, masqué sous `md`. La barre basse expose
désormais un cinquième contrôle **Plus** qui ouvre une feuille des salles secondaires, la
salle courante s'annonce par `aria-current`, et les trois routes sont atteintes en deux appuis
depuis `/`. À domaine et contrats d'API constants.

---

## Étapes

### 1. Spec-first — cinq cas rouges
- [x] `mobile.spec.ts` : `/tableaux` et `/market/mine` atteints en deux appuis depuis `/`,
      cible du contrôle **Plus** ≥ 44 px, `Les Planches` éteint sur `/tableau` et allumé sur
      `/tableaux`, Échap ferme et rend le focus, aucun cinquième contrôle sans session.
- [x] Lancés sur le seul projet « Pixel 7 » avant toute implémentation : 4 échecs sur la même
      cause, « element(s) not found » sur `getByRole('button', { name: 'Plus', exact: true })`.

### 2. La feuille
- [x] `components/layout/more-sheet.tsx` (créé, 87 lignes) : `OverlayPortal` → voile
      `bg-cabinet/80` → `role="dialog" aria-modal="true"`, géométrie reprise de `CardDrawer`,
      `pb-[calc(1.25rem+env(safe-area-inset-bottom))]`, poignée `aria-hidden`, titre nommé par
      `useId()`, bouton `aria-label="Fermer"`, écoute d'Échap avec nettoyage, trois entrées de
      `SECONDARY_NAV` à `min-h-[44px]`.

### 3. La barre
- [x] `nav-items.ts` : `MORE_SHEET` et `isSecondaryRoom(pathname)`, sur l'égalité stricte
      d'`isNavItemActive` laissée intacte — c'est elle qui distingue déjà `/tableau` de
      `/tableaux`.
- [x] `bottom-tab-bar.tsx` : cinquième `<button>` monté derrière `useSession()`,
      `aria-haspopup="dialog"` / `aria-expanded`, filet de laiton quand `isSecondaryRoom`,
      retour de focus au contrôle à la fermeture.
- [x] `TabGlyph` gagne un `strokeWidth` optionnel (défaut `1.3`, inchangé pour les quatre
      salles ; `2.2` pour les trois points).

### 4. Banc et vérification
- [x] `mobile.spec.ts` : 28 passés, 2 ignorés sur les deux projets tactiles.
- [x] `design-system.spec.ts` : 11 passés, 1 ignoré.
- [x] `bun run lint` : 164 fichiers, aucune correction.
- [x] `ci:check` : les quatre étapes vertes, 158 spécifications, **794** `expect()` au dernier
      passage (le nombre d'assertions fluctue d'une exécution à l'autre, voir le journal).
- [x] Banc complet sur les quatre projets : 49 passés, 3 ignorés.

---

## Critères d'acceptation

1. [x] Depuis `/`, `/tableaux` et `/market/mine` sont atteints en deux appuis sur téléphone.
2. [x] Le contrôle **Plus** mesure au moins 44 px, comme les quatre onglets.
3. [x] `Les Planches` ne s'allume pas sur `/tableau` et s'allume sur `/tableaux`.
4. [x] Échap ferme la feuille et rend le focus au contrôle qui l'a ouverte.
5. [x] Aucun cinquième contrôle sans session ouverte, en parité avec le rail.
6. [x] `mobile.spec.ts` (28 passés, 2 ignorés) et `design-system.spec.ts` (11 passés,
       1 ignoré) verts ; `ci:check` vert à 158 spécifications.
7. [x] Aucune migration, aucun changement de schéma ni de contrat d'API, aucune dépendance
       nouvelle, `packages/spec` intact.

---

## Journal

### 2026-11-19 — Phase 21 exécutée : Les Salles retrouvées livrées

**Le constat.** À 390 px, la barre basse exposait exactement quatre liens — Relevé, Cadastre,
Planche, Comptoir — et `/tableaux` comme `/market/mine` ne s'atteignaient qu'en saisissant
l'URL. Le joueur pouvait écrire une planche sans jamais pouvoir la relire. Les cinq cas
rouges de la phase 1 l'ont dit avant toute correction, tous sur la même ligne : le bouton
`Plus` n'existait pas.

**La cause, et ce qu'elle cachait.** `SECONDARY_NAV` est le seul propriétaire des salles
secondaires et le rail est `hidden md:flex` : sous 768 px, personne ne les rendait. Le défaut
de nommage aggravait le silence — **La Planche** (composer) est une salle principale,
**Les Planches** (relire) une salle secondaire, et rien ne signalait que la seconde existât.

**Ce que la revue a trouvé : une asymétrie de visibilité.** `sidebar.tsx` enveloppe **tout**
son bloc de navigation — principal et secondaire — dans `{user ? … : « Le cabinet ouvre ses
tiroirs… »}`, alors que la barre basse se rend sans condition. Le cinquième contrôle est donc
monté derrière `useSession()` : rendre la feuille à un visiteur anonyme aurait exposé trois
salles que le rail lui cache. La parité est verrouillée par un cas anonyme.

**Pourquoi un cinquième onglet plutôt que le menu de compte.** L'en-tête mobile ne porte
aucune affordance de compte — seulement la bourse et `Entrer` (`app-shell.tsx:16-47`) : un
menu serait à inventer, et sortir d'une barre de navigation est plus découvrable que de
cacher trois salles derrière un contrôle de compte. Quatre salles restent dans la zone du
pouce ; le cinquième contrôle ouvre, il ne navigue pas, donc c'est un `button` et non un
`Link` — sans `aria-current`, qui désignerait à tort une destination.

**Pourquoi la feuille recouvre la barre au lieu de s'empiler dessus.** S'empiler coudrait le
`bottom` de la feuille à la hauteur mesurée de la barre, que `min-h-[56px]` rend variable
alors que `DESIGN_SYSTEM.md` §9.2 la déclare à 64 px. Recouvrir réutilise la géométrie
éprouvée de `CardDrawer` (`rounded-t-panel`, `max-h-[76vh]`, `shadow-lifted`) sans aucune
constante partagée. La feuille passe par `OverlayPortal`, comme les deux overlays de route :
un `transform` résiduel sur un ancêtre ne peut plus la déplacer.

**`exact: true` sur le localisateur `Plus`.** `pwa-update-prompt.tsx` porte un bouton
« Plus tard » ; sans correspondance exacte, la comparaison par sous-chaîne de Playwright
aurait pu attraper l'un pour l'autre. Le nom accessible du contrôle est nu.

**Un cas vert par construction.** Le cas anonyme vérifie l'absence du cinquième contrôle —
que le code n'a jamais monté. Il garde la règle, il ne prouve aucune régression corrigée :
il n'a pas d'observation rouge derrière lui, contrairement aux quatre autres.

**La leçon de banc.** `docker-compose.e2e.yml` joue une image `target: prod`, donc le banc
sert `apps/web/dist` figé au dernier build. La première exécution verte après l'implémentation
a échoué pour cette seule raison : le serveur rendait encore l'ancien bundle. Reconstruire
l'image du banc après **tout** changement dans `apps/web` fait partie de la commande, pas des
précautions.

**Vérification (Docker uniquement)**
```
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test tests/mobile.spec.ts --project="Pixel 7"
  phase 1, rouge : 4 failed, 1 skipped, 10 passed (2.2m)
  échec commun : element(s) not found sur getByRole('button', { name: 'Plus', exact: true })

docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test tests/mobile.spec.ts
  2 skipped
  28 passed (1.2m)

docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test tests/design-system.spec.ts
  1 skipped
  11 passed (33.1s)

docker compose --profile tools run --rm dev bun run lint
  Checked 164 files in 105ms. No fixes applied.

docker compose --profile tools run --rm dev bun run ci:check
  [hexamap] ✓ 1/4 Lint   ✓ 2/4 Typecheck   ✓ 3/4 Base de données   ✓ 4/4 Spécifications
  158 pass, 0 fail, 794 expect() calls, Ran 158 tests across 11 files

docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  52 tests, 49 passed, 3 skipped (1.5m)
  chromium  14 passed, 1 skipped (core-loop 3, design-system 12)
  pwa        7 passed
  Pixel 7   14 passed, 1 skipped (mobile 15 cas)
  iPhone 13 14 passed, 1 skipped (mobile 15 cas)
```

**Le compte d'`expect()` n'est pas un invariant.** Le même arbre, `packages/spec` intact, a
affiché **804** puis **794** `expect()` à quelques minutes d'intervalle, pour 158 tests et
11 fichiers dans les deux cas. Les assertions sont comptées à l'exécution : celles qui vivent
dans une boucle sur les lignes du référentiel dépendent des données tirées. L'entrée de la
phase 20 annonçait 792 ; ce n'est pas une régression, c'est la même mesure instable, prise un
autre jour. Les chiffres stables sont **158 spécifications** et **11 fichiers** — ce sont eux
qui doivent être cités, le compte d'assertions seulement comme observation datée.

**Deux écarts connus, non traités ici.** `DESIGN_SYSTEM.md` §9.1 rend `/import-status`
conditionnelle (« si l'utilisateur y a droit ») alors que ni le rail ni la feuille ne portent
ce contrôle de droit : la feuille garde la parité avec le rail, l'écart est consigné au
registre. Et le cas anonyme reste une garde, pas une preuve (voir plus haut).

**Portée** : aucune migration, aucun changement de schéma ni de contrat d'API, aucune
dépendance nouvelle, `packages/spec` intact. Aucun commit.

---
---

# Historique — Phase 20 — Les Overlays ancrés (BUG-007)

## Statut

- **Phase** : 20 — Les Overlays ancrés (BUG-007)
- **État** : Terminé
- **Priorité** : P1
- **Mis à jour** : 2026-11-19
- **Branche** : `fix/bug-007-overlays-viewport`

---

## Objectif

Le défaut n'appartenait à aucun composant : il tenait à un ancêtre de mise en page. `<main>`
portait `.enter-salon` en `animation-fill-mode: both`, donc conservait
`transform: translateY(0)` après l'entrée en salle — et un `transform`, même nul, fait de
`<main>` le bloc conteneur de **tout** descendant `position: fixed`. Le tiroir de La Planche
s'ouvrait au bas de la page et non au bas de l'écran, et la modale de Pépite se dimensionnait
sur le document. La phase corrige la cause (`.enter-salon` en `backwards`) et rend les deux
overlays structurellement insensibles à toute récidive (`OverlayPortal`), à domaine et contrats
d'API constants.

---

## Étapes

### 1. Spec-first — trois cas rouges
- [x] `mobile.spec.ts` : « le tiroir de sélection reste dans la fenêtre après défilement »,
      joué sur les deux projets tactiles ; rouge à `-27.25` px.
- [x] `design-system.spec.ts` : « main ne conserve aucun transform après l'entrée en salle »,
      rouge sur `matrix(1, 0, 0, 1, 0, 0)` au lieu de `none`.
- [x] `design-system.spec.ts` : « le tiroir est rendu hors de main et dégage le rail », rouge
      sur `inMain === true`.

### 2. Correction d'un mot
- [x] `styles.css:286` : `both` → `backwards`. Les keyframes `enter-salon` et le bloc
      `prefers-reduced-motion` sont inchangés.

### 3. Portail des overlays
- [x] `components/ui/overlay-portal.tsx` : `createPortal(children, document.body)`.
- [x] `routes/tableau.tsx` (tiroir) et `routes/tickets.$ticketId.tsx` (modale de Pépite) :
      seule la racine retournée est enveloppée, aucun changement d'`aria-*`, de focus, d'état
      ni de classe.
- [x] Décalage de bureau : `md:left-[232px]` dégage désormais le rail (232 px) au lieu de
      s'ajouter au `md:pl-[232px]` de `<main>` (≈ 464 px).

### 4. Banc et vérification
- [x] `mobile.spec.ts` + `design-system.spec.ts` : 29 passed, 3 skipped.
- [x] Banc complet : **39 passed, 3 skipped** (chromium 14 / 1, pwa 7, Pixel 7 9 / 1,
      iPhone 13 9 / 1).
- [x] `bun run ci:check` : lint, typecheck, ping PostgreSQL, 158 spécifications, 792
      `expect()` — vert.

---

## Critères d'acceptation

1. [x] Après défilement, la boîte du tiroir reste dans la fenêtre (`box.y >= 0`).
2. [x] `getComputedStyle(main).transform === 'none'` après l'entrée en salle.
3. [x] Le tiroir est rendu hors de `<main>` et dégage le rail de 232 px ; la modale de Pépite
       emprunte le même portail.
4. [x] Banc complet : 39 passed, 3 skipped (chromium 12 → 14, Pixel 7 8 → 9,
       iPhone 13 8 → 9, pwa 7 inchangé).
5. [x] `ci:check` vert : 158 spécifications, 792 `expect()`.
6. [x] Aucune migration, aucun changement de schéma ni de contrat d'API, aucune dépendance
       nouvelle.

---

## Journal

### 2026-11-19 — Phase 20 exécutée : Les Overlays ancrés livrés

**Le constat.** À 390 px, ouvrir un emplacement vide de La Planche après avoir fait défiler la
page plaçait le tiroir à `-27.25` px du haut de la fenêtre : il s'ouvrait bien, mais sous la
ligne de flottaison. Le cas E2E l'a dit avant toute correction, sur les deux projets tactiles.

**La cause.** `styles.css:286` : `animation: enter-salon 180ms var(--ease-cabinet) both`.
`fill-mode: both` conserve la dernière image clé, donc `<main>` gardait
`transform: translateY(0)` indéfiniment et devenait le bloc conteneur des descendants
`position: fixed`. Les keyframes se terminant déjà sur l'état naturel, remplacer `both` par
`backwards` ne change **rien à l'image** : l'animation est identique, le `transform` disparaît
seulement à la fin. Un mot, et `main` cesse d'être un bloc conteneur.

**Ce que la fiche de bug disait de travers.** L'entrée affirmait que le défaut disparaissait
sous `prefers-reduced-motion: reduce`, grâce à un `transform: none` forcé. C'est faux :
`styles.css:351-363` ne raccourcit que `animation-duration` à 1 ms pour `.enter-salon`, et le
`transform: none` de `:361` ne vise que `.exhibit` / `.exhibit:hover`. Une animation de 1 ms
remplit encore sa dernière image clé : le défaut était **permanent à tous les réglages de
mouvement**, jamais intermittent. Le registre a été corrigé, pas seulement complété.

**Le portail, pour la classe de bug et pas seulement pour l'occurrence.** `OverlayPortal`
(`createPortal(children, document.body)`) enveloppe la racine retournée des deux overlays de
route. Rien d'autre n'a bougé : ni `aria-modal`, ni la gestion d'`Escape`, ni le clic sur le
fond, ni le retour de focus. Le tiroir et la modale ne dépendent plus de la forme de l'arbre.

**Un défaut collatéral révélé par le portail.** `md:left-[232px]` du tiroir s'ajoutait au
`md:pl-[232px]` de `<main>` : ≈ 464 px de décalage sur bureau, invisible tant que le tiroir
était ancré sur `main`. Rendu dans `document.body`, il dégage correctement le rail de 232 px.

**Leçon de fixture.** `count()` n'attend pas : compter les boutons avant que la requête de
collection n'ait répondu faisait échouer l'ouverture du tiroir pour une raison sans rapport.
Les deux specs passent par un unique localisateur patient —
`getByRole('button', { name: /Emplacement libre/ }).or(getByRole('button', { name: 'Modifier' })).first()`.

**Ce qui n'a pas été touché.** `.enter-plate` conserve `both` : c'est un ornement de feuille,
jamais ancêtre d'un élément `fixed`. Le rail, la barre d'onglets et l'invitation de mise à jour
sont frères de `<main>` et n'ont jamais été concernés. BUG-004 reste corrigé : sa modale
retrouve sa géométrie de fenêtre par la même cause racine, ses sorties sont intactes.

**Vérification (Docker uniquement)**
```
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test tests/mobile.spec.ts tests/design-system.spec.ts
  29 passed, 3 skipped
banc complet (chromium, pwa, Pixel 7, iPhone 13)
  39 passed, 3 skipped
docker compose --profile tools run --rm dev bun run ci:check
  1/4 Lint  2/4 Typecheck  3/4 Base de données  4/4 Spécifications — 158 specs, 792 expect()
```

**Portée** : aucune migration, aucun changement de schéma ni de contrat d'API, aucune
dépendance nouvelle, aucun changement dans `packages/spec`. Aucun commit.

---
---

# Historique — Phase 19 — L'Installation vérifiée (suite PWA de bout en bout)

## Statut

- **Phase** : 19 — L'Installation vérifiée (suite PWA de bout en bout)
- **État** : Terminé
- **Priorité** : P1
- **Mis à jour** : 2026-11-19
- **Branche** : `feat/pwa-e2e-suite`

---

## Objectif

La couche PWA livrée en phase 17 n'avait aucune preuve : le manifeste, le service worker, le
précache et l'invalidation des appels d'API n'étaient vérifiés qu'à la main. Le banc e2e servait
`http://hexamap.test:3000`, donc une origine non sécurisée où `navigator.serviceWorker` n'existe
pas et où le worker ne peut pas s'enregistrer : aucune suite n'était possiblement probante. La
phase déplace la bordure du banc derrière Caddy en HTTPS avec une AC interne et ajoute 7 cas
d'installation et de comportement hors ligne, à domaine et contrats d'API constants.

---

## Étapes

### 1. Bordure TLS et contexte sécurisé
- [x] `scripts/e2e/Caddyfile` : `tls internal`, `reverse_proxy api:3000`, `encode` laissé
      désactivé pour que la compression mesurée reste celle de l'API.
- [x] `docker-compose.e2e.yml` : service `proxy` sur le réseau du banc (aucun port publié), l'alias
      `hexamap.test` déplacé de `api` vers `proxy` — deux adresses DNS pour la même origine
      envoyaient des requêtes HTTP nues sur une origine `https`.
- [x] `AUTH_COOKIE_SECURE: "true"` : plus aucune dérogation, les cookies `Secure` sont réellement
      exercés.

### 2. Configuration Playwright
- [x] `packages/e2e/playwright.config.ts` : `ignoreHTTPSErrors: true` global ; `global-setup.ts`,
      qui construit son contexte à la main, le répète explicitement.
- [x] `testIgnore` en tableau, pour que `chromium` continue de ne jouer que les parcours de bureau.
- [x] Projet `pwa` : `serviceWorkers: 'allow'` et `launchOptions.args:
      ['--ignore-certificate-errors']`.
- [x] `baseURL`, `E2E_BASE_URL`, `FRONTEND_URL`, `APP_URL` et `BETTER_AUTH_URL` passent en
      `https://hexamap.test`.

### 3. Suite `pwa.spec.ts`
- [x] 7 cas : manifeste conforme ; le worker s'installe et contrôle ; la coquille est précachée ;
      les appels d'API ne viennent jamais du cache ; un lien profond hors ligne retombe sur la
      coquille ; aucun appel d'API dans une cache ; les marges de zone sûre sont appliquées.

### 4. Revalidation des suites existantes
- [x] Les trois suites (`core-loop`, `mobile`, `design-system`) rejouées sur la nouvelle origine,
      sans régression.

---

## Critères d'acceptation

1. [x] `tests/pwa.spec.ts` : 7/7 verts.
2. [x] Banc complet : 35 passed, 3 skipped (chromium 12/1, pwa 7, Pixel 7 8/1, iPhone 13 8/1).
3. [x] `ci:check` vert : lint, typecheck, ping PostgreSQL, 158 spécifications.
4. [x] Aucune migration, aucun changement de schéma ni de contrat d'API.
5. [x] `packages/spec`, `packages/db` et `packages/shared` intacts.

---

## Journal

### 2026-11-19 — Phase 19 exécutée : L'Installation vérifiée livrée

**Le constat bloquant.** Une suite PWA était impossible sur le banc tel qu'il était : `http://`
n'est pas un contexte sécurisé, donc `navigator.serviceWorker` n'est même pas exposé et
`navigator.serviceWorker.register()` n'a rien à enregistrer. Le banc a donc reçu une bordure
Caddy en `https://hexamap.test` avec une AC interne. Le premier effet collatéral a été l'alias :
posé sur `api`, il produisait deux adresses DNS pour la même origine et des requêtes HTTP nues
sur une origine `https`. Il appartient désormais au `proxy`.

**`ignoreHTTPSErrors` ne suffit pas pour le worker.** L'option de Playwright passe par CDP et
couvre les requêtes du document, des ressources et des `fetch`. Le téléchargement du **script**
du worker emprunte la pile réseau de Chrome et n'y passe pas : l'enregistrement échouait en
`SecurityError: An SSL certificate error occurred when fetching the script`. Le seul projet `pwa`
ajoute donc `launchOptions.args: ['--ignore-certificate-errors']`. La conséquence est localisée
au projet qui en a besoin, pas répandue sur tout le banc.

**Le rechargement est obligatoire.** `clientsClaim: false` est un choix assumé de la phase 17 :
le worker ne prend pas le contrôle du document qui l'a enregistré. Le premier chargement a donc
`controller === null`, et le cas 2 le constate explicitement avant de recharger. Sans ce
rechargement, tous les cas hors ligne seraient verts pour la mauvaise raison — ils testeraient
le réseau, pas la cache.

**Les cookies `Secure` n'ont posé aucun problème.** `AUTH_COOKIE_SECURE=true` remplace la
dérogation `false` du banc HTTP : l'inscription, la session et le parcours critique passent sans
changement, puisque l'origine est désormais `https`.

**Écart de motif `NetworkOnly`.** Le worker généré est minifié : la classe Workbox y est aliasée
et l'appel sans argument perd ses parenthèses, d'où `registerRoute(/\/api\//,new s.NetworkOnly,"GET")`.
Le motif du cas 4 tolère donc le préfixe du module et la liste d'arguments vide, et le couplage à
la sortie de Workbox reste localisé à ce fichier.

**Boucle redondante retirée.** Le cas 6 itérait une seconde fois les caches pour ne regarder que
celles des blasons, alors que la première boucle les couvre déjà. La boucle unique reste, avec le
commentaire sur la StaleWhileRevalidate des blasons.

**Vérification (Docker uniquement)**
```
docker compose --profile tools run --rm dev bun run lint
  162 fichiers, aucune correction
docker compose --profile tools run --rm dev bun run typecheck
  6 workspaces, propre
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test tests/pwa.spec.ts
  7 passed (29.8s)
banc complet
  35 passed, 3 skipped (1.2m)
```

**Portée** : aucune migration, aucun changement de schéma ni de contrat d'API, aucun changement
dans `packages/spec`, `packages/db` ou `packages/shared`. Aucun commit.

---
---

# Historique — Phase 18 — L'Économie des octets (compression de production)

## Statut

- **Phase** : 18 — L'Économie des octets (compression de production)
- **État** : Terminé
- **Priorité** : P1
- **Mis à jour** : 2026-11-19
- **Branche** : `feat/compression-production`

---

## Objectif

La production n'a plus de Nginx : plus rien ne comprimait le bundle du SPA ni le JSON de l'API.
Le risque « Removing nginx loses gzip/brotli » était **réalisé**, pas théorique, et le bundle
de 255 Kio partait tel quel. L'API porte désormais gzip et brotli elle-même, dans son propre
processus, à domaine métier et contrat d'API constants : aucune migration, aucun changement de
schéma, aucune dépendance déclarée (`node:zlib` et `Bun.gzipSync` sont des builtins).

---

## Étapes

### 1. Spec-first
- [x] `packages/spec/src/compression.spec.ts` : 14 cas `Archi §6.1 — `, écrits **rouges** avant
      toute implémentation — 7 en échec, 5 verts.
- [x] Fixtures versionnées dans `packages/spec/fixtures/web-dist/assets/` : `big-fixture.js`
      (au-dessus du seuil), `small-fixture.js` (en dessous), `image-fixture.png` (type non
      compressible).

### 2. Politique pure
- [x] `apps/api/src/lib/compression.ts` : `COMPRESSION_MIN_BYTES = 1024`, `negotiateEncoding`
      (q-values lues, `br` prioritaire à qualité égale, `q=0` exclut, `identity` neutre, bornes
      `[0, 1]`), `isCompressibleType`, `compressBytes`, `appendVary`. Aucun état, aucune
      entrée-sortie.

### 3. Cache borné
- [x] `apps/api/src/lib/compression-cache.ts` : 64 entrées, éviction FIFO, clé
      `${chemin absolu}\0${taille}\0${mtime}\0${encodage}` ; la lecture du fichier se fait dans
      la fermeture de calcul, donc un succès de cache ne touche pas le disque.

### 4. Assets statiques
- [x] `static.ts` et `routes/blasons.ts` compressent eux-mêmes, avec le cache indexé sur le
      `mtime`.
- [x] `routes/blasons.ts` devient une **fabrique** (`blasonRoutes(root)`), pour que le banc
      puisse injecter une racine de fixtures.

### 5. Hook JSON
- [x] `apps/api/src/lib/compression-plugin.ts` : `onAfterHandle` `as: 'global'`, monté dans
      `createApp` avant les modules de routes. `HEAD` court-circuité avant la négociation, pas
      de double encodage, en-têtes reconstruits par `append` pour qu'un `Set-Cookie` répété
      survive.

### 6. ETag faible
- [x] `W/"<taille>-<mtime>"` : un validateur faible désigne des représentations sémantiquement
      équivalentes, ce qui est exactement le rapport gzip / identité. Aucun `304` ne porte de
      `Content-Encoding`.

### 7. Corrections de revue
- [x] F1 à F8 traitées (voir journal).

### 8. Vérification en production
- [x] Images et en-têtes mesurés sur l'image de production, pas sur le banc de développement.

---

## Critères d'acceptation

1. [x] Bundle principal : `255 461` → `80 243` octets en gzip (−68,6 %) et `75 518` en brotli
       (−70,4 %) ; `index.html` `1 527` → `652`.
2. [x] `Accept-Encoding` négocié par q-values, `br` prioritaire, `gzip` en repli, `q=0` et
       `identity` sans compression.
3. [x] Aucune compression sous `COMPRESSION_MIN_BYTES = 1024` : le `null` de 4 octets de
       `/api/auth/get-session` part verbatim.
4. [x] Jamais `png`, `webp`, `woff2`, `woff` ni `ico` recompressés.
5. [x] `Vary: Accept-Encoding` sur les deux variantes, `Origin` réajouté sur les statiques
       compressées, aucun `Vary` écrasé.
6. [x] `HEAD` sans corps et sans encodage ; `304` sans corps ni `Content-Encoding`.
7. [x] Le hook tourne aussi sur les handlers Better Auth montés et répond `Vary: Origin`.
8. [x] `packages/spec/src/compression.spec.ts` : 14 cas verts ; `ci:check` vert à 158 specs.
9. [x] Aucune migration, aucun changement de schéma ni de contrat d'API, aucune dépendance
       nouvelle.

---

## Journal

### 2026-11-19 — Phase 18 exécutée : L'Économie des octets livrée

**Spec d'abord.** `compression.spec.ts` a été écrit avant l'implémentation et lancé rouge :
7 cas en échec, 5 verts. Le `Vary` a été volontairement laissé hors de la phase 0 pour que le
jeu rouge reste signifiant — sans lui, des cas auraient pu passer pour de mauvaises raisons.

**Ce que le banc ne pouvait pas voir.** La passe sur l'image de production a trouvé un écart
que les specs ne testaient pas : les assets compressés répondaient `Vary: accept-encoding`
alors que la variante identité répondait `Vary: Origin, accept-encoding`. `cors` pose
`Vary: Origin` dans son propre `onAfterHandle`, qui n'atteint jamais la `Response` fabriquée
dans le handler de route. La dimension `Origin` est donc réajoutée explicitement sur les
réponses statiques compressées ; sans elle, un cache partagé pouvait servir l'en-tête CORS
d'une origine à une autre.

**Ce que la revue a trouvé.** Le hook JSON tamponnait le corps d'une `Response` puis retournait
`undefined` quand la charge restait sous le seuil : Elysia réémettait un flux consommé et
`/api/auth/get-session` répondait `500 TypeError: Body object should not be disturbed or
locked` sous n'importe quel `Accept-Encoding` de navigateur. Le défaut n'a été vu que parce
que la vérification de l'authentification était **imposée** : la suite de specs n'envoie aucun
`Accept-Encoding` sur cette route. Le hook rend désormais les octets tamponnés dans une
`Response` neuve même lorsqu'il renonce à compresser.

**ETag.** Rendu faible plutôt que dupliqué par codage : le cas 7 garde son assertion unique et
le validateur reste correct au sens de la RFC 9110.

**`Bun.gzipSync`.** La fonction exige un tableau adossé à un `ArrayBuffer` :
`Uint8Array<ArrayBufferLike>` est refusé. Résolu par le typage (`Uint8Array<ArrayBuffer>`) et
une copie, jamais par un cast.

**Blasons.** Ils n'avaient **aucune** couverture de chemin nominal avant cette phase :
`blasonRoutes` est devenue une fabrique pour injecter la racine de fixtures.

**Correction documentaire.** `.docs/01-architecture.md` §4.7 annonçait un cache immuable sur
`/blasons` (`max-age=2592000, immutable`) que le code n'a jamais servi : il répond
`public, max-age=3600, must-revalidate`. Le document a été corrigé, pas le code.

**Vérification (Docker uniquement)**
```
docker compose --profile tools run --rm dev bun run ci:check
  1/4 Lint  2/4 Typecheck  3/4 Base de données  4/4 Spécifications — 158 specs
curl -s -o /dev/null -D - -H 'Accept-Encoding: gzip' :8080/assets/<hash>.js
  → content-encoding: gzip, content-length: 80243, vary: origin, accept-encoding
curl -s -o /dev/null -D -                            :8080/assets/<hash>.js
  → aucun content-encoding, content-length: 255461
curl -s --compressed :8080/assets/<hash>.js | cmp - <(curl -s :8080/assets/<hash>.js)
  → identique
```

La vérification se fait **en `GET`, jamais en `HEAD`** : une réponse `HEAD` n'a pas de corps, donc
jamais de `Content-Encoding` — `curl -sI` validerait un en-tête qu'il ne peut pas produire.

**Portée** : aucune migration, aucun changement de schéma ni de contrat d'API, aucune
dépendance nouvelle, aucun commit.

---
---

# Historique — Phase 17 — L'Installation (application installable)

## Statut

- **Phase** : 17 — L'Installation
- **État** : Terminé
- **Priorité** : P1
- **Mis à jour** : 2026-11-19
- **Branche** : `feat/phase-17-installation`

---

## Objectif

Rendre le cabinet installable : Chrome refusait l'installation faute de manifeste, d'icônes et
de service worker. Domaine, API et base inchangés ; seule la couche web est concernée.

## Étapes

### 1. Dépendances et service worker
- [x] `vite-plugin-pwa@2.0.0` + pairs déclarés (`workbox-build@7.4.1`, `workbox-window@7.4.1`,
      `@vite-pwa/assets-generator@2.0.0`), installés dans Docker.
- [x] `vite.config.ts` : `VitePWA` en `generateSW`, `registerType: 'prompt'`, `injectRegister: false`,
      `manifest: false`, `filename: 'sw.js'`.
- [x] `runtimeCaching` : **une entrée `NetworkOnly` par méthode HTTP** (`GET`, `POST`, `PUT`,
      `PATCH`, `DELETE`) sur `/api/`. Une entrée Workbox ne couvre qu'une méthode : sans cela,
      les mutations Eden (POST) n'auraient aucune route explicite.
- [x] `/blasons/` en `StaleWhileRevalidate` (`maxEntries: 200`, 30 jours).
- [x] `globPatterns` inclut `html` : `navigateFallback: '/index.html'` exige que la page soit
      précachée, sinon Workbox lève `non-precached-url` à l'installation.

### 2. Manifeste et icônes
- [x] `public/manifest.webmanifest` statique : `standalone`, `portrait`, `#0c1210` en fond et en
      thème, icônes 64/192/512 + maskable 512 + favicon SVG `sizes: any`.
- [x] `pwa-assets.config.ts` + `bunx pwa-assets-generator` : `minimal2023Preset` dérivé du
      favicon hexagonal, sortie dans `public/icons/` (le générateur écrit à côté de la source et
      n'a pas de dossier de sortie : `assetName` préfixe `icons/`). PNG versionnés.
- [x] `index.html` : manifeste, `apple-touch-icon` 180, trois `apple-mobile-web-app-*`, favicon ICO.

### 3. Enregistrement et invitation
- [x] `src/lib/pwa.ts` : magasin minimal autour de `registerSW`, `registerPwa()` renvoie la
      fonction de mise à jour.
- [x] `components/layout/pwa-update-prompt.tsx` : `role="status"`, « Nouvelle version
      disponible », *Recharger* / *Plus tard*, au-dessus de la barre d'onglets
      (`bottom-20 md:bottom-6`) avec `env(safe-area-inset-bottom)`.
- [x] Monté dans `app-shell.tsx` ; `registerPwa()` appelé dans `main.tsx` après le rendu ;
      `vite-plugin-pwa/client` référencé dans `vite-env.d.ts`.

### 4. Hygiène
- [x] `biome.json` exclut `apps/web/dev-dist`, `**/sw.js`, `**/workbox-*.js`.
- [x] `.gitignore` : `apps/web/dev-dist`.

## Critères d'acceptation

1. [x] `dist/manifest.webmanifest`, `dist/sw.js`, `dist/workbox-*.js` produits par le build.
2. [x] Le manifeste déclare `standalone` et les icônes 192/512/maskable.
3. [x] `index.html` lie le manifeste et `apple-touch-icon`.
4. [x] Cinq routes `NetworkOnly` (une par méthode) et deux motifs dans `navigateFallbackDenylist`.
5. [x] Aucun cache des mutations `/api/`, aucun `skipWaiting`/`clientsClaim` : la mise à jour est
       proposée, jamais imposée.

## Journal

### 2026-11-19 — Phase 17 exécutée : L'Installation livrée

**Déviation assumée (vérifiée dans le service worker généré)**
- La consigne initiale excluait `**/index.html` du précache tout en gardant
  `navigateFallback: '/index.html'`. Le build passe, mais `dist/sw.js` contient alors
  `createHandlerBoundToURL("/index.html")` **sans** entrée de précache correspondante : Workbox
  lève `non-precached-url` à l'installation et le worker ne s'active jamais. `globPatterns`
  inclut donc `html` et l'exclusion a disparu — 46 entrées de précache, dont `index.html`.

**Vérification (Docker)**
```
docker compose --profile tools run --rm dev bun run --cwd apps/web typecheck
  tsr generate && tsc --noEmit   (aucune erreur)
docker compose --profile tools run --rm dev bun run --cwd apps/web build
  ✓ built in 969ms
  PWA v2.0.0  mode generateSW  precache 46 entries (1221.47 KiB)
  files generated  dist/sw.js  dist/workbox-433ac1a8.js
docker compose --profile tools run --rm dev bunx biome check apps/web biome.json
  Checked 64 files in 48ms. No fixes applied.
```

**Portée** : aucune migration, aucun changement de contrat d'API, aucune dépendance à l'exécution
(les quatre paquets sont des devDependencies). Aucun commit.

---
---

# Historique — Phase 16 — Le Geste (ergonomie tactile et moteur de grattage)

## Statut

- **Phase** : 16 — Le Geste (ergonomie tactile et moteur de grattage)
- **État** : Terminé
- **Priorité** : P1
- **Mis à jour** : 2026-11-19
- **Branche** : `feat/phase-16-le-geste`

---

## Objectif

Rendre le grattage fiable au doigt et solder les restes de la phase mobile du `ROADMAP.md`
(§Phase 14), à domaine et contrats d'API constants. La coquille, la navigation basse,
`viewport-fit=cover`, le Cadastre virtualisé et les grilles du Comptoir ayant été livrés par
les phases 14 et 15, la phase porte sur le **moteur de grattage** : un seul dessin par image,
un rayon dérivé de la case, un redimensionnement non destructif, et la preuve E2E sur deux
appareils.

## Ce que le ROADMAP demandait et qui était déjà livré

| Demande (`ROADMAP.md` §14.3) | Constat avant la phase |
| :--- | :--- |
| `AppShell`, rail `md:`, barre d'onglets, `CurrencyPill` | Livré en phase 14 (`layout/app-shell.tsx`, `sidebar.tsx`, `bottom-tab-bar.tsx`) |
| `viewport-fit=cover` dans `index.html` | Déjà présent |
| Cadastre mobile condensé (colonnes masquées, rail de filtres, virtualisation) | Livré (`collection.tsx`, `useWindowVirtualizer`, cellules `hidden md:block`) |
| Grilles du Comptoir et de Mes Offres | Déjà `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` |
| Tableau en 2×2 sur mobile | Sans objet : les emplacements sont une pile verticale, le tiroir est une feuille basse pleine largeur |
| Garde anti-double-appui du marché | Déjà côté serveur (`FOR UPDATE` + `409 LISTING_NOT_OPEN`, prouvé par `market.spec.ts`) ; seule l'attente visuelle manquait |

---

## Étapes

### 1. Spec-first — géométrie du pinceau
- [x] `packages/shared/src/ui.ts` : `SCRATCH_REVEAL_THRESHOLD = 0.4` et
      `scratchBrushRadius(w, h)` = `clamp(18, 40, round(min(w, h) × 0,18))`, exportés par le baril.
- [x] `packages/spec/src/ui.spec.ts` : trois cas `Archi §4.6 — `.

### 2. Moteur de grattage
- [x] `components/scratch-cell.tsx` : import des deux constantes partagées, suppression de
      `BRUSH_SIZE` et `REVEAL_THRESHOLD` locaux.
- [x] Rayon recalculé dans `paint()` depuis le rectangle de la case ; `lineWidth = rayon × 2`,
      arc de rayon `rayon` (l'ancienne constante était un diamètre).
- [x] Un seul `requestAnimationFrame` en vol ; `flush()` trace `dernier point → point courant`,
      incrémente le compteur et teste la couverture tous les 6 coups.
- [x] `stopDrawing` vide le trait en attente **avant** `checkCoverage()` ; la frame est annulée au démontage.
- [x] `ResizeObserver` non destructif : copie du tampon, repeinture, réapplication sous
      transformation identité quand des coups ont déjà été portés.
- [x] `select-none cursor-crosshair` sur le canvas, `select-none` sur le bouton.

### 3. Ergonomie restante
- [x] `layout/sidebar.tsx` : `pt-[env(safe-area-inset-top)]` sur le bloc de marque.
- [x] `content/market.ts` + `routes/market.index.tsx` : libellé « Achat… » sur la seule ligne
      en vol, `touch-manipulation`. Aucune garde client ajoutée.

### 4. E2E mobile
- [x] `packages/e2e/playwright.config.ts` : projets `chromium` (`testIgnore`), `Pixel 7` et
      `iPhone 13` (`testMatch`), pour que les suites existantes ne tournent qu'une fois.
- [x] `packages/e2e/tests/mobile.spec.ts` : 9 cas (navigation, débordement à 412 et 320 px,
      cibles ≥ 44 px, grattage tactile, absence de défilement, registre condensé, double-appui).

### 5. Mémoire
- [x] `.docs/01-architecture.md` §4.6 : dessin par image, rayon dérivé, redimensionnement non destructif.
- [x] `ROADMAP.md` : statut d'exécution de la phase 14.
- [x] Cette entrée.

---

## Critères d'acceptation

1. [x] `scratch-cell.tsx` contient **0** `useState`, **0** handler `onMouse*`/`onTouch*`, et un
       `requestAnimationFrame` avec son `cancelAnimationFrame` de nettoyage.
2. [x] Le rayon du pinceau suit la taille de la case (18 px à 76 px, 25 px à 140 px, borné 18–40)
       et le seuil reste à 40 %.
3. [x] Une rotation en cours de grattage conserve la zone déjà effacée.
4. [x] Aucun débordement horizontal à 412 px et 320 px sur Le Relevé, Le Cadastre, Le Comptoir
       et La Planche.
5. [x] Les cibles de la barre d'onglets mesurent au moins 44 px.
6. [x] Aucune dépendance nouvelle, aucune migration, aucun changement de contrat d'API.
7. [x] `ci:check` vert : lint, typecheck, ping PostgreSQL, 143 spécifications.

---

## Journal

### 2026-11-19 — Phase 16 exécutée : Le Geste livré

**Spec-first**
- `packages/shared/src/ui.ts` : la géométrie du pinceau quitte le composant. `ui.spec.ts`
  verrouille le seuil à 0,4, la croissance avec la case (76 → 18, 140 → 25) et les bornes
  (10 → 18, 400 → 40).

**Moteur**
- L'ancienne `BRUSH_SIZE = 26` était un **diamètre** (13 px de rayon) ; la fonction partagée
  rend un **rayon**, d'où `lineWidth = rayon × 2` et un arc de rayon `rayon`. Sur une case
  mobile de ~78 px, le pinceau passe de 13 à 18 px de rayon : le geste est plus facile qu'avant,
  pas plus exigeant.
- `flush()` trace `dernier point → point courant` : la fusion des échantillons ne crée aucun trou,
  puisque le segment couvre tout le trajet. `stopDrawing` vide la frame en attente avant de
  tester la couverture, ce qui interdit le blocage à 39 %.
- Le redimensionnement réapplique la copie sous `setTransform(1,0,0,1,0,0)` : sans cela la
  transformation DPR posée par `paint()` aurait décalé et agrandi l'image restaurée.

**Vérification (Docker uniquement)**
```
docker compose --profile tools run --rm dev bun run ci:check
  [hexamap] ✓ 1/4 Lint   ✓ 2/4 Typecheck   ✓ 3/4 Base de données   ✓ 4/4 Spécifications
  143 pass, 0 fail, 751 expect() calls, 10 fichiers
```
Les deux échecs historiques `Plan §5.6 — un référentiel totalement vide reste une erreur explicite`
passent désormais ; ils n'avaient pas la cause supposée (timeout) et sont tombés avec le reste
de la suite sur une base saine.

Banc E2E (`docker-compose.e2e.yml`, image de production) :
```
chromium   12 passed, 1 skipped
Pixel 7     8 passed, 1 skipped
iPhone 13   8 passed, 1 skipped
découverte : 31 tests dans 3 fichiers (core-loop et design-system sous chromium seulement)
```
Le cas ignoré de `chromium` est la comparaison du multiplicateur, déjà ignorée en phase 14.

**Écarts assumés**
- **Marché à une colonne sous `sm`** : le ROADMAP demandait deux colonnes à 412 px. Avec une
  vignette de 132 px, deux colonnes écraseraient chaque fiche à ~185 px. La grille reste
  `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4`, et le test E2E verrouille
  l'absence de débordement plutôt qu'un nombre de colonnes.
- **Pas d'`overscroll-behavior` sur `body`** : la grille de grattage porte déjà `overscroll-none`.
  Une contention globale empêcherait le repli iOS mais gênerait la virtualisation de fenêtre du
  Cadastre et le défilement général.
- **Le grattage E2E se fait par appuis tactiles**, pas par un glissement synthétique :
  l'API `page.touchscreen` de Playwright n'expose que `tap`, et un glissement CDP fusionné donne
  une couverture instable (8 % à 39 %). Le glissement réel reste couvert par le test de
  non-défilement. Le geste continu est vérifié à la main sur appareil.
- **Le double-appui ne s'auto-vérifie pas encore** : `global-setup.ts` n'inscrit qu'un compte,
  donc aucune annonce d'un autre joueur n'existe sur le banc. Le test est écrit, intercepte la
  route avec 1,2 s de latence et s'ignore tant que la fixture croisée manque.
- **`collection.tsx` et les grilles du marché n'ont pas été retouchés** : déjà responsives.

**Portée**
- Aucune migration, aucun changement de schéma, aucun changement de contrat d'API.
- Aucune dépendance nouvelle.
- Aucun commit.

---
---

# Historique — Phase 15 — Le Cartel (fiche de planche)

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
