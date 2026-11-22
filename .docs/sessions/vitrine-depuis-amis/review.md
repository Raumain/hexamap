# Revue — Phase 45, la vitrine depuis les amis (R-003)

Passe hostile sur le diff complet, `origin/chore/v2-retours-campagne..HEAD`.
Verdict : **prêt à livrer**. Aucun défaut *deal-breaker*. Trois suggestions, toutes assumées.

## Ce que la revue a vérifié, un par un

| Point | Verdict | Preuve |
| :--- | :--- | :--- |
| Le drapeau traverse un schéma `response` fermé | correct | `routes/friends.ts` déclare `profile_public: t.Boolean()` dans `playerSchema`, `additionalProperties: false` conservé ; le cas 19 asserte `typeof === 'boolean'`, ce qui échouerait si le champ était retiré à la sérialisation |
| Le repli correspond au défaut SQL | correct | `profile_public: row.profile_public ?? true` sur les trois lectures ; `user_profiles.profile_public` est `not null default true` (base §4.9) |
| Aucune ligne `user_profiles` ne casse la lecture | correct | `leftJoin` + `?? true` ; cas de spec 19 le prouve sur un compte neuf |
| Aucun N+1 introduit | correct | `listFriends` garde **une** lecture groupée `where('user.id','in', otherIds)` ; le `leftJoin` ne multiplie pas les lignes (`user_profiles` a `user_id` en clé primaire) |
| Le libellé du lien est exactement le pseudo | correct | `EntryRow` rend `{pseudo}` dans les deux branches ; le banc sélectionne `getByRole('link', { name: pseudo, exact: true })` |
| Aucun lien vers un 404 | correct | branche `profile_public ?` ; côté banc, l'ami ferme lui-même sa vitrine et le lien disparaît après rechargement |
| Aucun état React nouveau | correct | `EntryRow` choisit une balise ; ni `useState`, ni requête, ni préchargement |
| Aucune migration, table, colonne ou route | correct | diff limité à deux fichiers API, un fichier web, deux fichiers de test ; `user_profiles` existe depuis `0012` |
| Aucune attente existante de `packages/spec` réécrite | correct | les deux cas sont **ajoutés** après le cas 18 ; aucune assertion, aucun helper, aucune interface existante modifiée |
| La route de la vitrine est intacte | correct | `players.$playerId.tsx` et `services/profile.ts` absents du diff |
| Mémoire projet non touchée sans mandat | correct | `.docs/01-architecture.md`, `.docs/02-database.md`, `.docs/05-deploiement.md`, `.docs/06-cadre-juridique.md`, `packages/e2e/fixtures/` absents du diff |

## Le drapeau n'ouvre aucune fuite d'information

`profile_public` est **déjà** public sur une autre surface : `apps/api/src/routes/palmares.ts:35`
déclare `{ id, pseudo, profilePublic }` dans un schéma fermé, et `services/palmares.ts:178` le
remplit exactement avec le même repli `?? true`. La même architecture §2.9 impose au Palmarès de
n'offrir le lien que sur cette valeur. `/friends` ne révèle donc rien de neuf — il cesse de cacher
une information que la vitrine révèle de toute façon (`404` ou contenu).

## Suggestions (aucune n'est un deal-breaker)

1. **Deux orthographes pour un même fait.** Le Palmarès expose `player.profilePublic`
   (camelCase), `/friends` expose `player.profile_public` (snake_case). C'est une incohérence de
   surface d'API, pas de contrat de données. Le brief de la phase nomme explicitement
   `profile_public` (« le champ `profile_public` s'ajoute », critère 4), et le renommer aurait
   contredit la consigne. **Assumé, non corrigé** : unifier demanderait de toucher une surface
   gelée du Palmarès, hors périmètre de R-003.
2. **Le lien apparaît aussi sur une demande en attente.** `EntryRow` sert les trois listes
   (reçues, envoyées, amis) : un demandeur non encore accepté voit donc son pseudo cliquable.
   Ce n'est pas un lien mort — sa vitrine est publique et répond — et R-003 conditionne le lien à
   `profile_public`, jamais au statut de la relation. **Assumé** : restreindre le lien aux seuls
   amis aurait demandé un second composant pour un résultat identique à l'écran.
3. **Un pseudo nul produirait un lien « Pseudo inconnu ».** Le repli `FRIENDS.unknownPseudo`
   existait déjà pour le texte ; il devient le libellé d'un lien valide. Un compte sans pseudo
   n'existe pas en pratique (Better Auth le déclare obligatoire). **Assumé, non corrigé** : le
   retirer aurait changé l'affichage d'un cas que le contrat ne prévoit pas.

## Ce que la revue n'a pas pu prouver

Rien de bloquant. Le banc E2E joue la vitrine réelle (le lien ouvre `/players/<id>` et la page
répond), donc le critère 1 est prouvé de bout en bout, pas seulement par l'`href`.

## Mesures, et les deux rouges vus au passage

- `ci:check` vert : **551 spécifications, 28 fichiers, 0 échec** (deux passages consécutifs).
- Banc E2E complet vert sur volume neuf (`down -v` puis `up`) : **107 cas, 0 échec**.

Deux rouges ont été observés **avant** ces mesures, et aucun n'est laissé derrière :

1. **Un cas de `packages/spec` non identifié, une fois sur quatre passages** (550/1). Les trois
   passages suivants sont verts, à l'identique, sur le même arbre. Le seul cas instable connu de
   la suite est la mesure de charge de l'Atlas (`atlas-api.spec.ts:448`, `p95 ≤ 200 ms`), déjà
   consigné comme fluctuant sous contention dans `.docs/03-active-task.md`. Il n'a pas été
   retouché : cette phase n'a pas le droit de réécrire une attente de `packages/spec`, et le
   seuil n'est pas en cause (p95 mesuré à 23–61 ms contre 200).
2. **`palmarès — deux tableaux soumis, un classement, un score figé`, sur un volume E2E
   réutilisé.** Reproduit à l'identique en isolation, puis **vert sur volume neuf**. La cause est
   dans le banc, pas dans ce diff : `palmares.spec.ts:189-191` prend la **première** ligne dont le
   texte contient « Tableau dispersé », et chaque exécution supplémentaire dans la même semaine
   ISO en ajoute une de plus, avec un score différent. Ce n'est pas une régression de cette
   phase — le premier passage complet, sur volume neuf, était déjà vert — mais c'est une
   fragilité réelle du banc, hors périmètre de R-003 et non corrigée ici.

