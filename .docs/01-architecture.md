# 01 — Architecture, stack et règles du jeu

> **Source de vérité produit et technique.**
> À lire avant toute implémentation. En cas de contradiction avec un autre document, ce fichier gagne.
> Dernière mise à jour : 2026-11-15.

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

### 2.7 Rareté inversée des rues

Les petits villages ont souvent des noms de rues uniques (`N = 1`, 3 000 pts), tandis que les grandes villes ont des rues génériques. Une petite commune bien associée à sa rue unique peut rivaliser avec une métropole. C'est une mécanique centrale, pas un détail.

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
- **Serveur autoritaire** : le tirage, la position de la Pépite, les récompenses et la validation des combos sont décidés côté serveur.
- **Pas d'appel externe au runtime** : les API gouvernementales sont utilisées uniquement par le pipeline d'import.

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
- **Le navigateur ne parle qu'à l'origine du web.** Le client Eden est initialisé sur `window.location.origin` (`treaty(window.location.origin)`) : les requêtes partent vers `<origine>/api/...`, donc sur le même host et le même port que le front, quelle que soit l'adresse d'accès (localhost ou IP LAN). **Ne jamais passer une chaîne vide** : Eden la préfixe par `https://` et produit `https://api/v1/health`, où `api` devient le nom de domaine. En dev, **Vite relaye `/api` vers l'API Docker** (`server.proxy` → `API_INTERNAL_URL`, par défaut `http://api:3000`). Aucune URL absolue `localhost:3000` ne doit fuiter côté navigateur.
- Les composants sont en français, accessibles (rôles, labels, `aria-live`), et stylés avec Tailwind.
- Les libellés réutilisables sont centralisés dans `apps/web/src/content/`. Pas de dépendance i18n.

### 4.6 Règle stricte du Canvas

**Interdiction d'utiliser l'état React pour piloter le Canvas de grattage.**

- Le Canvas (ou la surface de grattage) est piloté par un contrôleur impératif : `ref`, `requestAnimationFrame`, événements natifs.
- L'état React ne sert qu'aux transitions grossières : ticket chargé, case révélée, ticket épuisé, erreur.
- Ne pas déclencher de re-render React à chaque mouvement de souris/doigt.
- La révélation d'une case est une mutation serveur ; le Canvas ne fait qu'afficher le résultat.

### 4.7 Données Open Data

- Sources : `geo.api.gouv.fr`, Base Adresse Nationale / FANTOIR, IGN / Etalab, Wikidata.
- Import unique et rejouable, en streaming, avec reprise et mode `--lite` pour le développement.
- Normalisation des odonymes : majuscules, suppression des accents, tirets/apostrophes remplacés par des espaces, espaces compactés.
- Conserver le nom d'affichage original pour la carte.
- Documenter l'attribution des sources.

### 4.8 Tests

- `packages/spec` contient les tests issus du GDD. Une PR d'implémentation ne modifie pas les specs.
- Tests unitaires : formules, paliers, normalisation, distance, multiplicateurs.
- Tests statistiques : RNG injecté et seedé pour être déterministes.
- Tests d'intégration : vrai PostgreSQL, schéma isolé par worker.
- E2E : Playwright, sélecteurs par rôle et libellés français.

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
```

Services : web `http://localhost:5174` (ou `http://<IP-LAN>:5174`, l'API étant alors relayée par Vite), API `http://localhost:3000`, OpenAPI `http://localhost:3000/api/docs`.

### 6.1 Topologie réseau Docker (durcissement)

Trois réseaux, définis dans `compose.yml` :

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

Accès psql :

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
