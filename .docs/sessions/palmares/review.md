# Revue hostile — Phase 42, Le Palmarès

Branche `feat/v2-42-palmares`, base `21067a2`, huit commits lus un par un
(`8be3ada`, `f6e636b`, `70fbf2a`, `894afea`, `bea8224`, `cf5cb55`, `ceb71db`, `80db783`).
La revue porte sur le diff et le code tel qu'il est, pas sur les intentions du plan.

**Verdict : prêt à livrer**

Aucun défaut de gravité `deal-breaker`. Le contrat est tenu là où il est vérifiable par lecture :
le score est écrit une seule fois dans la transaction de soumission, le classement ne lit que la
colonne figée, l'`ORDER BY` est total, le rang est la position, la semaine est ISO 8601 en UTC et
une semaine inexistante est refusée au lieu d'être repliée. Neuf points restent, tous des
`suggestion` : aucun ne casse une règle écrite, mais deux d'entre eux sont des liens ou des
expositions qui deviennent faux dans un scénario réel (vente d'une carte d'un tableau classé,
`limit` non borné dans le service).

---

## Défauts trouvés

### `suggestion` — le lien du cartel meurt après une vente ou un troc

`apps/web/src/routes/palmares.tsx:164` (et `:168` pour la cible).

La ligne lie `/card/$cardId` dès que **le tableau** appartient au lecteur (`entry.yours`). Or
`/api/v1/cards/:id` n'expose une carte qu'à son propriétaire, à une annonce ouverte ou à la partie
adverse d'un troc ouvert : `apps/api/src/routes/cards.ts:292-308` répond
`403 CARD_NOT_VISIBLE` sinon. Scénario réel, sans aucun cas tordu : je soumets un tableau, je vends
une de ses quatre cartes au Comptoir, j'ouvre Le Palmarès — ma propre ligne est toujours première
(`yours: true`, score figé, correct), mais le lien de la carte vendue mène à une salle qui refuse.
Le prédicat correct n'est pas « le tableau est à moi » mais « cette carte est encore à moi », et la
charge utile ne le dit pas (`cards[]` ne porte pas de propriétaire, et c'est voulu : le serveur ne
doit pas exposer ça). Le défaut est le même que celui de `GET /tableaux`, donc pas introduit ici,
mais la salle le rend atteignable depuis un écran public. Graves conséquences ? Non : la planche
reste lisible par son nom, seule la navigation casse. Correctif possible sans nouvelle règle : ne
pas lier, ou lier vers la planche du tableau, ou faire dire au Cartel « cette carte ne vous
appartient plus » au lieu d'un 403.

### `suggestion` — le `limit` n'est borné que par le schéma de la route

`apps/api/src/services/palmares.ts:122` (`.limit(limit)`), borne posée en
`apps/api/src/routes/palmares.ts:89` (`t.Integer({ minimum: 1, maximum: PALMARES_LIMIT_MAX })`).

Le contrat est tenu : la seule route qui appelle `loadPalmares` refuse `0` et `101` en `422` avant
toute lecture, et `packages/spec/src/palmares.spec.ts:538` le fige. Mais `loadPalmares` est
exportée et n'a aucune garde : n'importe quel second appelant (export, route d'administration,
spec future) récupère `limit = 10_000` sans broncher. Un `Math.min(Math.max(limit, 1),
PALMARES_LIMIT_MAX)` coûterait une ligne et retirerait la dépendance à un schéma de route pour une
propriété du service.

### `suggestion` — aucune exposition nouvelle, mais deux identifiants de tiers sortent

`apps/api/src/services/palmares.ts:176` (`player.id`) et `:180` (`cardId`).

