# 07 — Feuille de route v2

> **Source de vérité du plan de la v2.** Une phase qui contredit ce fichier commence par le
> corriger, comme pour `.docs/02-database.md`.
> Dernière mise à jour : 2026-11-22.
> Branche de base : **`v2`**. Chaque phase se livre sur une branche `feat/v2-…` fusionnée dans
> `v2`. Une release ne fusionne `v2` dans `main` que sur demande explicite, jamais
> automatiquement : la v1 est en production et ne doit pas bouger sans décision.

---

## 1. Décisions de cadrage

Quatre décisions ont été prises pour la v2, et six alternatives ont été écartées. Elles ne sont
pas des préférences d'implémentation : elles fixent le périmètre, donc l'ordre des phases.

| Sujet | Décision retenue | Alternatives écartées |
| :--- | :--- | :--- |
| **Carte** | Trois niveaux dès la v2.0 — régions → départements → communes —, en descente guidée, sans déplacement ni zoom libre | Zoom et déplacement libres ; niveau unique « France entière » ; rues sur la carte |
| **Notifications** | Cloche dans la coquille + une salle nommée **« Le Guichet »** | Panneau déroulant sans salle ; notifications poussées dès la v2.0 |
| **Notifications poussées** | v2.1, après le centre de notifications | Push immédiat dès la v2.0 ; aucune notification poussée |
| **Fonctionnalités retenues** | Le Troc, L'Atelier (fusion de doublons), filtres du Cadastre alimentés par la carte, Le Palmarès | Enchères, guildes, objectifs hebdomadaires, partage d'image et Open Graph, comparaison inter-joueurs |

**Pourquoi la carte est le chemin critique.** C'est la plus longue chaîne de phases de la v2 :
trois phases dépendantes (donnée, API, salle) qui ne peuvent pas être parallélisées, parce que
la salle n'a rien à afficher avant les chemins précalculés et que l'API n'a rien à rendre avant
la migration. Elle ne bloque aucune autre phase, mais elle porte l'objectif de rétention : une
collection que le joueur ne voit pas est une collection qu'il oublie. Les jalons sont donc
découpés autour d'elle.

---

## 2. État des lieux vérifié (2026-11-22)

Ce qui suit est vérifié dans le code, pas supposé.

- **Profil public déjà livré.** `apps/web/src/routes/players.$playerId.tsx` et
  `GET /api/v1/players/:id` (`apps/api/src/routes/players.ts`), adossés à `user_profiles`
  (`apps/api/src/services/profile.ts`). La réponse porte `pseudo`, `memberSince`, `bio`,
  `cardsOwned`, `completeness[]`, `bestTableau { score, multiplier, links }` (le score seulement,
  pas les cartes), `achievements[]`, `openListings`, `friendCount`, `friendState`.
- **Aucune page de compte privée.** Il n'existe ni route pour changer pseudo, courriel ou mot de
  passe, ni suppression de compte. `apps/api/src/routes/profile.ts` ne fait qu'un
  `upsert` de `bio` et `profile_public`. L'index `user_pseudo_lower_idx` existe, mais aucune
  validation de forme n'est appliquée au-delà de l'inscription.
- **Médailles.** 37 médailles pour **6 000 écus** au total (`packages/shared/src/achievements.ts`),
  attribuées par `apps/api/src/services/achievements.ts`, salle `apps/web/src/routes/achievements.tsx`.
- **Amis.** `apps/web/src/routes/friends.tsx` et `apps/api/src/routes/friends.ts`.
- **Aucun code de notification**, ni push, ni toast, nulle part dans `apps/`.
- **PWA en place.** `apps/web/vite.config.ts` : Workbox, cinq entrées `NetworkOnly` sur `/api/`
  (une par méthode), `/blasons/` en `StaleWhileRevalidate`, `registerType: 'prompt'`,
  `skipWaiting: false`, `clientsClaim: false`. `packages/e2e/tests/pwa.spec.ts` porte 7 cas.
- **Carte : un teaser seulement.** `apps/web/src/routes/assemblage.tsx` et
  `apps/web/src/lib/france-outline.ts` — un contour schématique, sans donnée joueur. `geom jsonb` et `contour_url` existent sur `ref_regions`, `ref_departements` et
  `ref_communes`.
