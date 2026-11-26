# Revue — Phase 34, L'Assemblage, l'API

**Verdict : prêt à livrer.** Aucun défaut *deal-breaker* ouvert. Le critère 6
(`< 60 Ko` par département) n'est **pas coché** : il est contredit par la donnée réelle, chiffres
ci-dessous.

Diff relu : `apps/api/src/{app.ts,routes/atlas.ts,services/atlas.ts}`,
`packages/shared/src/{atlas.ts,index.ts}`, `packages/spec/src/atlas-api.spec.ts`, plus le dossier
de session. Aucune migration, aucun changement de schéma, aucun fichier de `apps/web`.

---

## Défauts trouvés et corrigés pendant la session

| # | Gravité | Défaut | État |
| - | ------- | ------ | ---- |
| 1 | *deal-breaker* | Le plan laissait la CTE `region_cards` (et `departement_cards`) sans filtre `user_id` : `hasRegionCard` aurait reflété les cartes **d'un autre joueur**. Trouvé par la passe de relecture du plan, avant écriture du code. | **Corrigé** : chaque CTE qui lit `user_cards` porte `user_id = ${userId}` (7 occurrences vérifiées dans `services/atlas.ts`). |
| 2 | *deal-breaker* | Aucun cas de spec n'assertait `hasRegionCard` ou `hasDepartementCard` à `true` : le défaut 1 serait revenu sans être vu. | **Corrigé** : cas ajouté « marque la possession des cartes de région et de département pour le seul compte demandeur », qui vérifie aussi qu'un **second** compte voit `false` — c'est le garde anti-fuite. |
| 3 | *suggestion* | Un `with …` n'est pas une expression `select` en PostgreSQL (`42601`). Les deux instructions sont donc une sous-requête scalaire parenthésée `select (with … ) as payload`. | **Assumé et commenté** dans le service. |
| 4 | *suggestion* | Une sous-requête scalaire rend toujours une ligne : `executeTakeFirst()` ne rend jamais `undefined` sur un code inconnu, c'est `payload` qui est nul. | **Traité** : `if (!payload) return null`, commenté. Sans quoi un code inconnu répondait `422` au lieu de `404`. |

## Défauts connus, non bloquants, laissés en l'état

| # | Gravité | Défaut | Pourquoi il n'est pas corrigé ici |
| - | ------- | ------ | --------------------------------- |
| 5 | *suggestion* | `services/atlas.ts` porte du `sql` brut (`selectNoFrom([sql…])`), alors que `apps/api/AGENTS.md` dit « Pas de SQL brut dans les services, sauf health check ou import massif » et que `.docs/02-database.md` §1.7 réserve le SQL brut aux migrations et à l'import. | C'est le prix du critère 1 : `json_build_object` + `json_agg` ne s'expriment pas dans le constructeur typé de Kysely, et une seconde instruction rouvrirait exactement le N+1 interdit. La requête reste une `Kysely` (`selectNoFrom`), pas un `executeQuery`. **Décision documentée dans `plan.md`**, à porter en règle du dépôt si le motif doit se répéter. |
| 6 | *suggestion* | La CTE `owned` du détail n'est pas restreinte au département : elle agrège toute la collection `COMMUNE` du joueur avant de filtrer. | L'index `user_cards_owner_idx (user_id, category)` la couvre et le coût mesuré reste de 30 ms à 2 000 cartes. Resserrer la CTE (`join ref_communes … and c.code_departement = ${code}`) reste la bonne évolution si une collection dépasse quelques dizaines de milliers de cartes. |
| 7 | *suggestion* | Les deux routes ne déclarent pas `500: errorSchema`, alors que `routes/players.ts` le fait. | Elysia ne valide pas un statut non déclaré : aucune panne de schéma. Alignement de convention, sans effet observable. |
| 8 | *suggestion* | `params.code` n'a pas de `maxLength`. | Un code de département fait 2 ou 3 caractères ; la valeur part en paramètre lié, jamais en concaténation SQL. Aucun vecteur d'injection. |
| 9 | *suggestion* | Le cas « n'expose aucune donnée privée » cherche la sous-chaîne `RUE` dans le JSON sérialisé : une commune dont le nom contient « Rue » ferait échouer le cas en production. | Le cas est juste sur les fixtures actuelles et garde la propriété utile (aucune carte de rue dans la charge). Le rendre robuste demanderait de vérifier l'absence de la **clé** `category`, pas d'une sous-chaîne. |

## Points vérifiés, sans défaut

- **Une instruction par route** : `createDb(url, { log })` compte exactement 1 événement
  `level === 'query'` pour `loadAtlasSummary` et 1 pour `loadAtlasDepartement`
  (+1 quand le code est inconnu, et toujours 1 par appel — aucune boucle).
- **`ownedCards` compte les exemplaires, `communesOwned` les communes distinctes** : trois cartes
  de la même commune donnent `ownedCards: 3` et `communesOwned: 1`, au détail **et** dans le
  résumé, sur le département **et** sur la région.
- **`viewBox`** est ajouté en TypeScript depuis `ATLAS_VIEWBOX`, jamais par le SQL ; les deux
  routes le renvoient.
- **`pathD`** est la chaîne brute, sans reprojection ni arrondi ; `null` pour une région sans
  tracé, asserté comme `null` (ni `undefined`, ni `''`).
- **`404`** sur un code inconnu et sur un département `path_d is null` ; **`200`** sur un
  département tracé sans aucune carte ; **`401`** sur les deux routes sans session.
- **Aucune donnée privée** : ni `locked`, ni `currency`, ni `email`, ni `session`, ni `password`,
  ni carte de rue. `geom` n'est jamais lu.
- **Aucun `select *`**, aucune jointure vers `ref_odonymes` ou `commune_odonymes`, aucun `t.Any()`,
  aucun objet ouvert dans les schémas `response`.
- **`packages/spec/src/atlas.spec.ts` (phase 33) n'est pas touché** : mes cas vivent dans
  `atlas-api.spec.ts`.

## Critère d'acceptation non tenu

**Critère 6 — la charge d'un département dense reste sous 60 Ko non compressés.**

| Mesure | Valeur |
| :--- | ---: |
| Département 62 (Pas-de-Calais), base de développement, 887 communes | **166 715 octets** de `path_d` seul |
| Moyenne nationale par commune (`ref_communes`) | 233 octets |
| Commune la plus lourde | 7 198 octets |
| Somme nationale `path_d` (régions + départements + communes) | 8 925 691 octets ≈ 8,5 Mio |
| Fixture de spec, 900 communes à 288 octets de `path_d` | **337 527 octets** de charge utile |

Le plafond de 60 Ko supposerait ~257 communes par département. La décision 6 du brief prescrit,
dans ce cas, d'écrire le chiffre et de **ne pas paginer** : c'est ce qui a été fait. Conséquence
directe : l'affirmation du brief « la phase 33 tient la charge nationale sous 250 Ko » est fausse
d'un facteur ~35 ; la corriger relève de la phase 33 (epsilon ou plafond de points), pas d'ici.

## Écart de contrat signalé

`ATLAS_VIEWBOX` existe déjà dans `scripts/import/src/atlas-projection.ts:28`, comme **nombre**
(`1000`). Le contrat impose `packages/shared/src/atlas.ts` avec **la chaîne** `'0 0 1000 1000'`.
Les deux modules ne se rencontrent nulle part aujourd'hui — aucun conflit de compilation — mais
l'homonymie est réelle et devra être tranchée si un jour un même fichier importe les deux.
