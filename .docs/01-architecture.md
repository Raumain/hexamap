# 01 — Architecture, stack et règles du jeu

> **Source de vérité produit et technique.**
> À lire avant toute implémentation. En cas de contradiction avec un autre document, ce fichier gagne.
> Dernière mise à jour : 2026-11-19.

---

## 1. Vision

Hexamap est un TCG communautaire jouable au navigateur. Les joueurs obtiennent des tickets à gratter périodiques, découvrent des lieux réels de France issus de l'Open Data, constituent des collections et les échangent sur un marché.

Le produit est **entièrement en français**. Aucune couche i18n n'est prévue : les textes sont écrits directement en français et centralisés quand ils sont réutilisés.

La V1 du marché permet **uniquement la vente à prix fixe et l'achat direct**. Le troc et les enchères sont hors périmètre (V2).

---

## 2. Règles du jeu (GDD condensé et normatif)

### 2.1 Les 4 catégories de cartes

| Catégorie | Volume de base | Rareté déterminée par |
| :--- | :--- | :--- |
| Région | 18 | Édition de rareté (6 paliers) |
| Département | 101 | Édition de rareté (6 paliers) + léger bonus de population |
| Commune | ~34 900 | Population municipale INSEE |
| Rue (odonyme) | ~450 000 | Nombre `N` de communes possédant ce nom de voie |

Une région ou un département peut tomber dans n'importe quelle édition de rareté. Une commune ou une rue a une rareté intrinsèque.

### 2.2 Paliers de rareté

Ordre : `COMMUNE < INHABITUELLE < RARE < EPIQUE < LEGENDAIRE < MYTHIQUE`.

| Palier | Édition | Poids de tirage | Commune (population `P`) | Rue (nombre de communes `N`) | Score édition (Région / Dép.) |
| :--- | :--- | ---: | :--- | :--- | ---: |
| Commune | Gris / Standard | 55,0 % | `P < 1 000` | `N > 500` | 200 |
| Inhabituelle | Vert / Bronze | 25,0 % | `1 000 ≤ P < 5 000` | `100 ≤ N ≤ 500` | 400 |
| Rare | Bleu / Argent | 13,0 % | `5 000 ≤ P < 20 000` | `20 ≤ N < 100` | 750 |
| Épique | Violet / Or | 5,0 % | `20 000 ≤ P < 100 000` | `5 ≤ N < 20` | 1 250 |
| Légendaire | Jaune / Platine | 1,8 % | `100 000 ≤ P < 250 000` | `2 ≤ N < 5` | 2 000 |
| Mythique | Rouge / Holo | 0,2 % | `P ≥ 250 000` | `N = 1` | 3 500 |

### 2.3 Poids des catégories au tirage

| Catégorie | Probabilité |
| :--- | ---: |
| Rue | 40 % |
| Commune | 35 % |
| Département | 17 % |
| Région | 8 % |

**Ordre obligatoire du tirage serveur :** tirer d'abord la catégorie, puis le palier de rareté, puis une carte uniforme dans ce palier. Ne jamais tirer uniformément sur l'ensemble des communes ou des rues.

### 2.4 Formules de score

Commune, avec `P` plancher à 10 :

```text
ScoreCommune = round(100 × log10(max(P, 10))²)
```

Rue, avec `N` plancher à 1 :

```text
ScoreRue = round(3000 / (1 + log10(max(N, 1))))
```

Région / Département : score de l'édition (200 à 3 500). Bonus départemental léger, calibré via `game_config` (proposition : `round(20 × log10(max(population, 10)))`).

Exemples normatifs :

- Commune 100 hab. → 400 pts ; 1 000 → 900 ; 10 000 → 1 600 ; 100 000 → 2 500 ; 1 000 000 → 3 600.
- Rue présente dans 10 000 communes → 600 pts ; 1 000 → 750 ; 100 → 1 000 ; 10 → 1 500 ; 1 → 3 000.

### 2.5 Tableau et synergie territoriale

Un tableau expose 4 cartes : Région + Département + Commune + Rue. On additionne les 4 scores, puis on applique le multiplicateur d'alignement `M` :

| Liens géographiques valides | Multiplicateur |
| :--- | ---: |
| 0 | ×1,0 |
| 1 | ×1,5 |
| 2 | ×2,5 |
| 3 (combo complet) | ×5,0 |

```text
ScoreTotal = round((ScoreRégion + ScoreDép + ScoreCommune + ScoreRue) × M)
```

Liens vérifiés par le serveur :

1. `région.code === département.code_region`
2. `département.code === commune.code_departement`
3. la rue existe réellement dans la commune (`commune_odonymes`)

Règles d'implémentation (Phase 8) :

- Toutes les règles ci-dessus vivent dans `packages/shared/src/tableau.ts` (`evaluateTableauAlignment`, `evaluateTableau`, `rueExistsInCommune`) et `scoring.ts` (`tableauScore`, `alignmentMultiplier`). Le serveur et le client importent les mêmes fonctions ; aucune formule n'est dupliquée.
- Le score d'un tableau n'est **pas stocké** : il est recalculé à la lecture et à la soumission à partir des `user_cards.score`. Une évolution vers un score figé devrait passer par `.docs/02-database.md`.
- Les cartes d'un tableau ne passent **pas** à `locked = true` : `locked` reste réservé à la vente. La soumission exige en revanche `locked = false` et refuse (`409`) une carte déjà engagée dans un autre tableau du même joueur.
- Une carte ne peut occuper que l'emplacement de sa catégorie (`slotMatchesCategory`).

### 2.6 Ticket à gratter « Le Relevé Topographique »