Rien d'interdit ne fuit : pas de `grid`, pas de `treasure_index`, pas de solde, pas d'adresse
électronique, pas d'état `locked` — vérifié sur le `select` (`:103-116`) et sur le schéma de
réponse (`apps/api/src/routes/palmares.ts:26-41`, `additionalProperties: false`). Restent deux
identifiants : l'`id` du compte quand `profilePublic` est faux (`:176`) et le `cardId` d'une carte
d'un tiers (`:180`). Le premier est inutile puisque l'interface ne lie pas une vitrine privée
(`palmares.tsx:131-142`) ; le second est inutilisable puisque `/cards/:id` refuse justement cette
carte (`cards.ts:306-309`). Ce sont des poignées opaques, pas des données personnelles, d'où
`suggestion` et non `deal-breaker` — mais publier un identifiant qu'on interdit ensuite de résoudre
est le genre d'asymétrie qu'on regrette plus tard.

### `suggestion` — la salle ne peut montrer qu'une semaine et vingt lignes

`apps/web/src/lib/palmares.ts:72` (`api.api.v1.palmares.get()`, sans paramètre) et
`apps/web/src/routes/palmares.tsx:112`.

Le serveur sait faire beaucoup plus que ce que la salle demande : `?year=&week=` n'est jamais
envoyé, donc `current` vaut toujours `true` et le libellé `PALMARES.pastWeek`
(`apps/web/src/content/palmares.ts:14`) est du texte mort ; et le classement s'affiche sur les 20
lignes du défaut serveur alors que l'en-tête annonce `total` (« N tableaux classés »). Un joueur
41ᵉ lit donc « 240 tableaux classés » et ne voit jamais sa ligne, sans pagination ni mention. Ce
n'est pas une violation du contrat — la phase n'exige ni pagination ni navigation par semaine —,
mais c'est un écart entre ce que la réponse porte (`week`, `weekStart`, `weekEnd`, `current`,
`total`) et ce que l'écran en fait.

### `suggestion` — pas d'index pour le classement hebdomadaire

`apps/api/src/services/palmares.ts:99-123`, et `packages/db/migrations/0019_tableau_score.ts`
n'ajoute aucun index.

La requête filtre `created_at` sur une semaine puis trie `score desc, created_at asc, id asc` avec
une limite ; le seul index de `tableaux` est `tableaux_user_idx (user_id)`
(`.docs/02-database.md` §4.4). Chaque lecture de la salle balaie donc la table. Aucune règle écrite
n'exige un index, et le volume de lancement ne le réclame pas : `suggestion` seulement. Si un jour
un index est ajouté, il doit venir d'une migration neuve, pas d'un ajout à `0019` déjà appliquée.

### `suggestion` — les cas d'ex æquo ne sont pas isolés dans une semaine dédiée

`packages/spec/src/palmares.spec.ts:413` et `:447`.

Le premier cas de la suite prend soin de déplacer ses deux tableaux en 2001 pour que « le classement
ne retienne que ces deux lignes, quel que soit le parallélisme des 27 autres fichiers ». Les deux
cas d'ex æquo, eux, restent dans la **semaine courante** et ne passent que parce que leurs totaux
(13 400 et 13 600) trient au-dessus des fixtures des autres fichiers, qui insèrent sans score et
valent donc `0`. Le jour où un autre fichier insère un tableau bien noté dans la semaine courante,
les témoins peuvent sortir des 20 lignes du défaut et le cas échouera pour une raison sans rapport
avec le départage. La preuve est réelle aujourd'hui, fragile demain.

### `suggestion` — le cas de rejeu de `0019` touche un schéma partagé

`packages/spec/src/palmares.spec.ts:594-717`.

Le test retire `not null` sur `tableaux.score`, met trois scores à `null`, supprime la ligne
`kysely_migration` puis rejoue `runMigrations` — pendant que les autres fichiers de la suite
tournent en parallèle sur la même base (`bun test` parallélise les fichiers). Le `finally`
(`:706-716`) remet la contrainte, et le verrou consultatif de `runMigrations` sérialise les
migrations, donc je ne vois pas de scénario où un autre fichier casse ; mais un test qui modifie le
schéma partagé pour prouver une migration est structurellement exposé. Une base dédiée ou un
schéma isolé serait plus sûr. À noter aussi : ce cas est la **seule** preuve du rétro-remplissage,
et il est bon — il vérifie la chaîne complète, un tableau partiel et une carte orpheline, avec des
attendus dérivés de `tableauScore` et non de littéraux posés au hasard.

