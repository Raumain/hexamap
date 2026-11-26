# Plan — Phase 45, la vitrine depuis les amis (R-003)

## Retour traité

`R-003` de `.docs/10-retours-v2.md` : « Un ami n'a pas de lien vers sa vitrine ». Le pseudo d'un
ami est du texte mort dans `/friends` ; il doit devenir le lien vers sa vitrine **publique**, et
rester du texte quand la vitrine est privée — une vitrine privée répond `404` par dessein
(`.docs/01-architecture.md` §2.9), et la même section interdit de proposer un lien mort.

## Constat de départ (étape 4 du brief, déjà tranchée)

`profile_public` **n'est pas** rendu par `/friends` :

| Couche | Fichier | État |
| :--- | :--- | :--- |
| Service | `apps/api/src/services/friends.ts:178-215` | `select(['id','pseudo'])` sur `user`, aucune jointure `user_profiles` |
| Forme | `apps/api/src/services/friends.ts:17-22` | `player: { id, pseudo }` |
| Schéma | `apps/api/src/routes/friends.ts:21-24` | `t.Object(..., { additionalProperties: false })` — fermé |
| Client | `apps/web/src/lib/friends.ts` | type `FriendEntry` consommé par `friends.tsx:11` |
| Écran | `apps/web/src/routes/friends.tsx:341-350` | `EntryRow`, pseudo en `<span>` |

## Étapes, dans l'ordre

### 1. Spécification d'abord (rouge avant vert)

Fichier : `packages/spec/src/friends.spec.ts`, **en ajout seulement** (aucun cas existant réécrit).

- Cas 19 : `GET /friends` rend `profile_public === true` pour un ami dont le profil n'a pas de
  ligne `user_profiles` (défaut SQL `true`, `.docs/02-database.md` §4.9), et pour un ami dont la
  ligne existe et vaut `true`.
- Cas 20 : `GET /friends` rend `profile_public === false` pour un ami dont la ligne
  `user_profiles.profile_public` vaut `false`.
- Les deux cas s'appuient sur les helpers existants (`signUp`, `getFriends`, `pairRows`) et
  n'introduisent aucun helper nouveau.

Garde-fou : les cas 19/20 doivent être **vus rouges** avant l'ajout du champ au service.

Vérification : `bun test packages/spec/src/friends.spec.ts` dans Docker → rouge attendu sur
`profile_public` (`undefined` au lieu de `true`).

### 2. API — le champ, et rien de plus

- `apps/api/src/services/friends.ts`
  - `PlayerRef` et `FriendEntry.player` gagnent `profile_public: boolean`.
  - `listFriends` joint `user_profiles` par `leftJoin('user_profiles', 'user_profiles.user_id', 'user.id')`
    et sélectionne `coalesce(profile_public, true)`. Aucune ligne `user_profiles` = profil public
    par défaut, exactement le défaut SQL.
  - `readPlayer` fait de même, pour que la réponse de création/acceptation ne mente pas sur la
    forme (même `player` partout).
- `apps/api/src/routes/friends.ts`
  - `playerSchema` déclare `profile_public: t.Boolean()`, `additionalProperties: false` conservé.

Aucune migration : `user_profiles.profile_public` existe déjà (`0012_profiles`).

### 3. Web — le lien, et rien d'autre

- `apps/web/src/lib/friends.ts` : le type client gagne `profile_public: boolean` (miroir du service).
- `apps/web/src/routes/friends.tsx`
  - `Link` ajouté à l'import de `@tanstack/react-router` (même module que `createFileRoute`).
  - `EntryRow` : quand `entry.player.profile_public` est vrai,
    `<Link to="/players/$playerId" params={{ playerId: entry.player.id }}>{pseudo}</Link>` ; sinon
    le `<span>` actuel. **Le libellé est le pseudo dans les deux cas**, jamais « voir le profil ».
  - Aucun `useState`, aucune requête, aucun préchargement : le composant ne fait que choisir une
    balise. Le style du lien reprend celui du texte courant (même classe + soulignement au survol),
    pour que la ligne ne change pas de gabarit.

Le pseudo de repli (`FRIENDS.unknownPseudo`) reste le même dans les deux branches.

### 4. Banc E2E

Le banc n'a **aucun** cas sur `/friends` : la demande d'ami du guichet passe par l'API
(`packages/e2e/tests/guichet.spec.ts:66-79`). Un fichier neuf est donc nécessaire pour couvrir la
surface visible ; il réutilise le motif du second contexte déjà employé par `guichet.spec.ts`
(`browser.newContext` + `registerFreshPlayer`).

- Cas « un ami public propose un lien nommé par son pseudo » : deux comptes, amitié acceptée par
  l'API, la page `/friends` montre un `getByRole('link', { name: pseudo })` dont le `href` est
  `/players/<id>`.
- Cas « un ami privé ne propose aucun lien » : **dépend de l'existence d'un moyen de fermer la
  vitrine** — à trancher avec le rapport d'exploration. S'il n'existe aucune route pour écrire
  `user_profiles.profile_public`, aucun second compte privé ne peut être produit sans inventer une
  fixture que l'entrée R-003 ne demande pas : le cas est alors **écarté et documenté**, et le
  critère d'acceptation 2 n'est pas coché.

### 5. Vérifications

```sh
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_45' \
  dev bun run ci:check
```

Puis, la surface étant visible, le banc E2E complet (voir le brief).

### 6. Revue, commits, PR

- `05-review` sur le diff complet, verdict dans `.docs/sessions/vitrine-depuis-amis/review.md`.
- Commits atomiques : `test(spec)` → `feat(amis)` → `test(e2e)` → `docs(sessions)`.
- PR **en brouillon** vers `chore/v2-retours-campagne`.

## Fichiers touchés (liste fermée)

| Fichier | Nature |
| :--- | :--- |
| `packages/spec/src/friends.spec.ts` | ajout de 2 cas |
| `apps/api/src/services/friends.ts` | champ `profile_public` + jointure |
| `apps/api/src/routes/friends.ts` | `playerSchema` |
| `apps/web/src/lib/friends.ts` | type client |
| `apps/web/src/routes/friends.tsx` | `EntryRow` + import `Link` |
| `packages/e2e/tests/friends.spec.ts` | fichier neuf (surface visible) |
| `.docs/sessions/vitrine-depuis-amis/*` | plan, revue, journal |

Hors périmètre, explicitement : `apps/web/src/routes/players.$playerId.tsx` (la vitrine se
consomme, elle ne se modifie pas), `apps/web/src/components/layout/`, `apps/web/src/routeTree.gen.ts`,
`packages/db/`, `.docs/03-active-task.md`, `main`.