- Grille de **16 cases** (4 × 4).
- **4 coups de grattoir** au départ.
- Aucune case vide.
- Composition secrète :
  - **1 Pépite** : carte garantie Rare → Mythique.
  - **2 Lieux jumelés** : cartes Inhabituelle/Rare liées géographiquement à la Pépite.
  - **3 Panneaux** : Station-Service (+2 coups), Belvédère (carte Commune + révélation gratuite d'une case adjacente), Rénovation (+1 palier de rareté à la prochaine carte découverte).
  - **10 Routes communales** : cartes Commune ou Inhabituelle.
- **1 case standard est pré-grattée gratuitement** à l'ouverture, avec son panneau kilométrique.
- Chaque case révélée affiche la distance de Manhattan jusqu'à la Pépite : `|L1-L2| + |C1-C2|`.
- **Anti-triche** : le serveur ne transmet jamais la position de la Pépite ni le contenu des cases non révélées.
- **Tolérance aux référentiels incomplets** : un palier de rareté vide ne bloque jamais la génération. Une commune ou une rue est alors tirée dans le palier voisin le plus proche (palier plus bas prioritaire) et porte la rareté réelle de la ligne référentielle, donc un score cohérent. Les jumelés sont cherchés de la commune jusqu'au national, puis complétés par un vivier national. `REFERENCE_DATA_MISSING` reste réservé au cas où le référentiel ne contient aucun candidat pour la catégorie demandée.
- **Rythme de grattage — le carnet de charges.** Un compte ne génère pas un ticket à la demande : il dépense une **charge**. `SCRATCH_CHARGE_CAP = 6`, `SCRATCH_REGEN_MS = 1 800 000` (30 min) et `SCRATCH_START_CHARGES = 6` vivent dans `game_config` (§4.1 de `.docs/02-database.md`) : aucune constante en dur, aucun `CHECK` sur le plafond. Une charge se régénère tant que le solde est sous le plafond ; **au plafond la régénération est suspendue** — rien ne s'accumule, rien n'est perdu. Un compte neuf démarre **au plafond**, jamais à 1 : la première session doit produire un vrai ticket, et la médaille « premier ticket gratté » doit frapper sur un objet réel.
- **La limite porte sur la génération, pas sur la case.** « 1 carte toutes les 30 minutes » se lit « 1 ticket toutes les 30 minutes ». Compter les cases rendrait un ticket de 16 cases long de huit heures et contredirait le geste. « Stocker 6 cartes » se lit donc « 6 tickets en réserve ». Le ticket reste unique et actif : `tickets_one_active_per_user` n'est pas touché, la charge est bankée séparément.
- **Le solde est dérivé, jamais incrémenté par une requête.** Il se calcule depuis `last_regen_at` :

  ```text
  solde = min(plafond, charges + ⌊max(0, now − last_regen_at) / regen⌋)
  charges créditées g = solde − charges
  si g > 0 et solde < plafond : last_regen_at += g × regen   # conserve le reste fractionnaire
  si solde = plafond          : last_regen_at = now           # fige le compte
  dépense depuis le plafond    : last_regen_at = now           # arme le compte à rebours
  ```

  Avancer `last_regen_at` de `g × regen` et non jusqu'à `now` est ce qui empêche de perdre les minutes déjà écoulées vers la charge suivante : c'est le seul détail qui distingue un carnet juste d'un carnet qui « avale » une minute à chaque lecture.
- **Une seule transaction, un seul verrou.** La dépense d'une charge, la génération du ticket et le tirage se font sous `SELECT … FOR UPDATE` sur la ligne de charges : deux requêtes parallèles ne peuvent pas dépenser la même dernière charge.
- **Pas de sondage.** L'API rend `charges` et `nextChargeAt` (`null` au plafond) ; le client fait défiler le compte à rebours localement à partir de ces deux valeurs et se resynchronise à chaque mutation. `/charges` n'est pas appelé chaque minute, et le service worker ne met jamais un solde en cache.

### 2.7 Rareté inversée des rues

Les petits villages ont souvent des noms de rues uniques (`N = 1`, 3 000 pts), tandis que les grandes villes ont des rues génériques. Une petite commune bien associée à sa rue unique peut rivaliser avec une métropole. C'est une mécanique centrale, pas un détail.

### 2.8 Économie — les écus

La monnaie du jeu s'appelle l'**écu** (pluriel : écus). C'est un **nom d'affichage** : la colonne reste `currency`, le grand-livre reste `currency_ledger`, et le renommer n'exige aucune migration.

- **Un compte neuf démarre à 0 écu.** Le solde ne monte que par une ligne de `currency_ledger`, jamais par une écriture directe sur `user.currency`.
- **Deux robinets seulement.** Les médailles (V1) et l'achat contre de l'argent réel (V1 ultérieure, non planifiée). Il n'existe **aucun bonus quotidien** : un robinet à taux fixe se règle mal et ne se révoque pas.
- **Le robinet des médailles est fini.** Chaque prime est unique et versée une seule fois, ce qui borne l'inflation. C'est la différence structurelle avec une prime récurrente.
- **Idempotence.** Une prime s'écrit `currency_ledger.reason = 'ACHIEVEMENT:<key>'` dans la transaction qui insère `user_achievements (user_id, achievement_key)` ; la clé primaire composite fait qu'un rejeu ne paie pas. `MARKET_BUY` et `MARKET_SELL` restent les deux autres motifs existants.
- **Le catalogue vit dans `packages/shared`**, pas en base : clé, famille, seuil, montant. Il est verrouillé par `packages/spec`, aucune prime ne se modifie depuis un écran d'administration. Budget d'ouverture : **6 000 écus** au total, dont **2 440** pour la seule famille « collection ».
- **Le catalogue complet vaut exactement un `PACK_6000`** : la somme des 37 primes est de **6 000 écus**, soit **44,99 € TTC**. La progression gratuite reste une récompense de long terme, et la boutique un raccourci, jamais le chemin.
- **Quatre packs, un ratio croissant.** Le catalogue fermé des packs vit dans `packages/shared/src/packs.ts` : module pur, sans dépendance, sans `process.env` lu, sans accès réseau, verrouillé par `packages/spec/src/packs.spec.ts` (ratio écus/€ strictement croissant d'un pack au suivant). Il ne contient que le **nom** de la variable Stripe, jamais un identifiant `price_…` réel.

| Clé | Écus | Prix TTC | Bonus | Variable d'environnement |
| :--- | ---: | ---: | ---: | :--- |
| `PACK_500` | 500 | 4,99 € | 0 % | `STRIPE_PRICE_PACK_500` |
| `PACK_1200` | 1 200 | 9,99 € | 20 % | `STRIPE_PRICE_PACK_1200` |
| `PACK_2500` | 2 500 | 19,99 € | 25 % | `STRIPE_PRICE_PACK_2500` |
| `PACK_6000` | 6 000 | 44,99 € | 33 % | `STRIPE_PRICE_PACK_6000` |
- **Aucune médaille ne récompense une dépense d'argent réel**, jamais : cela mêlerait le pay-to-win à la progression, et la boutique doit rester un raccourci, pas le chemin.
- **Interrupteur.** `ACHIEVEMENT_PAYOUTS_ENABLED` coupe les primes sans migration, sans retirer les médailles déjà obtenues.
- **Le ticket ne se vend jamais.** Vendre de la monnaie à valeur fixe est une microtransaction ; vendre des tickets aléatoires est un coffre à butin, et la réglementation française des jeux d'argent (ANJ) s'appliquerait. Le ticket gratuit reste la seule source de cartes — c'est aussi ce qui empêche la limite de charges de devenir un péage.
- **Plafond quotidien.** `SHOP_DAILY_PURCHASE_CAP` (12 000 écus) est lu dans `game_config` **avant** l'appel à Stripe et hors transaction : un aller-retour réseau ne tient aucune transaction ouverte. Un achat qui ferait dépasser le cumul crédité depuis minuit UTC répond `429 SHOP_DAILY_CAP_REACHED` sans créer de session ; un paiement déjà effectué reste crédité par le webhook.
- **Remboursement.** Un remboursement Stripe écrit une contrepartie négative `PURCHASE_REFUND:<session.id>` **proportionnelle** au montant rendu et plafonnée au crédit initial. Le solde n'est jamais négatif : la ligne est écrite, le solde ramené à 0, et `SHOP_REFUND_NEGATIVE` journalisé. Aucune table nouvelle — le grand-livre suffit.

### 2.9 Relations — amis et vitrine publique

- **L'amitié est symétrique et consentie.** Une demande, une acceptation. Le statut `DECLINED` est conservé pour que la demande ne resurgisse pas, et seul le demandeur d'origine peut la rouvrir, après un délai de `game_config`.
- **Une seule relation par paire**, quel que soit le sens de la demande : index unique sur `(least(a, b), greatest(a, b))`. Sans lui, deux demandes croisées créent deux amitiés.
- **Seules les amitiés `ACCEPTED` comptent** pour les médailles sociales. Un élevage de comptes factices coûte donc une acceptation par compte et par jour, plafonnée par `FRIEND_REQUEST_DAILY_CAP`.
- **Le blocage est unilatéral et silencieux** : il supprime toute relation pendante ou acceptée dans les deux sens et masque la vitrine aux deux comptes. Il ne notifie jamais la personne bloquée.
- **La vitrine est publique par défaut, révocable.** `/players/:id` montre le pseudo, l'ancienneté, le nombre de cartes, la complétude par catégorie, le meilleur tableau, les médailles, les annonces ouvertes et le nombre d'amis. Elle ne montre **jamais** l'adresse électronique, le solde, la session, l'état `locked`, `grid` ni `treasure_index` — même liste que l'invariant de non-exposition du §2.6.
- **Une vitrine privée répond `404`, pas `403`** : un 403 confirmerait l'existence du compte, exactement ce que la vitrine privée cherche à éviter. Même raisonnement que `CARD_NOT_VISIBLE`.
- **`pseudo` devient une identité publique.** Il est aujourd'hui `required` côté Better Auth, `nullable` en base, sans contrôle de longueur ni d'unicité. La vitrine exige donc un index unique sur `lower(pseudo)` et une validation de forme (3 à 24 caractères) **avant** d'être rendue linkable.
- **Les salles** (amis, vitrine) sont nommées dans `DESIGN_SYSTEM.md` au moment de leur phase, pas ici : la coquille et le rail restent les propriétaires de la nomenclature.

---

## 3. Stack technique

| Couche | Technologie |
| :--- | :--- |
| Monorepo | Bun workspaces |
| API | Bun + Elysia + TypeBox |
| Base de données | PostgreSQL 16 |
| Accès DB | Kysely + migrations versionnées |
| Authentification | Better Auth (adaptateur Kysely/Postgres) |
| Client API typé | Eden Treaty (`@elysia/eden`) |
| Frontend | React 19 + TypeScript + Vite |
| Routing | TanStack Router (file-based) |
| Données serveur | TanStack Query |
| Tableaux | TanStack Table |
| Formulaires | TanStack Form |
| Style | TailwindCSS + SVG/CSS procédural |
| Conteneurs | Docker + Docker Compose |

---

## 4. Règles d'architecture

### 4.1 Règles générales

- **Tout s'exécute dans un conteneur.** Ne jamais lancer `bun`, `npm`, `tsc`, `vite` ou un script de build sur la machine hôte.
- **Spec-first** : `packages/spec` est la source de vérité exécutable. Le code s'adapte aux tests de spécification, jamais l'inverse.
- **Français uniquement** : aucun framework i18n, aucun texte anglais visible par le joueur.
- **Serveur autoritaire** : le tirage, la position de la Pépite, les récompenses, la validation des combos, le carnet de charges, les médailles et la monnaie sont décidés côté serveur.
- **Pas d'appel externe au runtime** : les API gouvernementales sont utilisées uniquement par le pipeline d'import.
- **Les routes métier sont fermées par défaut.** Seules la santé, les webhooks de paiement et les profils publics se montent hors du groupe `authPlugin`. `/api/v1/import-status` exige une session : sa charge utile porte des erreurs brutes et un journal qui peuvent contenir chemins, DSN et URL amont.

### 4.2 API — Elysia

- Découper l'API en modules/plugins Elysia (`auth`, `tickets`, `cards`, `tableaux`, `market`, `reference`).
- Déclarer les schémas `body`, `params`, `query` et `response` avec TypeBox (`t`).
- Les schémas `response` sont obligatoires : ils alimentent le typage Eden Treaty.
- Les routes protégées sont montées sur un groupe Elysia dédié (préfixe `/api/v1`) qui utilise le plugin `middleware/auth.ts`. Ses hooks `derive` et `onBeforeHandle` portent `{ as: 'scoped' }` : un hook déclaré dans un plugin est local par défaut et ne protégerait pas les routes du groupe parent.
- Les erreurs ont un code stable (anglais) et un message français.
- Les appels directs à `auth.api.*` ne doivent pas être utilisés pour des mutations sans vérification d'origine/CSRF.
- Les transactions critiques (grattage, achat) utilisent une transaction Kysely et un verrou `FOR UPDATE`.

### 4.3 Base de données — Kysely

- **Aucune table ni colonne ne peut être inventée.** Le contrat est `.docs/02-database.md`.
- Toute évolution du schéma commence par une mise à jour de `.docs/02-database.md`, puis une migration.
- Les migrations appliquées sont immuables. On ajoute une nouvelle migration.
- Les requêtes métier passent par Kysely. Le SQL brut est réservé aux migrations, aux health checks et aux opérations d'import massif (`COPY`).
- Les tables de jeu utilisent `snake_case`. Les tables Better Auth conservent les noms/colonnes générés par Better Auth (`camelCase` pour les colonnes).
- Les clés étrangères vers l'utilisateur référencent `"user"("id")` de type `text`.

### 4.4 Authentification — Better Auth

- Better Auth est la seule source d'identité. Ne pas réimplémenter l'inscription, la connexion, les sessions ou le hachage de mot de passe.
- Le schéma Better Auth est généré par le CLI (`bun x auth generate --adapter kysely`). Ne pas l'écrire à la main.
- Montage : `app.mount(auth.handler)`, basePath `/api/auth`.
- Utiliser les cookies `HttpOnly`, `Secure` en production, `SameSite=Lax`, et une liste `trustedOrigins` explicite.
- Les champs personnalisés `pseudo` et `currency` sont déclarés dans la configuration Better Auth.

### 4.5 Frontend — React / TanStack

- Utiliser TanStack Router en mode file-based. Ne jamais éditer `routeTree.gen.ts` à la main.
- Utiliser TanStack Query pour tout état serveur. Pas de `useEffect` pour fetcher.
- Le client API est Eden Treaty, importé avec `import type { App }` uniquement.
- **Le navigateur ne parle qu'à l'origine du web.** Le client Eden est initialisé sur `window.location.origin` (`treaty(window.location.origin)`) : les requêtes partent vers `<origine>/api/...`, donc sur le même host et le même port que le front, quelle que soit l'adresse d'accès (localhost ou IP LAN). **Ne jamais passer une chaîne vide** : Eden la préfixe par `https://` et produit `https://api/v1/health`, où `api` devient le nom de domaine. En dev, **Vite relaye `/api` vers l'API Docker** (`server.proxy` → `API_INTERNAL_URL`, par défaut `http://api:3000`). Aucune URL absolue `localhost:3000` ne doit fuiter côté navigateur. En production, il n'y a plus de proxy : **l'API sert elle-même le SPA** sur la même origine, donc `/api/...` reste un chemin relatif au même host et au même port (voir §6.1).
- Les composants sont en français, accessibles (rôles, labels, `aria-live`), et stylés avec Tailwind.
- Les libellés réutilisables sont centralisés dans `apps/web/src/content/`. Pas de dépendance i18n.

### 4.6 Règle stricte du Canvas

**Interdiction d'utiliser l'état React pour piloter le Canvas de grattage.**

- Le Canvas (ou la surface de grattage) est piloté par un contrôleur impératif : `ref`, `requestAnimationFrame`, événements natifs.
- L'état React ne sert qu'aux transitions grossières : ticket chargé, case révélée, ticket épuisé, erreur.
- Ne pas déclencher de re-render React à chaque mouvement de souris/doigt.
- La révélation d'une case est une mutation serveur ; le Canvas ne fait qu'afficher le résultat.
- **Un seul dessin par image (Phase 16).** `components/scratch-cell.tsx` accumule le point courant dans une `ref` et planifie un unique `requestAnimationFrame` qui trace le segment `dernier point → point courant`, puis incrémente le compteur de coups. Un trait encore en attente est **vidé synchroniquement** sur `pointerup`/`pointercancel`/`pointerleave` avant le test de couverture : aucune frame manquante ne peut laisser une case bloquée juste sous le seuil. La frame est annulée au démontage.
- **Le rayon du pinceau dérive de la case.** `SCRATCH_REVEAL_THRESHOLD` et `scratchBrushRadius(w, h)` vivent dans `packages/shared/src/ui.ts`, verrouillés par `packages/spec/src/ui.spec.ts`. Rayon = `clamp(18, 40, round(min(w, h) × 0,18))` : 18 px sur une case mobile de ~78 px, 25 px sur une case de 140 px. Le composant ne déclare plus aucune constante de pinceau ni de seuil.
- **Un redimensionnement conserve le grattage.** Si des coups ont déjà été portés, le `ResizeObserver` copie le tampon dans un canvas détaché, repeint la couverture à la nouvelle taille, puis réapplique la copie sous transformation identité : la zone déjà grattée survit à une rotation, mise à l'échelle comprise.
- Le seuil reste **40 %** de pixels effacés (`alpha < 128`). Il n'est jamais abaissé côté client, et le serveur reste seul juge de la révélation.
- Le geste reste **exclusivement Pointer Events** : aucun handler `onMouse*`/`onTouch*`, `setPointerCapture` conservé, `useState` interdit dans le composant.

### 4.7 Données Open Data

- Sources : `geo.api.gouv.fr`, Base Adresse Nationale / FANTOIR, IGN / Etalab, Wikidata.
- Import unique et rejouable, en streaming, avec reprise et mode `--lite` pour le développement.
- Normalisation des odonymes : majuscules, suppression des accents, tirets/apostrophes remplacés par des espaces, espaces compactés.
- Conserver le nom d'affichage original pour la carte.
- Documenter l'attribution des sources.
- Les blasons (SVG) sont des assets statiques générés hors ligne par `scripts/import` et stockés dans le volume Docker `blasons` (monté sur `/data/blasons`). L'API les sert sur `GET /blasons/*` avec `Cache-Control: public, max-age=3600, must-revalidate` ; aucun appel réseau n'est fait au rendu, et `/blasons` reste hors du repli SPA. Chaque réponse est revalidée par un ETag faible `W/"<taille>-<mtime>"`, et les charges `image/svg+xml` de plus de 1 Kio sont compressées en gzip ou brotli comme les autres assets texte (§6.1). Les licences et attributions sont stockées en base (`blason_credit`), pas dans les fichiers. L'API expose ces assets sur les cartes (`blasonUrl`, `blasonCredit` sur `/cards` et `/market/listings` ; le `contour_url` sert de repli visuel pour les communes sans armoiries).

### 4.8 Tests

- `packages/spec` contient les tests issus du GDD. Une PR d'implémentation ne modifie pas les specs.
- Tests unitaires : formules, paliers, normalisation, distance, multiplicateurs.
- Tests statistiques : RNG injecté et seedé pour être déterministes.
- Tests d'intégration : vrai PostgreSQL, schéma isolé par worker.
- E2E : Playwright, sélecteurs par rôle et libellés français.
- **Garde-fou unique : `bun run ci:check`** (`scripts/ci-check.ts`). Quatre étapes séquentielles, arrêt à la première en échec : `1/4 Lint` (`biome check .`), `2/4 Typecheck`, `3/4 Base de données` (`bun run --cwd packages/db ping`, dossier `packages/db/src/ping.ts`), `4/4 Spécifications` (`bun test packages/spec`). C'est la commande de la CI et la seule case de la pull request : aucune vérification ne se fait « à la main ».
- **Base de test dédiée, imposée par le garde-fou.** `ci:check` exige `TEST_DATABASE_URL` et refuse de démarrer si elle est absente, si elle égale `DATABASE_URL`, ou si `NODE_ENV=production`. La suite de spécifications ne touche donc jamais les référentiels importés en développement. `packages/db` réexporte `sql` de Kysely pour que les specs puissent lancer du SQL brut sans dépendance propre.
- **Banc E2E — HTTPS.** `docker-compose.e2e.yml` termine TLS sur une bordure Caddy et une AC
  interne, parce qu'un service worker ne s'enregistre que dans un contexte sécurisé : en HTTP,
  `navigator.serviceWorker` n'existe même pas. `ignoreHTTPSErrors` est posé sur l'ensemble des
  projets, l'AC n'étant dans aucun trust store ; `global-setup.ts`, qui construit son contexte à
  la main, doit le répéter. Le seul projet `pwa` ajoute `launchOptions.args:
  ['--ignore-certificate-errors']`, parce que le téléchargement du **script** du worker passe par
  la pile réseau de Chrome et non par le routage CDP : sans ce commutateur, l'enregistrement
  échoue en `SecurityError`. L'alias `hexamap.test` appartient au `proxy`, jamais à `api` — deux
  adresses DNS pour la même origine enverraient des requêtes HTTP nues sur une origine `https`.
  `encode` reste désactivé dans le `Caddyfile` : la compression mesurée doit rester celle de
  l'API.

### 4.9 Design system : jetons, métaux, planches, coquille

La référence visuelle complète est `DESIGN_SYSTEM.md` (révision 4, « Le Cabinet de
cartographie »). Cette section fixe les règles qui engagent le code, pas seulement l'apparence.

- **Un seul propriétaire des jetons : `apps/web/src/styles.css`.** Tailwind v4 est CSS-first :
  un unique bloc `@theme` déclare la pièce (`cabinet`, `cabinet-raised`, `cabinet-sunk`), le
  vélin (`vellum`, `vellum-2`, `vellum-edge`), les encres (`ink`, `ink-soft`, `ink-faint`), le
  laiton et la cire (`brass`, `brass-deep`, `oxide`, `verdigris`, `indigo`), les six métaux de
  rareté, les rayons, les ombres et les durées. Six `@font-face` y sont déclarées — Fraunces,
  Instrument Sans et JetBrains Mono, chacune en `latin` + `latin-ext` avec `unicode-range` —
  et les fichiers sont auto-hébergés dans `apps/web/public/fonts/`. Il n'y a **pas** de
  `tailwind.config.ts` et il ne doit jamais y en avoir : il ne serait pas chargé. Aucun
  composant n'écrit une couleur littérale. `biome.json` doit garder
  `css.parser.tailwindDirectives: true` (Biome 2.6), sans quoi `ci:check` échoue à l'étape 1.
- **La rareté est un domaine partagé, pas une décision d'UI.** `packages/shared/src/rarity.ts`
  possède les six paliers (`COMMUNE`, `INHABITUELLE`, `RARE`, `EPIQUE`, `LEGENDAIRE`,
  `MYTHIQUE`), leurs libellés français via `RARITY_LABELS` (`INHABITUELLE` = « Peu commune »)
  et leurs six métaux via `RARITY_ACCENT_HEX` (étain, cuivre, argent, émail, or, électrum).
  `apps/web/src/lib/rarity-theme.ts` n'ajoute que l'initiale du sceau, l'épaisseur du filet et
  l'encre lisible : il ne redéfinit ni la liste, ni le texte, ni une couleur.
  `packages/spec/src/rarity.spec.ts` verrouille la parité six paliers, les libellés exacts, le
  format hexadécimal et la somme de `RARITY_WEIGHTS` à 100.
- **Deux marques, deux rôles.** `apps/web/src/components/ui/rarity-seal.tsx` est l'unique sceau
  de rareté ; `apps/web/src/components/ui/rarity-badge.tsx` reste le libellé inline. Aucun
  composant ne redessine un sceau ni n'écrit un libellé de rareté à la main.
- **Quatre planches, un seul point d'entrée.** `apps/web/src/components/ui/Card.tsx` délègue
  par `type` aux quatre planches de `apps/web/src/components/ui/cards/` — `region-card.tsx`,
  `departement-card.tsx`, `commune-card.tsx`, `rue-card.tsx` — sur le châssis commun
  `cards/card-shell.ts`. `apps/web/src/lib/commune-vignette.ts` génère la silhouette de village
  de façon **déterministe depuis le code INSEE** : aucun aléatoire au rendu, aucun état React.
  Deux communes différentes ne produisent jamais la même vue.
- **Budget DOM : ≤ 18 nœuds non-SVG par planche**, racine incluse, les enfants internes d'un
  `<svg>` exclus. Les gravures ajoutent de la richesse sans coûter de nœuds ; les ornements
  passent par `::before`/`::after`. `packages/e2e/tests/design-system.spec.ts` applique ce
  budget, vérifie les quatre gravures distinctes, le déterminisme de la vignette et le
  multiplicateur piloté par le serveur.
- **La coquille est unique.** `apps/web/src/components/layout/app-shell.tsx` monte
  `sidebar.tsx` (rail desktop, à partir de `md:`), `bottom-tab-bar.tsx` (onglets mobiles)
  et `more-sheet.tsx` (feuille des salles secondaires, ouverte par le cinquième contrôle),
  avec `env(safe-area-inset-top|bottom)` et `viewport-fit=cover`. En **paysage**, l'encoche
  passe sur les côtés : `env(safe-area-inset-left|right)` est posé sur le rail
  (`sidebar.tsx`), la barre basse, la feuille, l'invitation de mise à jour, l'en-tête mobile
  et le décalage du contenu `md:pl-[calc(232px+env(safe-area-inset-left))]`. La gouttière du
  contenu est l'utilitaire `.gutter-safe` de `styles.css` — un `max()` entre la gouttière du
  cabinet (20 px, 40 px à partir de `md`) et l'encoche — appliqué à `main` et au `footer`.
  Hors encoche, `env()` vaut `0` : le portrait et le bureau sont inchangés au pixel près.
  La feuille passe par
  `OverlayPortal` comme les deux overlays de route, et le cinquième onglet est un `button`,
  pas un `Link`, parce qu'il ouvre au lieu de naviguer. Chaque route rend **un seul**
  `main` ; les salles sont nommées dans l'interface (Le Relevé, Le Cadastre, La Planche, Le
  Comptoir, Le Seuil, Les Archives).
- **Politique d'effets.** Dégradés et ombres douces sont autorisés sur les surfaces (cônes de
  lumière, vignettage, fibre du vélin) et **interdits dans une liste virtualisée** comme
  autour du canvas de grattage : ni `filter`, ni `backdrop-filter`, ni `mix-blend-mode` par
  ligne. Le grain est **un seul** `body::after` fixe, jamais un filtre par composant.