- **Aucun `path_d` nulle part.** Aucun endpoint d'atlas. Le référentiel compte environ
  **34 900 communes**, **101 départements** et **18 régions**.
- **Bugs ouverts.** BUG-001, BUG-002 et BUG-003 restent ouverts dans `.docs/04-bugs.md`.
- **Bundle.** 478,09 Ko bruts / 145,61 Ko en gzip, avec l'avertissement de Vite.
- **Spécifications.** `packages/spec` : 343 cas verts sur 18 fichiers. Banc E2E : 68 cas.
- **Migrations.** `0013_shop` est la dernière appliquée ; aucune table n'est au statut
  **Contrat**.

**Un bloqueur explicite, et un constat levé.** Le bloqueur restant est le retrait des pages légales
(`LEGAL_PAGES_ENABLED = false` dans `apps/web/src/content/legal.ts`, boutique éteinte par
`SHOP_ENABLED = false`) : tant que la politique de confidentialité répond `404`, aucune phase ne
peut publier une suppression de compte. Le track A2 de `ROADMAP.md` est levé : le référentiel est
importé en production — déclaré par le titulaire le 2026-11-22 ; non revérifié depuis cette machine.
La nuance demeure, et elle n'est pas mineure : cette donnée vit dans les volumes `blasons` et dans
la base, **pas dans l'image**. Un volume neuf ou une restauration repart donc sans données et exige
un réimport ; la sauvegarde `scripts/backup.sh` (A5) couvre déjà ces volumes.

---

## 3. Les deux jalons

Le périmètre demandé couvre douze phases. Livré d'un bloc, il retarderait la carte — qui est le
chemin critique — derrière le troc et le palmarès, dont personne n'a besoin pour jouer. Il est
donc découpé en deux jalons, chacun utilisable seul.

| Jalon | Contenu | Ce qu'il apporte |
| :--- | :--- | :--- |
| **v2.0 — « La carte et le guichet »** | Phases **32, 33, 34, 35, 36, 37, 38, 39** | Le socle technique, la carte à trois niveaux, le Cadastre filtrable, les comptes, la vitrine enrichie et le centre de notifications |
| **v2.1 — « L'échange »** | Phases **40, 41, 42, 43** | Le Troc, L'Atelier, Le Palmarès et les notifications poussées |

Le Troc peut remonter en v2.0 si la carte et les comptes sortent tôt ; c'est la seule permutation
prévue. Aucune autre phase ne change de jalon sans une modification de ce fichier.

---

## 4. Les phases

### Phase 32 — Le Socle

**Objectif.** Ouvrir la branche `v2`, vérifier que la CI la couvre, alléger le bundle par
découpage de routes, solder les trois bugs ouverts et doter le banc d'un second compte. C'est la
phase qui rend toutes les suivantes mesurables : sans second compte, ni les amis, ni le troc, ni
les notifications ne peuvent être prouvés en navigateur.

**Étapes.**

- [ ] Créer `v2` depuis `main` ; le premier `push` part avec le premier commit de phase.
- [ ] Vérifier la couverture CI. État constaté le 2026-11-22 dans
      `.github/workflows/ci.yml` : déclencheur `push` limité à `branches: [main]`, et
      déclencheur `pull_request` **sans filtre de branche**. Une PR vers `v2` déclenche donc la
      CI ; un `push` direct sur `v2` ne la déclenche pas. Ajuster si le besoin apparaît, sans
      élargir le déclencheur `push`.
- [ ] Découpage par route : `autoCodeSplitting` de TanStack Router ou `lazyRouteComponent`,
      au choix de l'implémentation. Mesurer avant et après, référence **478,09 Ko bruts /
      145,61 Ko gzip**.
- [ ] Fermer BUG-001 (nettoyage des données de test fuitées : script de réparation et
      vérifications préalables), BUG-002 (intégrité `user_cards.ref_code`) et BUG-003 (garde sur
      `ref_regions.code`) ; BUG-002 et BUG-003 portent la même migration, `0014` (nom indicatif).
- [ ] Fixture E2E de second compte : elle débloque le cas de double-appui laissé en attente et
      sert de base aux cas amis, troc et notifications.
- [ ] Mettre à jour `.docs/03-active-task.md` et `ROADMAP.md` §1.

**Critères d'acceptation.**