### `suggestion` — le banc E2E s'accumule d'un passage à l'autre

`packages/e2e/tests/palmares.spec.ts:210`, `:17` (`PALMARES_LIMIT = 100`), `:133`.

Chaque exécution laisse deux tableaux de plus dans la semaine courante, et le classement est lu avec
`limit=100`. Vers le cinquantième passage, les deux témoins peuvent sortir de la page et le cas
échouera sans qu'aucune règle du produit ait changé. Le test le sait (le commentaire de `:177-184`
explique qu'il relit « toutes les lignes » à cause des passages précédents) mais ne s'en protège
pas. Corollaire honnête : `assertRanking` (`:141-156`) vérifie que les scores ne remontent jamais,
**pas** le départage `created_at asc` — il ne peut pas, `PalmaresItem` (`:60-69`) ne porte pas
`createdAt` alors que la réponse le contient. Le départage n'est donc prouvé que par la spec.

### `correct` — le `drop trigger` de 0014 ne change pas l'effet du schéma

`packages/db/migrations/0014_ref_integrity.ts:57` (dans `up`) et `:113` (dans `down`).

Au premier passage le `drop trigger if exists ref_truncate_guard on ref_regions` ne trouve rien ;
au second il retire exactement le déclencheur que la ligne suivante recrée à l'identique, même nom,
même fonction, même argument `'REGION'`, même `before truncate … for each statement`. Aucune autre
instruction de la migration n'est touchée (`git show f6e636b --stat` : un fichier, deux lignes
ajoutées). Le `drop` de `down` répare en plus un `down` qui était cassé : le déclencheur
`ref_truncate_guard` n'y était jamais retiré, donc `drop function ref_truncate_guard()` échouait en
`2BP01` à cause de la dépendance. L'ajout est une garde d'idempotence au sens de
`.docs/02-database.md` §1.8, pas une réécriture d'effet.

### `correct` — la migration ne peut pas échouer sur son `set not null`

`packages/db/migrations/0019_tableau_score.ts:19-50`.