- **Le tableau de combo ne calcule rien.** `alignment.breakdown[].valid` et
  `alignment.multiplier` viennent du serveur ; `alignment.links` est un **nombre**. Aucun
  recalcul d'alignement ni de multiplicateur dans le navigateur.
- **Une ligne de liste reçoit sa hauteur de son contenu.** Les lignes virtualisées de
  `routes/tableau.tsx` ne déclarent ni `h-*` ni `min-h-*` : la planche `w-14` (`decorative`,
  `aspect-[4/5]`, 70 px) et le `py-2` de la ligne fixent la hauteur, et `estimateSize` ne sert
  qu'à l'estimation d'avant-mesure du virtualiseur. Déclarer une hauteur en plus de celle du
  contenu a produit BUG-008 — une planche de 70 px dans une ligne de 64 px, mesurée à 64, donc
  deux planches voisines recouvertes de 6 px.
- **Aucune animation ne remplit vers l'avant sur un ancêtre de mise en page.** `<main>` porte
  `.enter-salon` avec `animation-fill-mode: backwards` : son `transform` disparaît à la fin des
  180 ms. Un `transform` — même `translateY(0)` — ferait de `<main>` le bloc conteneur de tout
  descendant `position: fixed` (BUG-007). Les overlays appartenant à une route — le tiroir de
  La Planche (`routes/tableau.tsx`) et la modale de Pépite (`routes/tickets.$ticketId.tsx`) —
  sont rendus dans `document.body` par `components/ui/overlay-portal.tsx`, donc insensibles à
  tout futur ancêtre transformé ; la même règle vaut pour `#root` et pour la racine
  d'`app-shell.tsx`. Le rail, la barre d'onglets et l'invitation de mise à jour sont frères de
  `<main>` et ne sont pas concernés. `packages/e2e` verrouille l'invariant :
  `getComputedStyle(main).transform === 'none'` après l'entrée en salle, et tiroir rendu hors
  de `<main>`.
