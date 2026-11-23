# Journal — Phase 45, la vitrine depuis les amis (R-003)

Branche : `feat/v2-45-vitrine-depuis-amis` · Base : `chore/v2-retours-campagne` · Migration : aucune.

## Étape 4 obligatoire — la charge utile de `/friends` porte-t-elle `profile_public` ?

**Réponse : NON.** Le drapeau était absent, il a été ajouté.

Constats, avec les chemins :

- `apps/api/src/services/friends.ts` — `listFriends` lisait les joueurs par
  `db.selectFrom('user').select(['id', 'pseudo']).where('id', 'in', otherIds)`. Aucune jointure sur
  `user_profiles`, donc aucune lecture de `profile_public`. Même chose pour `readPlayer` et
  `findPlayerByPseudo`, les deux autres lectures de joueur du service.
- La forme rendue était `player: { id: string; pseudo: string | null }`, rien d'autre.
- `apps/api/src/routes/friends.ts` — `playerSchema` est un `t.Object(..., { additionalProperties: false })`.
  Les schémas `response` sont **fermés** : ajouter le champ au service sans le déclarer ici n'aurait
  rien produit de visible. C'est le second piège de R-003, et il est réel.

C'est donc l'option « s'il manque » de la décision 4 : le drapeau s'ajoute au service **et** au
schéma fermé, verrouillé par des cas de spécification.

## Ce que la spécification verrouille (ajout, aucun cas existant réécrit)

Deux cas ajoutés à la suite du cas 18 de `packages/spec/src/friends.spec.ts` :

- **19** — `GET /friends` rend `profile_public` et vaut `true` quand aucune ligne `user_profiles`
  n'existe : c'est le défaut SQL de la base §4.9. Le cas asserte aussi `typeof === 'boolean'`, ce
  qui échouerait si le champ était retiré par un schéma `response` fermé mal mis à jour. Une
  seconde vérification couvre la ligne explicite à `true`.
- **20** — le drapeau vaut `false` quand la ligne existe et ferme la vitrine, **et** il reste
  `true` du point de vue de l'autre camp : le drapeau est celui du joueur visé, pas celui du
  lecteur.

Les deux cas ont été **vus rouges** avant l'ajout du champ (`Expected: true / Received: undefined`,
18 pass / 2 fail), puis verts.

## Décisions prises

- Le drapeau est porté par l'objet `player` existant (`player.profile_public`), pas par un objet
  `player` refait : un champ, pas une restructuration.
- Valeur par défaut `true` quand aucune ligne `user_profiles` n'existe, conformément à
  `.docs/02-database.md` §4.9 — `leftJoin` + `?? true` sur les trois lectures.
- Aucun état React nouveau : `EntryRow` choisit une balise (`Link` ou `span`), sans chargement ni
  préchargement.
- Aucune fixture E2E inventée : `PATCH /api/v1/profile` (`{ profilePublic: false }`) existe déjà et
  le banc s'en sert pour produire l'état privé sur le **même** ami.

## Ce que le banc couvre réellement

Aucun cas E2E ne couvrait `/friends` : la demande d'ami du Guichet passe par l'API, jamais par
l'écran. Un fichier neuf, `packages/e2e/tests/friends.spec.ts`, couvre les deux critères sur un
seul ami :

1. ami public (défaut) → `getByRole('link', { name: pseudo, exact: true })` visible, `href` égal à
   `/players/<id>`, puis **clic réel** : l'URL atteint `/players/<id>` et la vitrine répond (pas un
   `404` muet) ;
2. le même ami ferme sa vitrine par le produit (`PATCH /profile`), la page est rechargée : plus
   aucun lien, le pseudo redevient le texte d'avant ;
3. la relation est retirée en fin de cas, pour que le banc ne grossisse pas d'une amitié par
   exécution.

Le libellé du lien est **exactement** le pseudo : le banc le sélectionne par nom accessible exact.

## Mesures

- `ci:check` (base `hexamap_test_45`) : **551 spécifications, 28 fichiers, 0 échec**, deux passages
  consécutifs verts.
- Banc E2E complet sur volume neuf : **107 cas, 0 échec**.

Deux rouges vus en chemin, aucun laissé derrière, tous deux décrits dans `review.md` : un cas de
spec non identifié une fois sur quatre passages (le seul cas instable connu est la mesure de charge
de l'Atlas, `atlas-api.spec.ts:448`), et le cas du Palmarès qui échoue sur un volume E2E
**réutilisé** (`palmares.spec.ts:189-191` prend la première ligne homonyme, et chaque exécution en
ajoute une dans la même semaine ISO) — vert sur volume neuf, donc pas une régression de ce diff.

## Mémoire projet

Aucune modification de `.docs/01-architecture.md`, `.docs/02-database.md`, `.docs/05-deploiement.md`
ni `.docs/06-cadre-juridique.md` : R-003 n'en demande aucune, et la règle de la campagne est le
refus par défaut.
