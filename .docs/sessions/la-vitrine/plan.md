# Plan — Phase 29 · La Vitrine (profil public)

Source : `.docs/03-active-task.md` (entrée transmise par le lanceur), `.docs/01-architecture.md` §2.9,
`.docs/02-database.md` §4.9, §6, §7.1, `ROADMAP.md` §2 phase 29.

## Objectif

`GET /api/v1/players/:id` rend une projection **liste blanche** d'un joueur, et
`/players/:id` en est la salle. Une vitrine privée répond `404`, jamais `403`. Un blocage
masque la vitrine dans les deux sens. Le pseudo devient une identité publique : forme 3–24
caractères et unicité insensible à la casse, à l'inscription.

## Contrainte découverte avant d'écrire une ligne

Ce worktree part de `main` : **les phases 26, 27 et 28 n'y sont pas** (migrations arrêtées à
`0008`, aucune table `friendships`, `blocks`, `user_achievements`, `user_scratch_charges`, aucun
catalogue de médailles, `game_config` jamais lu). Le brief les annonce comme satisfaites ;
c'est faux dans cette branche.

Conséquence assumée : la phase livre son périmètre propre et **lit les dépendances
optionnelles** (médailles, amitiés, blocages) par une sonde de capacité (`to_regclass`), de
sorte que :

- dans cette branche, sans les tables, la vitrine répond quand même (médailles vides,
  `friendState: null`, aucun blocage) ; le contrôle d'ami est alors **absent** de la salle,
  jamais un bouton inerte ;
- une fois 27 et 28 fusionnées, le même code les sert sans modification.

Aucune table des phases 27/28 n'est créée ici : leurs migrations leur appartiennent
(`0009`, `0010`, `0011`). Les critères 4 (blocage) et 6 (médailles + bouton d'ami) ne peuvent
donc pas être cochés dans cette branche ; ils sont écrits dans le code et expliqués dans
`journal.md`.

## Phases

| # | Phase | Contenu | Fichiers |
| :- | :--- | :--- | :--- |
| 1 | Spec rouge | Cas de spécification écrits et vus rouges | `packages/spec/src/profile.spec.ts` |
| 2 | Données | Migration `0012_profiles`, enregistrement, types Kysely | `packages/db/migrations/0012_profiles.ts`, `packages/db/src/migrator.ts`, `packages/db/src/schema.ts` |
| 3 | Identité | Validation + unicité du pseudo à l'inscription | `apps/api/src/auth.ts` |
| 4 | API | Service de projection, `GET /players/:id`, `PATCH /profile`, montage | `apps/api/src/services/profile.ts`, `apps/api/src/routes/players.ts`, `apps/api/src/routes/profile.ts`, `apps/api/src/app.ts` |
| 5 | Salle | Route, client, libellés, salon | `apps/web/src/lib/player-profile.ts`, `apps/web/src/content/player-profile.ts`, `apps/web/src/routes/players.$playerId.tsx`, `apps/web/src/components/layout/nav-items.ts`, `DESIGN_SYSTEM.md` |
| 6 | Preuve | `ci:check` vert, `review.md`, commits, PR | — |

## Décisions techniques

1. **Liste blanche à deux étages.** Le service ne sélectionne que les colonnes autorisées
   (jamais `selectAll` sur `user`), et le schéma TypeBox de réponse porte
   `additionalProperties: false`. Un champ ajouté plus tard à `user_cards` ne peut pas fuiter.
2. **`404` unique.** Compte inconnu, vitrine privée et compte bloqué rendent le même
   `404 PLAYER_NOT_FOUND` : rien ne distingue « privé » de « inexistant ».
3. **Ordre des lectures.** Le blocage est vérifié **avant** toute lecture de contenu ; le
   profil privé est vérifié avant les compteurs. Aucune requête de collection n'est lancée
   pour un joueur masqué.
4. **Route publique à session optionnelle.** `authPlugin` est tout-ou-rien : `/players/:id`
   vit sur `publicRoutes` et dérive le lecteur par `auth.api.getSession`, sans exiger de
   session. Le bouton d'ami a besoin du lecteur, pas la vitrine.
5. **Complétude.** `count(distinct ref_code)` par catégorie ; dénominateurs 18 (régions) et
   101 (départements) figés par le GDD, comptés depuis `ref_communes` et `ref_odonymes` pour
   les deux autres catégories.
6. **Meilleur tableau** calculé par les fonctions partagées (`packages/shared/src/tableau.ts`),
   jamais réimplémenté : aucune formule dupliquée dans le service.
7. **Sonde de capacité** pour `friendships`, `blocks`, `user_achievements` : une seule
   vérification `to_regclass` par table et par processus, documentée comme transitoire.
8. **Pseudo.** Validation de forme dans un `databaseHooks.user.create.before` Better Auth
   (3–24 caractères après `trim`, message français) et unicité par `lower(pseudo)` en base,
   adossée à l'index `user_pseudo_lower_idx` de la migration 0012.

## Vérification de chaque critère

| Critère | Preuve |
| :--- | :--- |
| 1. Une seule requête, aucun recalcul | `profile.spec.ts` : la réponse porte `completeness`, `bestTableau`, `alignment` calculés serveur ; la salle ne lit que la réponse |
| 2. Aucun champ interdit | `profile.spec.ts` : parcours récursif des clés de la réponse, refus si `email`, `currency`, `session`, `account`, `locked`, `grid`, `treasure_index` apparaît |
| 3. Vitrine privée → 404 | `profile.spec.ts` : `PATCH /profile { profilePublic: false }` puis `GET /players/:id` en tant qu'autre joueur → `404` ; le propriétaire, lui, reçoit `200` |
| 4. Blocage | **non vérifiable dans cette branche** (`blocks` absent) ; code écrit, cas de spec conditionnel |
| 5. Complétude exacte | `profile.spec.ts` : 2 régions et 3 départements insérés → `2 / 18`, `3 / 101` |
| 6. Médailles + bouton d'ami | **partiel** : `friendState` rendu (`NONE` sans les tables), bouton à quatre états dans la salle ; médailles vides |
| 7. Pseudos identiques à la casse près | `profile.spec.ts` : `Pseudo-<uuid>` puis `pseudo-<uuid>` → `4xx` |
| 8. Statut **Migrée** | `.docs/02-database.md` §2 |

## Interdits respectés

Aucune modification de `.docs/03-active-task.md`, `ROADMAP.md`, `.docs/01-architecture.md`.
`.docs/02-database.md` n'est touché qu'au §2 (statut). Aucune dépendance nouvelle. Tout
s'exécute dans Docker.