- **Une planche ne rend du texte qu'à partir de 120 px.** Les quatre gabarits partagent cette
  limite : au-dessous, ils sont utilisés par la variante `decorative`
  (`apps/web/src/components/ui/cards/card-shell.ts:44`), une miniature `aria-hidden` en
  `aspect-[4/5]`. La case grattée, elle, ne bascule plus en miniature : elle rend la planche
  **entière**, qui porte sa propre lecture — en-tête, nom, pied, sceau de rareté et score —, posée
  en `h-auto w-full` : c'est la largeur de la case qui la dimensionne. Un **bandeau de 16 px**,
  à l'intérieur de la case et au-dessus de la planche, garde la marque `Jumelé` et la distance de
  Manhattan hors de la gravure. Le tableau du ticket se montre **`grid-cols-4` à toute largeur**,
  avec des cases en **`aspect-[3/5]`** : le nombre de colonnes est la géométrie du domaine
  (`index = ligne * 4 + colonne`) dont dépend la pastille de distance de Manhattan, donc jamais
  une décision responsive ; `packages/e2e` assert quatre colonnes distinctes et quatre lignes
  distinctes. Aucun texte visible ne descend sous **10 px**. Sous
  `@container (max-width: 110px)`, la classe `.plate-optional` retire la densité seconde — l'unité
  `pts`, le code de référence d'une région ou d'une commune, les occurrences d'une rue —, de sorte
  que le nom, le score et le sceau tiennent toujours dans la planche ; le pied d'une rue porte
  désormais son score, et son nom a un plancher de 10 px. Le budget de ≤ 18 nœuds non-SVG
  s'applique à une planche qui rend sa structure complète : aucune légende n'a été ajoutée, donc
  le budget est inchangé. La charge utile de révélation porte `blasonUrl` et
  `blasonCredit`, remplis par les deux constructeurs — `routes/tickets.ts` pour la réponse de
  grattage, `loadMaskedTicket` de `services/ticket.ts` pour la lecture persistée — et le repli
  `blason_url ?? contour_url` n'a qu'un propriétaire, l'aide `blasonOf`, partagée par
  `resolveCardAssets` et `resolveCardMeta`.

