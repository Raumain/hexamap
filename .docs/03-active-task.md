# 03 — Tâche active

> **Seul fichier à modifier pour donner les ordres du jour.**
> L'agent lit ce fichier en début de session, exécute la tâche, puis met à jour le statut et le journal.

---

## Statut

- **Phase** : 5 — API cœur (Tickets, Collection, Référentiels)
- **État** : Terminé
- **Priorité** : P0
- **Mis à jour** : 2026-11-15
- **Branche conseillée** : `feat/phase-5-core-api`

---

## Objectif

Créer les routes métier protégées par l'authentification pour gérer la génération de tickets, la mécanique de grattage sécurisée, et la consultation de la collection du joueur.

À la fin de cette tâche :
- Un joueur peut générer un ticket à gratter (avec la Pépite, les panneaux et les routes répartis aléatoirement).
- Le joueur peut gratter une case via une transaction sécurisée.
- L'API ne renvoie **jamais** les cases non grattées au client (anti-triche).
- Le joueur peut consulter ses cartes et ses statistiques.
- Les schémas de réponse TypeBox sont stricts pour que le frontend (Eden Treaty) soit parfaitement typé.

---

## À lire avant de coder

1. `.docs/01-architecture.md` (Sections 5.4, 5.5 et 5.6 pour la logique de tirage et de grattage).
2. Le middleware d'authentification créé en Phase 4 (`authPlugin`).

---

## Étapes

### 1. Routes Référentiels (`apps/api/src/routes/ref.ts`)
- [x] Créer `GET /api/v1/ref/regions`, `departements`, `communes`, `odonymes` pour l'autocomplétion.

### 2. Routes Tickets (`apps/api/src/routes/tickets.ts`)
- [x] `POST /api/v1/tickets` : Génère une grille de 16 cases en base selon les règles (1 pépite, 2 jumelés, 3 panneaux, 10 routes). Révèle immédiatement une case classique.
- [x] `GET /api/v1/tickets/current` : Renvoie le ticket actif (`status = 'ACTIVE'`). Ne renvoie **que** les cases déjà révélées via `ticket_reveals`.
- [x] `POST /api/v1/tickets/:id/scratch` : Reçoit `cellIndex`. Utilise `db.transaction()` et `.forUpdate()` pour empêcher le double-clic.
- [x] Logique de grattage : Décrémente `scrapes_remaining`, applique l'effet (carte ajoutée, bonus station, etc.), enregistre dans `ticket_reveals`. Si `scrapes_remaining === 0`, passe le ticket en `EXHAUSTED`.

### 3. Routes Collection (`apps/api/src/routes/cards.ts`)
- [x] `GET /api/v1/cards` : Liste les cartes du joueur (avec filtres optionnels).
- [x] `GET /api/v1/collection/stats` : Renvoie le nombre de cartes par rareté et par catégorie.

### 4. Typage Eden (TypeBox)
- [x] Sur toutes les routes, définir le champ `response:` avec `t.Object(...)` pour typer précisément ce que le client reçoit.

### 5. Qualité
- [x] `bun run typecheck`
- [x] `bun run lint`
- [x] Écrire les tests d'intégration dans `packages/spec/src/tickets.spec.ts` (vérifier l'anti-triche et le forUpdate).

---

## Critères d'acceptation
1. Un `console.log` de la réponse API côté client d'un ticket actif ne montre aucune donnée sur les cases non grattées.
2. Le grattage d'une case déjà grattée renvoie une erreur HTTP 409.
3. Les transactions Kysely empêchent deux requêtes simultanées de gratter 2 fois avec 1 seul coup restant.
4. Les types `Eden` sont disponibles et stricts.

---

## Interdits
- Ne jamais envoyer l'objet `grid` complet ou `treasure_index` dans le JSON de retour.
- Ne pas coder la logique de scoring des tableaux (Phase 8), se limiter à la gestion brute des tickets et de l'inventaire.

---

## Journal

### 2026-11-15 — Spec tickets, collection et référentiels + vérification

**Fichiers créés**
- `packages/spec/src/tickets.spec.ts` — 14 tests d'intégration (Bun + `app.handle` + Kysely sur PostgreSQL réel), jeu de référence seedé préfixé (`crypto.randomUUID().slice(0, 8)`), nettoyé en `afterAll` dans l'ordre FK.

**Conception**
- **Transaction / `forUpdate`** : le grattage s'exécute dans `db.transaction().execute(async (trx) => …)` avec `SELECT … FOR UPDATE` sur la ligne du ticket, ce qui sérialise deux grattages concurrents. Le test « deux grattages concurrents avec 1 coup restant » le prouve : exactement un 200 et un 409, `status = EXHAUSTED`, `scrapes_remaining = 0`, une seule nouvelle ligne `ticket_reveals`.
- **Anti-triche (masquage)** : `grid` et `treasure_index` ne remontent jamais ; seules les cases révélées (`ticket_reveals`) sont exposées (`kind`, `nom`, `card`, `distance`), les autres restent `null`. Le test vérifie l'absence de fuite dans le texte brut (`treasure_index`, `"grid"`, `grid:`) **et** la présence des colonnes côté serveur (masquage, pas absence).

**Résultats**
- `bun test packages/spec` : 60 tests, 60 pass, 0 fail (dont 14 nouveaux).
- `bun run --cwd packages/spec typecheck` : OK.
- `bun run --cwd apps/api typecheck` : OK.
- `bun run lint` : OK.

**Écarts connus (conservés)**
1. Transactions Kysely sous la forme `db.transaction().execute(cb)` (API callback, cohérente dans tout `ticket.ts`).
2. Les plugins de routes (`tickets`, `cards`, `ref`) re-déclarent `.use(authPlugin)` alors que `protectedRoutes` le fait déjà au niveau du groupe : redondance inoffensive, laissée en place (le retrait propre imposerait de vérifier la portée `scoped` des `derive`/`onBeforeHandle`).

Aucun bug d'API trouvé : seuls des ajustements de formatage (longueur de ligne, ordre d'imports) ont été nécessaires côté spec.

### 2026-11-15 — Durcissement post-revue (Phase 5)

- `POST /api/v1/tickets` : violation d'unicité Postgres (`23505` sur `tickets_one_active_per_user`) mappée en 409 `TICKET_ALREADY_ACTIVE` (plus de 500 en cas de création concurrente).
- Schémas de réponse stricts : `additionalProperties: false` sur les payloads masqués (ticket/cell/card) et cartes.
- Validation de la grille : `parseGrid` exporté depuis `services/ticket.ts` (anti-corruption, `TICKET_CORRUPTED` en 503) et réutilisé dans `routes/tickets.ts`.
- RNG injecté (`pickIndex`) pour le tirage adjacent BELVEDERE ; assertion anti-fuite (`treasure_index`/`grid`) ajoutée sur la réponse brute du grattage.
- Vérification : 60 tests / 0 fail, typecheck api+spec OK, lint OK, build api OK.