1. Aucun chunk produit par le build ne dépasse 500 Ko bruts.
2. `bun run ci:check` vert à chaque commit de la phase.
3. Le banc E2E complet est vert sur `v2`, second compte compris.
4. Aucun `skip` ajouté, aucune assertion retirée.
5. BUG-001, BUG-002 et BUG-003 passent à **Corrigé** dans `.docs/04-bugs.md`, avec la preuve.
6. Aucun fichier de `packages/spec` affaibli.

**Risque principal.** Le découpage change le graphe de chargement et peut casser des attentes de
navigation du banc (un écran qui n'est plus monté au même instant).

---

### Phase 33 — L'Assemblage, la donnée

**Objectif.** Produire les chemins SVG de toutes les entités françaises au moment de l'import, de
sorte que le navigateur n'ait jamais à projeter ni à simplifier une géométrie. `geom jsonb` est
trop lourd pour être envoyé par requête, et l'image PostgreSQL ne contient pas PostGIS : la
projection est une promesse faite à l'import, pas un calcul de rendu. La donnée existe désormais en
production — déclaration du titulaire du 2026-11-22, non revérifiée depuis cette machine — : l'audit
de cette phase porte donc sur la **qualité** des `geom` (couverture, `null`, taille, outre-mer), pas
sur leur présence.

**Étapes.**

- [ ] **Audit de la donnée**, script jetable : par table (`ref_regions`, `ref_departements`,
      `ref_communes`), nombre de `geom` non nulles, nombre de `contour_url` non nulles, taille
      médiane. Le résultat va dans le journal de la phase, pas dans le dépôt.
- [ ] `.docs/02-database.md` **d'abord** : colonne `path_d text` sur les trois tables de
      référentiel, statut **Contrat**.
- [ ] Migration `0015` (nom indicatif) : `path_d text` sur `ref_regions`, `ref_departements` et
      `ref_communes`, en `add column if not exists`.
- [ ] `scripts/import` : projection vers un `viewBox` partagé, simplification (Douglas-Peucker),
      arrondi des coordonnées, écriture idempotente. Aucun calcul de géométrie au runtime.
- [ ] Jeu de référence E2E : chaque entité du semis porte un `path_d` valide.

**Critères d'acceptation.**

1. 100 % des entités métropolitaines ont un `path_d` non nul.
2. La charge utile nationale complète reste sous 250 Ko avant compression.
3. L'import est rejoué deux fois sans divergence : même nombre de lignes, mêmes empreintes.
4. Aucune commune du référentiel E2E n'est sans `path_d`.
5. `.docs/02-database.md` décrit la colonne avant que la migration existe.
6. `ci:check` vert.

**Risque principal.** Une `geom` absente ou invalide, un territoire d'outre-mer hors du `viewBox`
ou une enclave cassée par la simplification produit un trou dans la carte.

---

### Phase 34 — L'Assemblage, l'API

**Objectif.** Servir à la salle exactement ce qu'elle doit dessiner, en une requête par niveau.
Le serveur reste la seule autorité : il compte les communes couvertes, il dit quelle entité est
possédée, il ne transmet jamais `locked` ni la grille d'un ticket.

**Étapes.**

- [ ] `GET /api/v1/atlas/summary` : régions et départements avec `pathD`, `communesOwned`,
      `communesTotal`, `hasRegionCard`, `hasDepartementCard`.
- [ ] `GET /api/v1/atlas/departements/:code` : communes du département avec `pathD`,
      `ownedCards`, `hasCommuneCard`.
- [ ] Comptage par `distinct` sur `ref_code` : deux exemplaires de la même commune ne comptent
      jamais deux fois.
- [ ] Session obligatoire ; `404` sur un code inconnu ; aucune rue ; `locked` jamais exposé.
- [ ] Schémas `response` TypeBox complets pour les deux routes.

**Critères d'acceptation.**

1. Une seule requête agrégée par route, aucune boucle N+1.
2. Réponse sous 200 ms pour un compte de 2 000 cartes, mesurée en intégration.
3. Schémas `response` complets, donc typés dans Eden Treaty.
4. `401` sans session, `404` sur un code inconnu.
5. Aucune donnée privée dans la charge utile (ni solde, ni session, ni `locked`).
6. `ci:check` vert.

**Risque principal.** Un département dense monte à environ 900 communes : la charge utile par
département exige une simplification plus agressive ou une pagination.

---

### Phase 35 — L'Assemblage, la salle

**Objectif.** Remplacer le teaser par la carte réelle, à trois niveaux, en descente guidée. Le
remplissage d'une commune dit la couverture ; le filet de laiton dit la possession d'une carte de
Région ou de Département. La salle garde son nom, déjà inscrit dans `DESIGN_SYSTEM.md`.

**Étapes.**

- [ ] `/assemblage` : le teaser devient la carte. Même route, même entrée de navigation, aucun
      second déplacement d'URL.
- [ ] Trois niveaux en descente guidée uniquement : aucune poignée de déplacement, aucun zoom
      libre. Un clic sur un département ouvre ses communes ; un clic sur une commune mène à
      `/collection?commune=…`, et un clic sur un département à `/collection?departement=…`.
- [ ] Accessibilité : SVG `aria-hidden`, table ou liste équivalente complète, navigation au
      clavier, résumé textuel en `aria-live`.
- [ ] États : chargement par département, état vide, `prefers-reduced-motion`.
- [ ] Aucune animation de remplissage sous mouvement réduit.

**Critères d'acceptation.**

1. Aucun débordement horizontal à 320 px.
2. Aucun texte visible sous 10 px.
3. Contraste AA sur les libellés et les traits informatifs.
4. Table équivalente complète : chaque entité visible a sa ligne, avec son état.
5. Cas E2E : descente région → département → commune, et lien vers le Cadastre filtré.
6. Aucun état React par mouvement de pointeur.

**Risque principal.** 34 900 communes ne doivent pas transformer la salle en image morte : sans
lecture textuelle et sans descente, la carte devient décorative.

---

### Phase 36 — Le Cadastre filtrable

**Objectif.** Donner au Cadastre des filtres portés par l'URL — catégorie, rareté, département,
recherche — pour qu'un lien depuis la carte survive au rechargement, au partage et au bouton
retour.

**Étapes.**

- [ ] Filtres lus et écrits dans l'URL (deep link, retour arrière, rechargement).
- [ ] Lien carte → collection : `?departement=…` et `?commune=…` préremplissent le filtre
      correspondant.
- [ ] Libellés dans `apps/web/src/content/`, en français.

**Critères d'acceptation.**

1. Un lien profond restaure exactement le même jeu de filtres.
2. Le bouton retour défait le dernier filtre, pas la navigation entière.
3. La virtualisation de fenêtre reste intacte et la mesure de ligne ne change pas.
4. Cas E2E : lien depuis la carte, changement de filtre, retour.
5. Aucun état serveur dupliqué dans l'URL (pas de score, pas de nom de carte).
6. `ci:check` vert.

**Risque principal.** `collection.tsx` est virtualisé sur la fenêtre : un filtre qui remonte avant
la mesure casse le virtualiseur ou fait sauter le défilement.

---

### Phase 37 — Les Comptes

**Objectif.** Rendre au joueur la main sur son identité : pseudo modifiable et unique, courriel
vérifié, mot de passe changeable, biographie et visibilité, export de ses données et suppression
réelle du compte. Aujourd'hui rien de tout cela n'existe côté API.

**Étapes.**

- [ ] `/compte` : page privée, protégée par session, absente de toute surface publique.
- [ ] Pseudo : 3 à 24 caractères, jeu de caractères à trancher (voir §6), unicité insensible à la
      casse appuyée sur `user_pseudo_lower_idx`, `409 PSEUDO_TAKEN` en cas de collision.
- [ ] Courriel : changement par Better Auth, avec vérification.
- [ ] Mot de passe : changement exigeant le mot de passe actuel.
- [ ] Biographie et visibilité : réutiliser `apps/api/src/routes/profile.ts`, qui les sert déjà.
- [ ] Export RGPD : un JSON contenant cartes, tableaux, médailles, grand-livre, amitiés et
      profil.
- [ ] Suppression : réauthentification, saisie du pseudo, annulation des annonces ouvertes,
      `deleteUser` de Better Auth, vérification de chaque cascade, révocation des sessions.
- [ ] **Prérequis bloquant** : `LEGAL_PAGES_ENABLED = true` avec le texte définitif. On ne publie
      pas une suppression de compte dont la politique de confidentialité répond `404`.

**Critères d'acceptation.**

1. La suppression laisse **0 ligne** dans toutes les tables pour l'utilisateur supprimé, cascades
   vérifiées une par une.
2. L'export contient les six familles annoncées et rien d'autre.
3. Un pseudo déjà pris, à la casse près, répond `409 PSEUDO_TAKEN`.
4. Un changement de mot de passe sans le mot de passe actuel est refusé.
5. Cas E2E à deux comptes : unicité du pseudo et suppression.
6. `ci:check` vert.

**Risque principal.** `market_listings.buyer_id` est en `set null` : une suppression laisse des
annonces historiques sans acheteur, et la rétention du grand-livre devra être tranchée si la
boutique rouvre.

---

### Phase 38 — La Vitrine, la planche montrée

**Objectif.** Le profil public dit déjà le score du meilleur tableau ; il ne montre pas le
tableau. La phase ajoute les quatre cartes qui le composent, en identité seule, pour que la
vitrine montre une planche et non un nombre.

**Étapes.**

- [ ] `GET /players/:id` rend les quatre cartes du meilleur tableau : catégorie, `refCode`,
      rareté, score, nom, blason. Jamais `locked`.
- [ ] `apps/web/src/routes/players.$playerId.tsx` rend les quatre planches via `Card.tsx`.
- [ ] Cas de trou : une carte transférée depuis (`on delete set null`) laisse un emplacement
      vide, rendu comme tel.
- [ ] Aucune requête supplémentaire par carte.

**Critères d'acceptation.**

1. Aucune donnée privée dans la charge utile (ni solde, ni session, ni `locked`).
2. Un tableau incomplet rend les emplacements vides sans casser la page.
3. Une vitrine privée répond toujours `404`, jamais `403`.
4. Une seule requête pour la page entière.
5. `ci:check` vert.

**Risque principal.** Le nombre de requêtes et le poids de la charge utile : quatre planches
supposent quatre résolutions de nom et de blason, à faire dans la même requête.

---

### Phase 39 — Le Guichet

**Objectif.** Un joueur n'apprend aujourd'hui rien de ce qui lui arrive : une demande d'ami, une
vente, une médaille n'existent que s'il ouvre la bonne salle. Le Guichet est le centre de
notifications du jeu — une salle, une cloche, un compteur de non-lues.

**Étapes.**

- [ ] `.docs/02-database.md` **d'abord** : table `notifications`, statut **Contrat**.
- [ ] Migration `0016` (nom indicatif) : `notifications (id, user_id, kind, dedupe_key, payload,
      created_at, read_at)`, unicité `(user_id, dedupe_key)`, index partiel sur les non-lues.
- [ ] Émission **dans les transactions existantes** : demande d'ami, acceptation, médaille, vente,
      achat, troc (phase 40). Jamais dans une seconde transaction après coup.
- [ ] Salle `/guichet` et cloche dans la coquille, avec compteur de non-lues et marquage lu.
- [ ] Nom « Le Guichet » inscrit dans `DESIGN_SYSTEM.md` au moment de la phase, avec la coquille
      qui en est propriétaire.
- [ ] Purge à 90 jours.
- [ ] Badge « charge prête » calculé côté client : aucun événement serveur pour cela.
- [ ] Sondage toutes les 60 s plus `refetchOnWindowFocus` : pas de SSE, pas de websocket.

**Critères d'acceptation.**

1. Un rejeu d'émission ne crée pas de doublon : l'unicité `(user_id, dedupe_key)` le porte.
2. La cloche et le compteur suivent l'état serveur, jamais un compteur local.
3. Le badge « charge prête » ne déclenche aucune requête supplémentaire.
4. Cas E2E : une demande d'ami produit une notification lue puis éteinte.
5. `ci:check` vert.

**Risque principal.** Les événements sont rares : une salle vide est un aveu. Le badge local des
charges est la soupape qui lui donne une raison d'exister tous les jours.

---

### Phase 40 — Le Troc (v2.1)

**Objectif.** Le marché ne permet que la vente à prix fixe ; deux joueurs qui possèdent chacun ce
que l'autre cherche n'ont aucun moyen de s'échanger. Le Troc ajoute l'échange direct, une carte
contre une carte, avec acceptation atomique.

**Étapes.**

- [ ] `.docs/02-database.md` **d'abord** : table `trade_offers`, statut **Contrat**.
- [ ] Migration `0017` (nom indicatif) : `trade_offers (id, proposer_id, receiver_id,
      offered_card_id, requested_card_id, status, created_at, responded_at, expires_at)`, statut
      parmi `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `EXPIRED`.
- [ ] Une carte engagée dans une offre `PENDING` ne peut être ni vendue ni proposée ailleurs :
      index unique partiel. `locked` reste réservé à la vente.
- [ ] Acceptation atomique : `SELECT … FOR UPDATE` sur les deux cartes, vérification de
      possession, transfert, notification. `409` si une carte a été vendue entre-temps.
- [ ] Expiration des offres `PENDING` au-delà de `expires_at`.
- [ ] Interface : « Proposer un troc » depuis Le Cartel, offres reçues dans Le Guichet.

**Critères d'acceptation.**

1. Une double acceptation est impossible : la seconde répond `409`.
2. L'expiration tourne et rend les cartes libres.
3. Une carte en offre `PENDING` n'apparaît pas dans une annonce de marché.
4. Cas E2E à deux comptes : proposition, acceptation, transfert vérifié des deux côtés.
5. `ci:check` vert.

**Risque principal.** La collusion entre comptes secondaires : le troc n'a pas de valeur monétaire
directe, mais il faut la journaliser pour pouvoir la lire plus tard.

---

### Phase 41 — L'Atelier (v2.1)

**Objectif.** Un joueur qui gratte accumule des doublons exacts — même catégorie, même
`ref_code`, même rareté — sans usage. L'Atelier les fond en une seule carte de rareté supérieure,
ce qui donne aux doublons une valeur et une raison de revenir.

**Étapes.**

- [ ] Trancher : tirage serveur (aléatoire) ou choix déterministe de la carte produite. Si le
      tirage l'emporte, documenter l'angle « coffre à butin » : aucun argent réel n'entre, mais le
      GDD interdit de vendre des tickets, et la formulation doit le dire.
- [ ] `.docs/02-database.md` **d'abord** : `user_cards.source` gagne `CRAFT`, contrainte `CHECK`
      à modifier.
- [ ] Migration `0018` (nom indicatif) : contrainte `source` élargie.
- [ ] Refus de fusion d'une carte engagée dans un tableau ou une annonce : `409`, ou règle de
      nettoyage explicite.
- [ ] Plafond : aucune fusion vers `MYTHIQUE`.

**Critères d'acceptation.**

1. Une fusion rejouée ne produit pas de seconde carte.
2. Aucune carte n'est détruite par erreur : le compte de cartes avant et après est vérifié.
3. Une carte engagée est refusée explicitement.
4. Cas E2E : trois doublons fusionnent, une carte sort.
5. `ci:check` vert.

**Risque principal.** L'inflation de rareté, et les cartes référencées par `tableaux`
(`on delete set null`) qui laisseraient un tableau incomplet.

---

### Phase 42 — Le Palmarès (v2.1)

**Objectif.** Un tableau n'a aujourd'hui aucune trace publique de sa valeur passée : il est
recalculé à la lecture. Le Palmarès classe les meilleurs tableaux de la semaine, ce qui exige de
figer un score.

**Étapes.**

- [ ] Trancher le contrat : figer le score à la soumission (`tableaux.score`) ou une table
      d'instantanés (`tableau_scores`). Aujourd'hui le score est recalculé à la lecture, c'est
      écrit dans `.docs/01-architecture.md` §2.5.
- [ ] `.docs/02-database.md` **d'abord**, puis migration `0019` (nom indicatif) selon la décision.
- [ ] Une seule catégorie au départ : meilleur tableau de la semaine.
- [ ] Classement rendu par le serveur, jamais recalculé par le client.

**Critères d'acceptation.**

1. Les ex æquo sont départagés par une règle écrite et stable.
2. Aucun recalcul de score dans le navigateur.
3. Le classement reste identique entre deux lectures de la même semaine.
4. Cas E2E : deux tableaux, un classement.
5. `ci:check` vert.

**Risque principal.** Figer un score change la nature du tableau : un tableau modifié après
soumission doit-il conserver son score figé ? La décision doit précéder la migration.

---

### Phase 43 — La Sonnette (v2.1)

**Objectif.** Le Guichet ne parle qu'à qui vient le voir. La Sonnette ajoute les notifications
poussées du navigateur, pour un seul événement vraiment utile : le retour d'une charge. C'est la
dernière phase de la v2, parce qu'elle réécrit le service worker.

**Étapes.**

- [ ] VAPID, génération et stockage des clés.
- [ ] `.docs/02-database.md` **d'abord** : table `push_subscriptions` et préférences, statut
      **Contrat**.
- [ ] Migration `0020` (nom indicatif).
- [ ] Passer `vite.config.ts` de `generateSW` à `injectManifest`, écrire les gestionnaires `push`
      et `notificationclick`.
- [ ] Déclencheur : charges à 0 et une charge qui arrive ; au plus une par jour ; heures calmes.
- [ ] Ordonnanceur : battement de 60 s protégé par `pg_try_advisory_lock`.
- [ ] Sécurité : points de terminaison `https` uniquement, hôtes privés refusés (SSRF),
      suppression de l'abonnement sur `404` ou `410`.
- [ ] iOS : PWA installée obligatoire (16.4+), message explicite sinon.

**Critères d'acceptation.**

1. `packages/e2e/tests/pwa.spec.ts` reste vert sans être affaibli.
2. Aucune notification en double pour la même charge.
3. Le désabonnement supprime la ligne et arrête l'envoi.
4. Un point de terminaison non `https` ou privé est refusé.
5. `ci:check` vert.

**Risque principal.** La réécriture du service worker périme l'assertion structurelle de
`pwa.spec.ts` : elle doit être réécrite, jamais supprimée ou relâchée.

---

## 5. Contrat de données à venir

Aucune table n'est créée par cette planification : chaque phase met d'abord `.docs/02-database.md`
à jour, puis écrit sa migration.

| Migration (indicative) | Objet | Phase |
| :--- | :--- | :--- |
| `0014` | contrainte d'intégrité de `user_cards.ref_code` (BUG-002 et BUG-003) | 32 |
| `0015` | `path_d text` sur les trois tables de référentiel | 33 |
| `0016` | `notifications` | 39 |
| `0017` | `trade_offers` | 40 |
| `0018` | `user_cards.source` élargi à `CRAFT` | 41 |
| `0019` | score de tableau figé ou table d'instantanés | 42 |
| `0020` | `push_subscriptions` et préférences | 43 |

Les numéros sont indicatifs : `.docs/02-database.md` §1 rappelle qu'une migration livrée ne change
plus de nom, donc le numéro réel dépend de l'ordre de livraison.

---

## 6. Décisions restant à trancher

1. **Nom de la salle** : garder « L'Assemblage » ou renommer « L'Atlas ». Le nom actuel est déjà
   dans `DESIGN_SYSTEM.md` et dans le teaser ; le changer coûte une entrée de navigation et un
   titre.
2. **Ce que la carte montre** : la seule couverture communale, ou aussi la possession des cartes
   de Région et de Département. La phase 35 retient les deux, mais la décision n'est pas figée.
3. **Troc à une carte contre une carte d'abord, ou plusieurs contre plusieurs** : la phase 40
   décrit le 1 ↔ 1.
4. **Atelier aléatoire ou déterministe** : le tirage serveur donne une raison de fusionner, le
   choix déterministe donne une raison de planifier.
5. **Palmarès figé à la soumission ou instantané** : deux contrats de données différents.
6. **Jeu de caractères du pseudo** : accents, tirets, espaces, chiffres.

---

## 7. Hors périmètre v2

| Sujet | Raison |
| :--- | :--- |
| Enchères | Un mécanisme de prix dynamique ouvre une économie que la v1 n'a pas les moyens de réguler ; v3. |
| Guildes | Suppose des rôles, une modération et un partage de collection : un produit à part entière ; v3. |
| Objectifs hebdomadaires | Non retenus à la sélection ; ils ajoutent une boucle de rétention concurrente de celle des charges. |
| Partage d'image et Open Graph | Le rendu côté serveur d'une carte demande une chaîne de rendu absente de la pile. |
| Rues sur la carte | Un odonyme n'a pas de polygone : la carte mentirait sur ce qu'elle dessine. |
| Comparaison inter-joueurs sur la carte | La vitrine dit déjà la complétude ; une carte comparative expose la progression d'autrui sans besoin. |
| Chat | Modération, signalement, conservation : un chantier légal, pas une fonctionnalité. |
| SSE et websockets | Le sondage à 60 s du Guichet suffit, et l'API reste sans état long. |

---

## 8. Définition de terminé v2

- `bun run ci:check` vert à **chaque** phase, jamais seulement à la fin du jalon.
- Banc E2E complet vert, à deux comptes, sans aucun `skip`.
- Aucune spécification affaiblie : une spec ne change que si le contrat change, et le journal le
  dit.
- `.docs/02-database.md` mis à jour **avant** chaque migration, avec le statut qui suit
  l'application réelle.
- Une entrée de journal par phase dans `.docs/03-active-task.md` (l'entrée courante) ; les
  entrées closes sont archivées dans `.docs/08-journal.md`.
- Tout s'exécute dans Docker, jamais sur l'hôte.
- Une phase se livre sur `feat/v2-…` et fusionne dans `v2` ; `main` ne reçoit qu'une release, sur
  demande explicite.

---

## 9. Journal

### 2026-11-22 — La v2 est cadrée, rien n'est encore construit

**Ce qui a été décidé.** La v2 tient en deux jalons. La carte à trois niveaux est le chemin
critique : elle ouvre le jalon v2.0, parce qu'elle porte la rétention et qu'elle ne dépend d'aucune
autre phase. Les notifications vivent dans une salle nommée « Le Guichet », et les notifications
poussées attendent la v2.1, après le centre. Le Troc, L'Atelier, les filtres du Cadastre et Le
Palmarès sont dans le périmètre ; les enchères, les guildes, les objectifs hebdomadaires, le
partage d'image, les rues sur la carte, la comparaison inter-joueurs, le chat et les websockets
sont dehors, chacun avec sa raison au §7.

**Ce qui a été vérifié dans le code, et non supposé.** Le profil public existe déjà et rend le
score du meilleur tableau sans ses cartes. Aucune page de compte n'existe, et
`apps/api/src/routes/profile.ts` ne sait qu'écrire `bio` et `profile_public`. Aucun code de
notification n'existe dans `apps/`. La carte n'a qu'un teaser et aucun `path_d` n'existe nulle
part. Le déclencheur CI de `.github/workflows/ci.yml` couvre toute `pull_request` sans filtre de
branche, donc une PR vers `v2` est vérifiée, tandis qu'un `push` direct sur `v2` ne l'est pas
(le déclencheur `push` est limité à `main`).

**Les deux bloqueurs, écrits pour ne pas être découverts en phase 33.** Le track A2 de
`ROADMAP.md` — le référentiel importé en production — est **levé le 2026-11-22** : le titulaire
déclare l'avoir importé manuellement en production ; non revérifié depuis cette machine. La donnée
vit dans les volumes, pas dans l'image, donc un volume neuf exige un réimport. Reste les pages
légales, qui répondent `404` (`LEGAL_PAGES_ENABLED = false`) : la phase 37 ne peut pas publier de
suppression de compte avant que le texte définitif soit en place.

**Ce que cette session ne prouve pas.** Aucun fichier de `apps/`, de `packages/spec` ni de
migration n'a été modifié. Les vérifications ont été jouées après l'écriture du document :
`ci:check` vert (**343 spécifications, 18 fichiers, 0 échec**) et le banc E2E à **68 exécutés,
68 passés, 0 échoué, 0 ignoré**. Le banc avait d'abord trouvé deux échecs sur le cas de la
boutique, que le retrait de `SHOP_ENABLED` avait rendu faux : le cas a été réécrit pour assérer la
disparition de la salle, pas son fonctionnement — un test plus exigeant, pas plus indulgent. Aucun
build n'a été mesuré : ceux du §2 sont ceux du dépôt au 2026-11-22. La branche `v2` est créée
localement depuis `main` et n'a pas été poussée.

**Portée** : `.docs/07-roadmap-v2.md` (nouveau), `AGENTS.md` (section « Git et publication » et
liste de lecture), `ROADMAP.md` (renvoi), `.docs/03-active-task.md`. Aucune migration, aucune table
créée, aucune dépendance nouvelle.