### 4.10 Installation — manifeste, icônes, service worker

- **Le manifeste est un fichier statique** : `apps/web/public/manifest.webmanifest`, lié depuis
  `index.html`. `vite-plugin-pwa` est configuré avec `manifest: false` et ne le génère pas.
  `background_color` et `theme_color` valent `#0c1210` (la pièce du cabinet) ; `display` est
  `standalone`, l'orientation `portrait`.
- **Les icônes sont générées, jamais dessinées.** `apps/web/pwa-assets.config.ts` dérive
  `minimal2023Preset` du favicon hexagonal vers `public/icons/` (64, 192, 512, maskable 512,
  apple-touch 180). Le générateur écrit à côté de l'image source et n'offre pas de dossier de
  sortie : `assetName` préfixe `icons/`. Les PNG sont **versionnés** ; `bunx pwa-assets-generator`
  depuis `apps/web` est l'unique commande de régénération, et le build Docker n'a besoin
  d'aucun réseau.
- **Le service worker ne cache jamais l'API.** Cinq entrées `NetworkOnly` couvrent `/api/`, une
  par méthode HTTP : une entrée Workbox ne s'applique qu'à une seule méthode, et `POST` porte
  toutes les mutations Eden. `/blasons/` est en `StaleWhileRevalidate` (200 entrées, 30 jours),
  le reste de `dist/` en précache.