Le rétro-remplissage est une CTE `computed` construite **depuis `tableaux` elle-même** (`from
tableaux t`, `left join` sur `user_cards` par clé primaire, `left join` sur les quatre référentiels
par clé primaire, `exists` sur `commune_odonymes`) : chaque ligne de `tableaux` y apparaît une fois
et une seule — aucun `join` ne peut produire de doublon, et une `exists` ne multiplie pas les
lignes. `computed.points` est une somme de `coalesce(…, 0)` : jamais `NULL`. `round(numeric)` d'un
`points` entier positif ne rend jamais `NULL`. L'`update … from computed where t.id = computed.id
and t.score is null` couvre donc **toutes** les lignes nulles, et le `set not null` (`:49`) ne peut
plus rencontrer de `NULL`. Une carte absente (`region_card_id` mis à `null` par
`on delete set null`), une carte orpheline (`ref_code` absent du référentiel) ou un emplacement vide
tombent tous dans `coalesce(0)` et ne « perdent » que les liens qui les concernent — le cas est
prouvé par `packages/spec/src/palmares.spec.ts:594-717`, y compris la carte orpheline (score 6 250
attendu, deux liens sur trois, égal à `tableauScore(SCORES, 2)`).

Rejouable ? `add column if not exists` (`:17`), `update … where score is null` (`:46`), `set not
null` et `set default` (`:49-50`) : le second passage ne remplit rien, `set not null` sur une
colonne déjà `not null` est un no-op, `set default 0` sur un défaut déjà `0` aussi. `down` est
`drop column if exists` (`:54`). La formule recopiée en SQL (`:23-29`, `:41-44`) est **littéralement**
celle de `tableauScore`/`evaluateTableauAlignment` (`packages/shared/src/scoring.ts:31-34`,
`packages/shared/src/tableau.ts:126-157`) : mêmes conditions de lien, même `coalesce`, même
`round(total × multiplicateur)` avec `[1, 1.5, 2.5, 5]`. Le seul écart possible est le mode
d'arrondi (`Math.round` en JS, `round(numeric)` en SQL) — les deux arrondissent un produit positif
au plus proche, donc identiques ici.

### `correct` — la soumission écrit exactement ce qu'elle renvoie

`apps/api/src/routes/tableaux.ts:691` (`evaluateTableau`), `:702` (`score: evaluation.total`),
`:720-721` (le corps de réponse reprend `evaluation.total`).

Un seul appel, dans la transaction, sur un objet `evaluation` unique : la valeur écrite et la valeur
rendue sont **le même scalaire**, pas deux calculs parallèles. C'est le seul site d'insertion de
production (`grep insertInto('tableaux')` : `apps/api` une fois, le reste étant six insertions
directes de test — `account` ×2, `atelier`, `profile`, `tableaux`, fixture `vitrine` — qui
expliquent le défaut `0`).

### `correct` — l'`ORDER BY` est total et le rang vient de la position

`apps/api/src/services/palmares.ts:119-121` puis `:169`.

`score desc, created_at asc, id asc` : `tableaux.id` est la clé primaire `uuid`, donc la troisième
clé ne laisse aucun ex æquo possible ; l'ordre est total et déterministe, sans dépendre du plan
d'exécution. Le rang est `index + 1` sur les lignes déjà triées par le serveur — il n'y a pas de
`dense_rank` ni de rang recalculé, et aucune route n'expose d'`offset` qui rendrait la position
fausse. La semaine est comparée par bornes d'instants (`>= start`, `< end`) sur `timestamptz`, donc
les bornes UTC de `packages/shared/src/palmares.ts:59-75` sont respectées à la milliseconde.

---

## Critères d'acceptation (les sept du brief)

### 1. Départage écrit et stable — **prouvé**

`apps/api/src/services/palmares.ts:119-121` (les trois clés, une seule requête) et `:169` (rang).
Preuve exécutable : `packages/spec/src/palmares.spec.ts:413` (même total, `created_at` forcé à
+60 s → le plus tôt devant) et `:447` (`created_at` identique → `id` croissant, comparé à
`[a, b].sort()`, ce qui est licite : le tri texte d'un uuid canonique suit l'ordre des octets de
PostgreSQL). Les deux cas relisent ensuite le classement et exigent des couples
`[rank, tableauId]` identiques (`:441-444` et `:471-474`). Réserve : non isolés dans une semaine
dédiée (voir défauts).

### 2. Aucun recalcul côté navigateur — **prouvé par lecture**

`grep -rn "tableauScore\|alignmentMultiplier\|evaluateTableau" apps/web/src` ne rend qu'un
**commentaire** (`apps/web/src/content/tableau.ts:54`) : aucun import, aucun appel.
`apps/web/src/routes/palmares.tsx` n'a ni `.sort(`, ni somme, ni multiplicateur ; `entry.rank` et
`entry.score` sont affichés tels quels (`:125-130`, `:146`), et le commentaire de `:110` dit que
l'ordre du DOM est le rang. `apps/web/src/lib/palmares.ts` ne fait que transporter la réponse.

### 3. Classement identique entre deux lectures — **prouvé**

Spec : `packages/spec/src/palmares.spec.ts:441-444` et `:471-474` (deux `GET`, couples
`[rank, tableauId]` égaux). E2E : `packages/e2e/tests/palmares.spec.ts:266-273` (deux lectures HTTP)
puis la salle avant/après `reload` (`:290-302`), lignes témoins comparées à l'identique. Côté
serveur, la stabilité découle de l'`ORDER BY` total, pas du hasard.

### 4. La migration rétro-remplit et finit `not null` — **prouvé**

`packages/db/migrations/0019_tableau_score.ts:19-50` (ordre : colonne nullable → remplissage borné
par `score is null` → `set not null` → `set default 0`). Preuve exécutable :
`packages/spec/src/palmares.spec.ts:577` (`information_schema.columns.is_nullable = 'NO'`) et
`:594-717` (rejeu réel : `kysely_migration` purgée, `runMigrations` rejouée, trois tableaux
rétro-remplis, dont une chaîne complète à 12 500, un partiel à 900 et une carte orpheline à 6 250,
puis les cartes ramenées à zéro sans que les scores bougent). La rejouabilité de `0014` est
couverte par le même commit `f6e636b` : aucun test ne la vise nommément, mais le rejeu de
`runMigrations` du cas `:594-717` la rejoue avec les autres — un `drop trigger` manquant y lèverait
`42710`. `ci:check` a rendu ce rejeu vert dans cette session, donc l'idempotence est constatée par
exécution, pas seulement par lecture.

### 5. Cas E2E — **écrit, puis exécuté par la session**

`packages/e2e/tests/palmares.spec.ts:210` : deux soumissions réelles par l'endpoint, deux lectures
du classement, la salle avant et après rechargement, l'ordre et les scores des deux témoins, puis
pour **toutes** les lignes rendues : pas de lien de cartel vers la carte d'un tiers, lien de vitrine
seulement si `profilePublic`. Les assertions ne sont pas tautologiques — elles comparent la salle au
serveur, pas la salle à elle-même.

Rejoué après la rédaction de cette revue, sur le banc TLS complet :

```
docker compose -f docker-compose.e2e.yml run --rm playwright \
  npx --no-install playwright test
  103 passed (3.2m), 0 échoué, 0 ignoré

docker compose -f docker-compose.e2e.yml run --rm playwright \
  npx --no-install playwright test tests/palmares.spec.ts
  1 passed (9.4s)
  [e2e] entrées étrangères classées : 16
```

Les 16 entrées étrangères viennent des passages précédents du banc, qui laissent leurs tableaux
dans la semaine courante : c'est exactement la fragilité signalée en `suggestion`, et elle est
observée ici, pas supposée.

### 6. Un tableau modifié garde son score — **prouvé**

`packages/spec/src/palmares.spec.ts:387-411` : après soumission, les quatre `user_cards.score` sont
mis à `0` (`:402`) ; le classement rend toujours `frozen`, et `readTableauScore` rend la même
valeur. Un recalcul donnerait `0`, donc le cas discrimine réellement. Le même geste est refait dans
le cas de rejeu (`:688-704`).

### 7. `ci:check` vert — **reproduit par la session**

La revue ne l'avait pas joué ; la session l'a rejoué après sa rédaction, dans Docker, avec la base
de test dédiée :

```
docker compose -p hexamap --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_42' \
  dev bun run ci:check
  ✓ 1/4 Lint   ✓ 2/4 Typecheck   ✓ 3/4 Base de données   ✓ 4/4 Spécifications
  506 pass, 0 fail, 3122 expect() calls, 27 files (37.73s)
  [hexamap] ✓ Gatekeeper vert.
```

Le rejeu de `0019` s'y voit passer deux fois (`column "score" … already exists, skipping`, puis
`[db] migration 0019_tableau_score appliquée`) : la rejouabilité est donc constatée, pas seulement
lue. Deux points de vigilance statiques restent, non bloquants : `biome` n'est pas touché, et le
seul fichier généré modifié (`apps/web/src/routeTree.gen.ts`, 21 lignes) a la forme du générateur.

### Contrôles transverses du brief

- **`skip`/`only`** : aucun. `git diff 21067a2..HEAD -- packages/spec packages/e2e` filtré sur
  `\.skip|\.only` ne rend rien.
- **Assertions existantes réécrites** : aucune. `cf5cb55` est un fichier neuf de 718 insertions,
  zéro suppression ; `ceb71db` un fichier neuf de 384 insertions. Aucun autre fichier de
  `packages/spec` n'est touché par la branche.
- **Statuts d'erreur réels** : `401` existe deux fois — le groupe protégé (`apps/api/src/app.ts:70`,
  montage de `palmaresRoutes`) et la garde défensive de la route (`routes/palmares.ts:55-58`) — et la
  spec l'obtient sans cookie (`palmares.spec.ts:316`). `400 PALMARES_INVALID_WEEK` a deux causes
  distinctes, toutes deux couvertes : un seul des deux paramètres (`routes/palmares.ts:60-68`, spec
  `:559`) et une semaine inexistante (`services/palmares.ts:90-97`, spec `:567`). `422` vient de la
  validation de `query` par Elysia et n'est pas dans la table `response` — c'est écrit dans le
  commentaire de la route (`:43-48`) et figé par la spec (`:538`).

---

## Écart assumé — confirmé

`GET /api/v1/tableaux` recalcule bien à la lecture. La liste appelle `evaluateTableau` sur les
cartes relues (`apps/api/src/routes/tableaux.ts:564`, `:571`, `:580-586`), et l'aperçu de
composition fait de même (`:199-204`). Le Palmarès, lui, ne lit que `tableaux.score`
(`apps/api/src/services/palmares.ts:106`, `:119`) : aucun `user_cards.score` n'entre dans sa
requête. `.docs/01-architecture.md` §2.5 nomme les quatre lectures qui recalculent encore (aperçu,
liste du joueur, meilleur tableau de la vitrine, fil des médailles) et précise que le classement
hebdomadaire « ne lit **que** la colonne figée ». L'écart est donc écrit là où il doit l'être, et
la raison invoquée dans le plan (ne pas réécrire une spec gelée de `tableaux.spec.ts`) est
cohérente avec la règle « une PR d'implémentation ne modifie pas les specs ». Conséquence à garder
en tête : après la vente d'une carte, la liste du joueur peut afficher un total différent de celui
du Palmarès pour le même tableau. C'est théorique aujourd'hui (`user_cards.score` ne change jamais
après acquisition) mais ce n'est pas rien : c'est exactement le genre d'écart qu'un joueur
remarque le jour où la première règle change.

---

## Ce que la revue ne prouvait pas, et ce que la session a prouvé ensuite

La revue est une passe de **lecture** : aucune commande n'a été jouée pendant sa rédaction. Ce qui a
été constaté après elle, dans Docker et sur le banc TLS, est consigné ici pour que le lecteur sache
quelle ligne repose sur quoi.

Constaté par exécution après la revue :

- `ci:check` : lint, typecheck, base et **506 spécifications / 0 échec / 27 fichiers** — la suite
  complète passe, y compris les deux cas signalés comme fragiles et le rejeu de la migration.
- Banc E2E complet : **103 passés, 0 échoué, 0 ignoré** (3,2 min), et le cas du Palmarès rejoué
  seul : **1 passed**, trace `entrées étrangères classées : 16`.
- Rejouabilité de `0019` **et** de `0014` : le cas `:594-717` purge `kysely_migration` puis rejoue
  `runMigrations`, et `ci:check` l'a rendu vert.

Ce qui reste non prouvé, même après exécution :

- Le comportement de la salle n'a été ni regardé jouer ni évalué : accessibilité, clavier, focus et
  rendu mobile ne sont pas couverts par cette passe, seulement par les cas génériques du banc.
- Aucune vérification de charge : l'absence d'index pour le classement est signalée, pas mesurée.
- Les deux fragilités de test (ex æquo hors semaine dédiée, rejeu sur schéma partagé) restent
  vertes aujourd'hui et pourraient rougir sans qu'aucune règle du produit ne change ; elles sont
  documentées, pas corrigées, et cette phase n'a pas de raison de réécrire une preuve qui tient.

---

*Revue conduite le 2026-11-22 sur le diff (huit commits, service, route, salle, migration, deux
fichiers de tests), puis complétée par les sorties de `ci:check` et du banc E2E jouées dans la même
session. Les suggestions listées plus haut sont assumées et non corrigées : aucune ne viole une
règle écrite, et le verdict reste « prêt à livrer ».*
