# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

## Statut

- **Phase** : 6 — Frontend socle (Vite, React, TanStack, Eden)
- **État** : Terminée (à valider manuellement)
- **Priorité** : P0
- **Mis à jour** : 2026-11-15
- **Branche conseillée** : `feat/phase-6-frontend-socle`

---

## Objectif

Initialiser l'application frontend dans `apps/web` avec Vite, React, TailwindCSS et l'écosystème TanStack. Connecter les clients Better Auth et Eden Treaty, puis implémenter les pages d'authentification (Inscription / Connexion) 100 % en français.

À la fin de cette tâche :
- Le frontend démarre et communique avec l'API.
- Eden Treaty auto-complète les appels API dans le code React.
- L'utilisateur peut s'inscrire, se connecter et être redirigé vers un tableau de bord vide.
- Aucune librairie d'internationalisation (i18n) n'est installée.

---

## À lire avant de coder

1. `.docs/01-architecture.md` (Sections 2 et 6 pour Eden Treaty et le parti-pris "Français uniquement").

---

## Étapes

### 1. Initialisation Vite & Dépendances
- [x] Configurer Vite + React + TypeScript dans `apps/web`.
- [x] Installer TailwindCSS et configurer `tailwind.config.js` / `index.css`. — Tailwind v4 via `@tailwindcss/vite` : pas de `tailwind.config.js`, tout vit dans `src/styles.css` (`@import "tailwindcss";`).
- [x] Installer `@tanstack/react-router`, `@tanstack/react-query`, `@tanstack/react-form`.
- [x] Installer `@elysiajs/eden` et `@better-auth/react`. — Paquets réels : `@elysia/eden` et `better-auth` (le client React est l'entrée `better-auth/react`).

### 2. Clients API & Auth (`apps/web/src/lib/`)
- [x] Créer `api.ts` pour initialiser Eden Treaty : importer **uniquement les types** (`import type { App }`) depuis `apps/api` et instancier `treaty<App>()`.
- [x] Créer `auth.ts` pour initialiser `createAuthClient()` de Better Auth pointant vers l'URL de l'API.

### 3. Routage et Layout
- [x] Configurer TanStack Router (provider et arbre de routes).
- [x] Créer un layout principal (Header avec état de connexion, Footer simple).

### 4. Pages d'authentification
- [x] Créer `/login` (Connexion par email/mot de passe).
- [x] Créer `/register` (Inscription avec email, mot de passe et `pseudo`).
- [x] Gérer les redirections (redirection vers `/` si déjà connecté).
- [x] Rédiger tous les textes, labels et messages d'erreur strictement en français.

### 5. Qualité
- [x] `bun run typecheck` dans `apps/web` (vérifier que TypeScript trouve bien les types backend).
- [x] `bun run lint`

---

## Critères d'acceptation
1. Le client Eden Treaty est parfaitement typé (les paramètres et réponses des routes API s'autocomplètent).
2. Le code backend n'est pas inclus dans le bundle web (vérifiable par l'usage exclusif de `import type`).
3. Les formulaires utilisent TanStack Form avec des validations simples.
4. L'UI d'inscription/connexion est fonctionnelle et crée de vraies sessions en base via Better Auth.
5. Toute l'interface est en français.

---

## Commandes
```sh
docker compose --profile tools run --rm dev bun run --cwd apps/web typecheck
```

## Interdits
- Ne jamais faire un import classique du serveur (import { app } from '@hexagone/api').
- N'installer aucune librairie comme i18next ou react-intl.

---

## Journal

### 2026-11-15 — Phase 6 : frontend socle

- **État** : implémenté, gates verts dans Docker (`apps/web typecheck`, `apps/api typecheck`, `biome check`, `vite build` → `EXIT=0`). Reste la validation manuelle du parcours inscription → session → `/api/v1/me`.
- **Créés** : `apps/web/src/lib/auth.ts`, `apps/web/src/lib/session.ts`, `apps/web/src/components/{text-field,button,form-error}.tsx`, `apps/web/src/routes/{login,register}.tsx`.
- **Modifiés** : `apps/web/src/lib/api.ts` (Eden typé + `credentials: 'include'`), `apps/web/src/routes/{__root,index}.tsx` (header session, tableau de bord vide), `apps/web/src/vite-env.d.ts` (`VITE_API_URL`), `apps/web/package.json` (`better-auth`), `apps/api/package.json` (export `./auth` — type uniquement), `bun.lock`.
- **Routes** : `/`, `/login`, `/register` ; `routeTree.gen.ts` régénéré par `tsr generate`, jamais édité à la main.
- **Écarts assumés** :
  1. `@better-auth/react` n'existe pas comme paquet : `createAuthClient` vient de `better-auth/react`, avec `inferAdditionalFields<typeof auth>()` pour typer `pseudo` et `currency` côté client.
  2. Import de type via l'alias workspace `@hexamap/api/app` (≡ `apps/api/src/app.ts`) plutôt qu'un chemin relatif, conformément à `apps/web/AGENTS.md`. Aucun import de valeur du serveur (0 occurrence sous `apps/web/src`).
  3. URL de base Eden = `import.meta.env.VITE_API_URL || window.location.origin` : pas de `localhost:3000` en dur, le proxy Vite `/api` et l'accès LAN restent valides.
  4. Textes français écrits en dur dans le JSX ; aucun fichier JSON de traduction, `src/content/` non créé.
  5. Branche : travail laissé sur `feat/phase-5-core-api` (arbre déjà modifié par la phase 5). À basculer sur `feat/phase-6-frontend-socle` avant tout commit.
- **Reste à faire** : test manuel du parcours d'authentification ; découpage du bundle principal (596 kB, avertissement Vite non bloquant).