- **`navigateFallback: '/index.html'` exige `index.html` dans le précache** — `globPatterns`
  contient donc `html`. Sans cette entrée, `createHandlerBoundToURL('/index.html')` lève
  `non-precached-url` à l'installation : le worker ne s'active pas et le navigateur refuse
  l'installation.
- **La mise à jour est proposée, pas imposée.** `registerType: 'prompt'`, `skipWaiting: false`,
  `clientsClaim: false`. `apps/web/src/lib/pwa.ts` porte l'enregistrement et
  `components/layout/pwa-update-prompt.tsx` l'invitation française (« Recharger » / « Plus
  tard »), montée par `app-shell.tsx`. Ce composant peut utiliser `useState` : il ne pilote pas
  le canvas de grattage (§4.6).
- `biome.json` exclut `apps/web/dev-dist`, `**/sw.js` et `**/workbox-*.js` : le code Workbox
  généré n'est pas du code source. `.gitignore` exclut `apps/web/dev-dist`.
- **La preuve est `packages/e2e/tests/pwa.spec.ts`, 7 cas**, joués par le seul projet `pwa`
  (`serviceWorkers: 'allow'`, commutateur Chrome `--ignore-certificate-errors`). Le cas
  « le worker s'installe et contrôle » constate d'abord `controller === null` sur le premier
  chargement : `clientsClaim: false` impose un rechargement avant que `controller` soit non nul.
  Le cas 7 est une assertion **structurelle** — `env(safe-area-inset-*)` vaut toujours `0` sous
  Playwright, une mesure ne prouverait rien ; il vérifie que les déclarations survivent à la
  compilation et que `viewport-fit=cover` est présent.

---

## 5. Arborescence

```text
apps/
  api/                Elysia, Kysely, Better Auth, Eden (type export)
  web/                React, TanStack, Tailwind, Eden client
packages/
  shared/             formules pures, rareté, constantes
  db/                 schéma Kysely, migrations, codegen
  spec/               tests de spécification (source de vérité)
scripts/
  import/             pipeline Open Data
Dockerfile            image unique : cibles deps, dev, build, prod
.docs/
  01-architecture.md  ce fichier
  02-database.md      schéma SQL + types Kysely
  03-active-task.md   tâche en cours (ordres du jour)
```

---

