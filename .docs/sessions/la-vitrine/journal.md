# Journal — Phase 29 · La Vitrine

## 2026-11-19 — La Vitrine livrée, avec deux dépendances manquantes

### La contradiction trouvée avant d'écrire une ligne

Le brief annonce que les phases 26, 27 et 28 sont « déjà satisfaites quand tu démarres ».
C'est faux dans ce worktree : il part de `main`, où les migrations s'arrêtent à `0008`. Il n'y a
**aucune** table `user_scratch_charges`, `user_achievements`, `friendships` ni `blocks`, aucun
catalogue de médailles dans `packages/shared`, et `game_config` n'est lu par aucun code. Les
phases 27 et 28 vivent sur des branches parallèles que cette session ne voit pas.

Conséquence tenue tout du long : la phase livre **son périmètre**, et lit les dépendances
absentes par une **sonde de capacité** (`to_regclass`). Aucune table d'une autre phase n'a été
créée — leurs migrations (`0009`, `0010`, `0011`) leur appartiennent, et les dupliquer aurait
cassé la fusion.

Ce que cela coûte, dit franchement :

- **critère 4 (blocage) non coché** : la vérification existe dans le code
  (`loadPlayerProfile` teste `blocks` avant toute lecture de contenu, `fail closed` si la sonde
  échoue) mais aucun cas de spec ne peut l'exercer sans la table.
