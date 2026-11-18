# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

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
