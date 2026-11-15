# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

## Statut

- **Phase** : 4 — Authentification robuste (Better Auth)
- **État** : **Terminé** (config, plugin Elysia, migration `rateLimit`, tests spec verts)
- **Priorité** : P0
- **Mis à jour** : 2026-11-15
- **Branche conseillée** : `feat/phase-4-auth-robust`

---

## Objectif

Finaliser la configuration de Better Auth dans l'API et créer un plugin/middleware Elysia réutilisable pour protéger les routes du jeu. Écrire les tests de spécification pour valider les accès.

À la fin de cette tâche :
- Les utilisateurs peuvent s'inscrire avec un email, un mot de passe et un `pseudo` obligatoire.
- Le champ `currency` est initialisé à 0 à la création du compte.
- Les CORS sont strictement configurés.
- Un plugin Elysia `.derive()` permet d'extraire la session facilement sur n'importe quelle route.
- Les tests spec (inscription, connexion, accès refusé) passent.

---

## À lire avant de coder

1. `.docs/01-architecture.md` (Section 3 - Authentification).
2. L'instance existante dans `apps/api/src/auth.ts`.

---

## Étapes

### 1. Configuration Better Auth (`apps/api/src/auth.ts`)
- [x] Ajouter `emailAndPassword: { enabled: true }`.
- [x] Configurer `user.additionalFields` pour inclure `pseudo` (string, requis) et `currency` (number, default: 0, input: false).
- [x] Activer les cookies sécurisés si `NODE_ENV === 'production'`.
- [x] Configurer `trustedOrigins` avec l'URL du frontend (via variables d'environnement).
- [x] Activer le rate limiting en base de données (`rateLimit: { storage: "database" }`).
      → nécessite la table `rateLimit` : documentée dans `.docs/02-database.md`, migration `0005_rate_limit.ts`.

### 2. Middleware Elysia (`apps/api/src/middleware/auth.ts`)
- [x] Créer un plugin Elysia en utilisant `.derive()`.
- [x] Ce plugin doit appeler `auth.api.getSession({ headers: request.headers })`.
- [x] Si la session est invalide ou absente, renvoyer une erreur `401 Unauthorized`.
- [x] Si elle est valide, retourner `{ user, session }` pour que les routes suivantes puissent y accéder directement typées.
      → `derive` et `onBeforeHandle` portent `{ as: 'scoped' }` : sans cela, un hook de plugin reste local et ne protège pas les routes du groupe parent (vérifié).
      Le plugin est monté sur un groupe Elysia dédié (`protectedRoutes`, préfixe `/api/v1`) dans `app.ts`.

### 3. Tests de spécification (`packages/spec/src/auth.spec.ts`)
- [x] Écrire un test vérifiant qu'une requête sans cookie sur une route protégée renvoie 401.
- [x] Écrire un test d'inscription (`POST /api/auth/sign-up/email`) incluant le `pseudo`, vérifiant que le compte est créé.
- [x] Écrire un test vérifiant que la route protégée renvoie 200 avec les infos du `user` quand le cookie de session est fourni.
      → 7 tests au total : 401 sans cookie, `/health` public, inscription avec `pseudo`, inscription sans `pseudo` (4xx), `currency` client ignoré (0 en base), `/me` avec cookie, connexion par email.
      Aucun mock : `app.handle()` sur le vrai PostgreSQL, migration appliquée en `beforeAll`.

### 4. Qualité
- [x] `bun run typecheck`
- [x] `bun run lint`
- [x] `bun test packages/spec/src/auth.spec.ts`

---

## Critères d'acceptation
1. La création de compte exige un `pseudo` et renvoie une erreur s'il manque.
2. Le `currency` n'est pas modifiable par le client lors de l'inscription.
3. Le middleware `.derive()` bloque bien les requêtes non authentifiées avec un code HTTP 401.
4. Les tests d'authentification sont 100% au vert.

---

## Commandes
```sh
docker compose --profile tools run --rm dev bun test packages/spec/src/auth.spec.ts
```

---

## Journal

### 2026-11-15 — Phase 4 terminée
- `apps/api/src/auth.ts` : `pseudo` requis, `currency` en `input: false` + `defaultValue: 0`, `rateLimit: { storage: 'database' }`.
- `apps/api/src/middleware/auth.ts` : plugin `authPlugin` (`.derive({ as: 'scoped' })` + `.onBeforeHandle({ as: 'scoped' })`, 401 `{ code: 'UNAUTHORIZED', message: 'Non authentifié' }`).
- `apps/api/src/app.ts` : macro `auth` supprimée, `protectedRoutes` (`/api/v1`) monté sur `authPlugin`.
- `packages/db` : migration `0005_rate_limit.ts` (+ `migrator.ts`), `RateLimitTable` dans `schema.ts`, `runMigrations` exporté.
- `.docs/02-database.md` : table `rateLimit` documentée (statut, DDL, type Kysely).
- `packages/spec` : `auth.spec.ts` (7 tests, vrai PostgreSQL via `app.handle`), deps `@hexamap/api` + `@hexamap/db`.
- Vérifications Docker : `db:migrate` OK, `bun test packages/spec` → **46 pass / 0 fail**, `typecheck` OK, `lint` OK.