- **critère 6 (médailles et bouton d'ami) partiel** : `friendState` vaut `null` quand
  `friendships` est absente, et la salle **masque alors le contrôle d'ami** au lieu d'afficher
  un bouton qui échouerait. Les quatre états sont écrits ; ils s'activeront à la fusion de la
  phase 28, sans modification. Les médailles se rendent en clés brutes — aucun catalogue de
  libellés n'existe encore, donc aucune traduction n'a été inventée.

### Ce qui est livré

- `packages/db/migrations/0012_profiles.ts` : `user_profiles` (builder Kysely) et l'index
  unique partiel `user_pseudo_lower_idx on "user" (lower(pseudo)) where pseudo is not null`
  (template `sql`, seule façon d'exprimer un index fonctionnel). Enregistrée en **fin** de
  `migrator.ts`, `UserProfileTable` en **fin** de `Database`.
- `apps/api/src/auth.ts` : `databaseHooks.user.create.before` — `trim`, 3 à 24 caractères,
  refus d'un pseudo déjà pris **insensiblement à la casse**, messages français, `APIError` de
  `better-auth/api` en `'BAD_REQUEST'` (`'UNPROCESSABLE_ENTITY'` n'existe pas dans
  `APIErrorCode` en 1.7.25).
- `apps/api/src/services/profile.ts` : projection **liste blanche** (aucun `selectAll`),
  `displayName = pseudo ?? name`, `null` pour inconnu / privé / bloqué, erreurs SQL laissées
  remonter, `bestTableau` calculé par les fonctions partagées de `packages/shared/src/tableau.ts`.
- `apps/api/src/routes/players.ts` : `GET /players/:id` **public**, session dérivée
  optionnellement (`auth.api.getSession`), `404 PLAYER_NOT_FOUND` unique.
- `apps/api/src/routes/profile.ts` : `PATCH /profile` (bio ≤ 280, `profile_public`), upsert.
- `apps/web/src/routes/players.$playerId.tsx` + `lib/player-profile.ts` + `content/player-profile.ts` :
  la salle, une seule requête, aucun recalcul ; lien depuis Le Cartel vers la vitrine du vendeur.
- `.docs/02-database.md` §2 : `user_profiles` et l'index passent de **Contrat** à **Migrée** ;
  `friendships` et `blocks` restent **Contrat** (phase 28).
- `DESIGN_SYSTEM.md` §2 et §8.8 : la salle est nommée.

### Trois décisions qui méritent d'être relues

1. **`format: 'uuid'` a dû tomber.** Les identifiants Better Auth sont des chaînes de 32
   caractères (`5HNcrFRZfobuG3CnR4gBFzbGr762zvVr`), pas des UUID : le schéma rendait `422` sur
   tout identifiant valide. Remplacé par `t.String({ minLength: 1 })`, commenté.
2. **L'unicité du pseudo casse les fixtures existantes, pas la spec.** Quatre fichiers de
   `packages/spec` inscrivaient plusieurs comptes avec le **même** pseudo (`${prefix}-spec`) et
   `auth.spec.ts` avec `'spec-pseudo'`. Cinq fichiers ont donc vu changer **le seul littéral de
   pseudo** des helpers d'inscription, jamais une assertion ni un cas. C'est une conséquence
   directe du contrat (§2.9 : l'index unique est un prérequis), pas un test ajusté pour passer.
3. **La sonde de capacité est assumée comme transitoire.** Elle est commentée, ne met en cache
   que des mesures réelles, journalise ses échecs, résout par `search_path` (donc compatible du
   schéma isolé par worker) et penche du côté sûr : si l'on ne peut pas savoir si un compte est
   bloqué, la vitrine ne se rend pas.

### Ce que la revue hostile a changé

Premier verdict : **bloqué**. Trois défauts réels, tous dans le code neuf :

1. La migration créait l'index unique sans reprendre les doublons existants — la base de
   développement en comptait **227** (dont 181 `spec-pseudo`). En production, l'API migre au
   démarrage : boucle de redémarrage. Corrigé par une reprise déterministe (le plus ancien garde
   son pseudo, les suivants reçoivent `-2`, `-3`…, tronqué à 18 caractères).
2. La sonde mettait en cache une **promesse rejetée** : une erreur transitoire désactivait
   définitivement et silencieusement le blocage, les médailles et les amis. Corrigé (tri-état,
   `fail closed`, journalisation).
3. Un `catch { return null }` global transformait toute erreur SQL en `404`. Supprimé.

Et trois suggestions retenues : dénominateurs du référentiel mémorisés par processus, lien
depuis Le Cartel vers la Vitrine, unification de `button-classes.ts` (les trois copies
restantes n'étaient pas identiques — l'unification aligne sur `min-h-11 px-4`, la cible tactile ;
c'est le seul changement visuel de la série).

**Non retenu, volontairement** : la course entre le `select` d'unicité et l'`insert` rendrait
`500` au lieu de `400` dans une fenêtre de quelques millisecondes ; la clé unique en base reste
le juge, et la corriger demanderait d'intercepter l'erreur à l'intérieur du handler Better Auth
monté — hors du périmètre d'une phase de vitrine. Consigné ici plutôt que masqué.

### Vérification (Docker uniquement)

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_29' \
  dev bun run ci:check

[hexamap] ✓ 1/4 Lint
[hexamap] ✓ 2/4 Typecheck
[hexamap] ✓ 3/4 Base de données
[hexamap] ✓ 4/4 Spécifications
166 pass, 0 fail — Ran 166 tests across 12 files
[hexamap] ✓ Gatekeeper vert.
```

`packages/spec` passe de 159 à **166 spécifications** (les sept cas `Profil §2.9 — `) et de 11
à **12 fichiers**. Le compte d'`expect()` fluctue d'un passage à l'autre (864 puis 870), comme
consigné aux phases précédentes : ce n'est pas un invariant.

La base `hexamap_test_29` ne contenait aucun référentiel ; elle a été amorcée avec
`bun run --cwd scripts/import e2e:seed` (jeu `E2E-*`, idempotent). À noter : ce script efface
d'abord **toutes** les lignes de `commune_odonymes` — sans conséquence sur une base vide, à ne
pas rejouer sur une base importée.

La reprise de doublons a été prouvée par un rejeu réel de la migration sur une base jetable
`hexamap_test_29_mig` (trois comptes `Pseudo` / `pseudo` / `PSEUDO` → `Pseudo`, `pseudo-2`,
`PSEUDO-3`, index créé), puis le SQL exact rejoué sur les données de développement dans une
transaction annulée (`UPDATE 227`, `doublons_restants = 0`, `CREATE INDEX`).

### Non prouvé

- Le **banc E2E** n'a pas été rejoué : le lien Cartel → Vitrine et le rendu de la salle à 390 px
  ne sont couverts par aucun test.
- Le `fail closed` de la sonde n'a pas de cas de spec dédié.
- Le cache de module est par processus : une table apparue en cours de vie ne serait vue qu'au
  redémarrage (acceptable, les migrations passent au démarrage).
- Le blocage et le bouton d'ami ne s'exercent pas ici — dépendances absentes (voir plus haut).