## 6. Commandes (toujours via Docker)

```sh
./scripts/bootstrap.sh

docker compose --profile tools run --rm dev bun install
docker compose --profile tools run --rm dev bun run lint
docker compose --profile tools run --rm dev bun run typecheck
docker compose --profile tools run --rm dev bun run test
docker compose --profile tools run --rm dev bun run db:migrate
docker compose --profile tools run --rm dev bun run build
docker compose --profile tools run --rm dev bun run ci:check
```

Services : web `http://localhost:5174` (ou `http://<IP-LAN>:5174`, l'API étant alors relayée par Vite), API `http://localhost:3000`, OpenAPI `http://localhost:3000/api/docs`. En production, une seule origine : `http://localhost:${WEB_HOST_PORT:-8080}`.

`ci:check` enchaîne lint, typecheck, ping PostgreSQL et spécifications ; il exige
`TEST_DATABASE_URL` et refuse `NODE_ENV=production` (voir §4.8).

### 6.1 Topologie réseau Docker (durcissement)

Deux topologies, volontairement différentes : **deux conteneurs applicatifs en
développement** (API + Vite pour le HMR), **un seul en production** (l'API sert le
SPA).

#### Développement — `compose.yml`

Trois réseaux :

| Réseau | Type | Rôle | Services rattachés |
| :--- | :--- | :--- | :--- |
| `frontend` | bord (`internal` absent) | accessible depuis le LAN via les ports publiés ; donne accès à Internet | `web`, `api`, `dev` |
| `backend` | interne (`internal: true`) | aucune route vers l'extérieur, aucun port publié ; isole PostgreSQL | `db`, `api`, `dev`, `pgadmin` |
| `admin` | pont, réservé aux outils | permet à Docker de publier des ports (impossible depuis un réseau `internal`), toujours liés à `127.0.0.1` | `db`, `pgadmin` |

Règles :

- **Seuls `web` (5174), `api` (3000) et, en développement, `db` (5432) / `pgadmin` (5050) sont publiés.** Les deux derniers sont liés à `127.0.0.1` **et** `::1` (boucle locale IPv4 + IPv6, car `localhost` résout souvent uniquement en `::1`) : joignables depuis la machine hôte, jamais depuis le LAN. `POSTGRES_BIND=0.0.0.0` permet de les ouvrir au réseau, ce qui est déconseillé.
- `api` est sur les deux réseaux : il joint `db` (backend) et est joint par `web` (frontend).
- `dev` (profil `tools`) est sur les deux réseaux : il a besoin de `db` pour `db:migrate` **et** d'Internet pour `bun install`.
- `web` est sur `frontend` uniquement : il n'a aucune raison d'atteindre directement PostgreSQL.
- `pgadmin` (profil `admin`) est sur `backend` pour joindre `db` et sur `admin` pour être publié.

Cette séparation est un choix de développement, pas un reste de l'ancienne pile :
le serveur Vite n'existe qu'en dev, et les deux services (`api`, `web`) sont bâtis
depuis le `Dockerfile` racine, `target: dev`.

#### Production — un seul conteneur de bord

`docker-compose.prod.yml` n'a que deux services : `db` sur le réseau `backend`
(`internal: true`) et `api`, unique service publié. Le conteneur `web` et son
`apps/web/nginx.conf` ont disparu.

| Service | Image | Réseaux | Port |
| :--- | :--- | :--- | :--- |
| `api` | `Dockerfile`, `target: prod` | `backend` + `public` | `${WEB_HOST_PORT:-8080}` → `3000` |
| `db` | `postgres:16-alpine` | `backend` | aucun |

`api` porte les deux réseaux pour une raison mécanique : un service rattaché au
seul réseau `internal` ne peut pas publier de port. Le port publié est celui du
SPA et de l'API, servis par la même origine ; `db` reste invisible de l'extérieur.

Le `Dockerfile` racine décrit quatre étapes :

| Étape | Rôle |
| :--- | :--- |
| `deps` | manifestes des workspaces + `bun install --frozen-lockfile` |
| `dev` | image partagée des deux services de développement |
| `build` | build API, build web, `packages/db/src/migrate.ts` groupé en `dist-db/migrate.js` |
| `prod` | `oven/bun:alpine`, `dist/index.js` + `db-migrate.js` + `apps/web/dist` dans `/app/public` |

L'étape `prod` tourne en `USER bun`, déclare
`ENV WEB_DIST_DIR=/app/public SERVE_WEB=true` et un `HEALTHCHECK` avec
`--start-period=30s` (le temps des migrations). Aucun `node_modules` n'est copié :
le bundle API est autonome.

#### Servir le SPA depuis l'API — `apps/api/src/static.ts`

Le plugin `webRoutes(root)` enregistre une route attrape-tout qui sert les
fichiers de `WEB_DIST_DIR` et retombe sur `index.html` **uniquement** pour une
navigation. Il reprend ce que faisait Nginx, sans Nginx.

- `/api`, `/api/*` et `/blasons/*` **ne retombent jamais sur du HTML** : ces
  chemins répondent `404` avec le corps JSON `ROUTE_NOT_FOUND`.
- **Exception obligatoire — `/api/auth/*` est délégué à Better Auth.** Better Auth
  est monté par `app.mount(auth.handler)`, ce qu'Elysia enregistre comme une route
  `ALL /*`. Une route `GET /*` étant plus spécifique par la méthode, elle capterait
  les lectures de session (`GET /api/auth/get-session`) : l'inscription réussirait
  mais l'application resterait bloquée sur l'écran de connexion. `webRoutes` reçoit
  donc le handler d'authentification et lui rend explicitement les chemins
  `/api/auth/*`. Ne jamais retirer cette délégation sans rejouer le parcours E2E.
- Cette exclusion est **vérifiée dans le handler, pas par l'ordre des routes**.
  Le repli SPA est une décision prise requête par requête, pas une position dans
  la pile : un `GET /api/v1/healths` mal orthographié doit rendre un 404 JSON, et
  non `index.html` (le client Eden parserait du HTML comme du JSON et l'erreur
  deviendrait incompréhensible). La garde reste donc vraie quel que soit l'ordre
  d'enregistrement des plugins, y compris si le montage du SPA passe avant les
  modules métier.
- Le chemin est filtré comme dans `routes/blasons.ts` : refus des `..`, des
  antislashes, des chemins absolus, des segments `.` ou vides, puis revérification
  du préfixe avec `resolve()`. Seules les extensions d'une liste blanche sont
  servies.
- `apps/api/src/env.ts` ajoute `WEB_DIST_DIR` (défaut `./public`) et `SERVE_WEB`
  (`'true' | 'false'`, optionnel). Le SPA est servi si `SERVE_WEB=true` **ou** si
  `NODE_ENV=production` : l'image de production n'a donc rien à recevoir en plus,
  et un conteneur de dev reste sur l'API seule.
- `apps/api/src/app.ts` expose `createApp(options?: { webDistDir?, serveWeb? })`
  en plus de `app` et du type `App` inchangés. Un gestionnaire global de
  « not found » rend un 404 JSON (`ROUTE_NOT_FOUND`) **en développement aussi** :
  un chemin inconnu ne renvoie plus jamais du HTML.

Politique de cache, portée par le plugin :

| Chemin | `Cache-Control` | Justification |
| :--- | :--- | :--- |
| `/assets/*` | `public, max-age=31536000, immutable` | noms hachés par Vite, contenu immuable |
| `index.html` | `no-cache` | doit pointer vers les nouveaux hashs à chaque déploiement |
| le reste | `public, max-age=0, must-revalidate` | revalidation systématique |

Chaque réponse porte un ETag faible `W/"<taille>-<mtime>"` et honore `If-None-Match`
par un `304 Not Modified`. Le plugin ajoute enfin
`X-Content-Type-Options: nosniff` et `Referrer-Policy:
strict-origin-when-cross-origin`, deux en-têtes auparavant fournis par Nginx.

Comportement couvert par `packages/spec/src/static.spec.ts` (11 cas, libellés
`Archi §6.1 — `) avec des fixtures versionnées dans
`packages/spec/fixtures/web-dist/`.

#### Compression — `apps/api/src/lib/compression*.ts`

La suppression de Nginx a retiré la seule couche gzip/brotli de la pile : l'API compresse
désormais elle-même, dans le processus, sur deux chemins distincts — le JSON par un hook
global, les fichiers texte par `static.ts` et `routes/blasons.ts`. Trois modules portent la
politique : `apps/api/src/lib/compression.ts` (fonctions pures, sans état ni entrée-sortie),
`compression-cache.ts` (cache borné) et `compression-plugin.ts` (hook JSON). `apps/api` ne
déclare **aucune** dépendance de compression : `node:zlib` et `Bun.gzipSync` sont des builtins.

- **Négociation.** `Accept-Encoding` est analysé avec ses q-values ; `br` l'emporte à qualité
  égale, `gzip` sert de repli, `q=0` exclut le codec, le jeton `identity` ne produit aucune
  compression. Les q-values sont bornées à `[0, 1]` : `q=7` ne doit pas battre `q=1` et faire
  choisir un autre codec. Brotli vient de `node:zlib.brotliCompressSync` en qualité 5 (Bun
  n'expose pas de brotli natif), gzip de `Bun.gzipSync`.
- **Seuil.** `COMPRESSION_MIN_BYTES = 1024`. En dessous, l'en-tête et le dictionnaire coûtent
  plus que le gain : le `null` de 4 octets rendu par `/api/auth/get-session` part verbatim,
  et `index.html` (1 527 octets) franchit le seuil pour descendre à 652. Le seuil, pas une
  liste d'exceptions, décide.
- **Types compressibles.** `text/*`, `application/javascript`, `application/json`,
  `application/manifest+json`, `application/xml`, `image/svg+xml`. Jamais `png`, `webp`,
  `woff2`, `woff` ni `ico`, déjà compressés par leurs formats.
- **`Vary`.** `Vary: Accept-Encoding` est posé sur **les deux** variantes, compressée et
  identité, et jamais écrasé : `appendVary` fusionne avec ce que le CORS a déjà inscrit. Sur
  une réponse statique compressée, la dimension `Origin` est réajoutée explicitement, parce
  que `cors` écrit `Vary: Origin` dans son propre `onAfterHandle`, qui n'atteint jamais un
  `Response` construit à l'intérieur du handler de route ; sans elle, un cache partagé
  pourrait servir l'`Access-Control-Allow-Origin` d'une origine à une autre.
- **ETag.** `W/"<taille>-<mtime>"`, **faible à dessein** : un validateur faible désigne des
  représentations sémantiquement équivalentes, ce qui est exactement le rapport gzip /
  identité ; un validateur fort partagé entre codages violerait la RFC 9110. Un `304` ne porte
  aucun corps et **jamais** de `Content-Encoding`.
- **`HEAD`.** Court-circuité avant la négociation : pas de corps, donc pas d'encodage.
- **JSON.** Un unique hook `onAfterHandle` global, monté dans `createApp` avant les modules de
  routes ; `as: 'global'` porte jusque dans les plugins (`/api/v1/import-status` le prouve, y
  compris sur son `401`, puisque la route exige désormais une session).
  Le hook tamponne un corps JSON de forme `Response`, et doit donc rendre les octets tamponnés
  dans une `Response` neuve **même lorsqu'il renonce à compresser** : retourner `undefined`
  après avoir lu le corps fait réémettre à Elysia un flux déjà consommé
  (`TypeError: Body object should not be disturbed or locked`). Les en-têtes sont reconstruits
  par `append`, jamais par `set`, pour qu'un `Set-Cookie` répété survive.
- **Handlers Better Auth montés.** Le hook tourne aussi sur `app.mount(auth.handler)`, qui
  n'est donc pas un contournement : mesuré, `/api/auth/get-session` répond `200` avec
  `Vary: Origin`. Sa charge pesant 4 octets, c'est le seuil qui l'exclut, pas une exception.
- **Cache.** 64 entrées, clé `${chemin absolu}\0${taille}\0${mtime}\0${encodage}`, éviction
  FIFO. La lecture du fichier se fait **dans** la fermeture de calcul : un succès de cache ne
  coûte aucune entrée-sortie disque. Le `mtime` dans la clé invalide à chaque déploiement.
- **Mesures sur l'image de production.** Bundle principal ≈ `461` Ko bruts → ≈ `139` Ko en
  gzip ; `index.html` `1 527` → `652`.
- Vérifié par `packages/spec/src/compression.spec.ts` (14 cas).

#### Accès psql (développement)

```sh
# Depuis l'intérieur du réseau Docker (aucun port publié nécessaire)
docker compose exec db psql -U hexamap -d hexamap

# Depuis l'hôte, avec le client de son choix (DBeaver, psql, pgAdmin)
psql postgres://hexamap:hexamap@127.0.0.1:5432/hexamap
```

Interface web d'administration :

```sh
docker compose --profile admin up -d pgadmin   # http://localhost:5050
```

---

## 7. Où écrire quoi

| Information | Fichier |
| :--- | :--- |
| Règles du jeu, stack, décisions durables | `.docs/01-architecture.md` |
| Tables, colonnes, index, types Kysely | `.docs/02-database.md` |
| Tâche du jour, prochaines étapes, journal | `.docs/03-active-task.md` |
| Comportement attendu et exemples chiffrés | `packages/spec` |
| Règles locales d'un dossier | `AGENTS.md` du dossier |
