# Revue — Phase 32, « Le Socle de la v2 »

Passe hostile sur le diff complet de `feat/v2-32-socle`, jouée après `03-assert`, sur les deux
chiffres réels : `ci:check` **348 spécifications / 19 fichiers / 0 échec** et banc E2E
**72 passés / 0 échoué / 0 ignoré**.

## Verdict : **prêt à livrer**, avec deux critères rendus autrement que demandé

Le code est livrable et vérifié. Mais deux critères du brief ne sont pas tenus dans leur forme
littérale, et je préfère les laisser non cochés plutôt que de les déclarer atteints :

| # | Critère | État | Pourquoi |
| :--- | :--- | :--- | :--- |
| 1 | Aucun chunk > 500 Ko, avant/après cité | **tenu** | 478,09 Ko → **50,92 Ko** ; plus gros chunk **410,33 Ko** |
| 2 | 404 français, URL inconnue **et** `notFound()` | **tenu** | 3 cas E2E, coquille unique mesurée |
| 3 | `ref_code` protégé, réimport non destructeur, spec rouge→verte | **partiellement tenu** | le réimport est non destructeur et prouvé ; **il n'y a pas de clé étrangère** sur `ref_code` |
| 4 | `ref_regions.code` refuse un code non français | **tenu à la frontière d'import** | la **table** n'a pas de `CHECK` ; l'import refuse avant écriture |
| 5 | Second compte idempotent, rejouable 2× | **tenu** | rejoué deux fois, `2 passed` ×2 |
| 6 | Banc vert, second compte compris, aucun `skip` | **tenu** | 72 passés, 0 ignoré |
| 7 | BUG-002/003 corrigés, BUG-001 ouvert + procédure | **tenu** | `.docs/04-bugs.md`, journal §5 |
| 8 | `ci:check` vert | **tenu** | 348 / 19 / 0 |

**La raison des critères 3 et 4, en une phrase.** Une FK `(category, ref_code)` et un `CHECK` de
table rejettent des fixtures que la phase n'a pas le droit de réécrire — `achievements.spec.ts`
fabrique une carte sans référentiel, cinq fichiers de spec et le banc sèment des codes
synthétiques, deux cas gèlent `ref_odonymes` par `TRUNCATE`, et les `afterAll` suppriment les
`ref_*` avant `"user"`. Mesuré, pas supposé : la première version de `0014` a rendu `2 fail`.

## Défauts trouvés dans mon propre diff, et corrigés

### 1. Deux `<main>` imbriqués dans la page 404 — **deal-breaker**, corrigé

`notFoundComponent` est rendu **dans l'`Outlet`** de la route qui gère le défaut. Ma page
ré-emballait `AppShell`, donc deux `<main>`, deux rails et deux barres d'onglets. Attrapé par le
banc (`strict mode violation: getByRole('main') resolved to 2 elements`), invisible au typecheck.
Corrigé : le composant ne porte plus la coquille. Le cas E2E asserte `toHaveCount(1)`.

### 2. L'import vidait avant de valider — **deal-breaker**, corrigé

`assertFrenchRegionCodes` était placé après le `TRUNCATE` : une source corrompue détruisait le
référentiel puis échouait. Le vidage est désormais dans le bloc API Gouv, **après** chargement et
validation.

### 3. Une garde `TRUNCATE` sur `ref_odonymes` cassait deux cas gelés — **majeur**, corrigé par retrait

`tickets.spec.ts:991` et `:1075` vident `ref_odonymes` volontairement. La garde les rendait
rouges. Retirée ; les cartes de rue ne sont protégées que par l'élagage `--merge`. C'est le seul
endroit où la protection est plus faible que demandé, et c'est écrit dans `.docs/02-database.md`.

### 4. Le cas d'élagage ne prouvait rien — **majeur**, corrigé

`regionCited` figurait encore dans `keep`, donc « conservée » l'était par appartenance à `keep`,
pas parce qu'une carte la citait. Le cas serait passé avec un élagage qui détruit tout. Les deux
lignes du cas sont désormais hors de `keep`, et `deleted = 1` / `preserved = 1` sont assertés
ensemble.

## Défauts connus, non corrigés, et pourquoi

| Gravité | Défaut | Arbitrage |
| :--- | :--- | :--- |
| Moyenne | Pas de FK sur `user_cards.ref_code` : une insertion SQL directe d'une carte orpheline reste acceptée | Réécrire 7 fixtures gelées coûterait plus que le risque ; `orphan_user_cards()` rend la ligne trouvable. Aucun chemin applicatif ne peut la produire. |
| Moyenne | Le chemin `--merge` n'a **jamais** été exécuté de bout en bout (il demande l'API Gouv et la BAN) | Seul son cœur est prouvé : `pruneUnreferencedReferenceRows` est testé par la spec. Le reste est typechecké, pas exercé — écrit tel quel dans le journal. |
| Basse | `pruneUnreferencedReferenceRows` passe jusqu'à ~450 000 clés dans un seul paramètre `text[]` | Une seule instruction : en cas d'échec, rien n'est supprimé. Aucune mesure à cette échelle. |
| Basse | `preserved = stale - deleted` est une soustraction entre deux requêtes, donc sensible à une écriture concurrente | Le calcul est indicatif (journal) ; la suppression, elle, est correcte par construction. |
| Basse | `defaultNotFoundComponent` du routeur est redondant avec le `notFoundComponent` de la racine, qui gagne toujours | Le critère autorise l'un **ou** l'autre ; les deux couvrent un futur arbre de routes sans repli racine. Coût nul. |
| Basse | `chunkSizeWarningLimit: 500` est un seuil d'**avertissement**, pas une barrière de build | Aucun chunk ne l'atteint (410 Ko max). C'est une documentation exécutable, pas un verrou ; je ne le présente pas comme une garantie. |

## Ce que la revue confirme de solide

- **Aucun fichier de `packages/spec` existant n'est modifié.** Le nouveau fichier
  `ref-integrity.spec.ts` est le seul ajout, et il n'affaiblit rien : ses cinq cas assertent des
  refus (`23503`), une conservation (`preserved = 1`) et huit codes rejetés.
- **Aucun `skip`, aucune assertion retirée, aucun délai relâché.** Les 68 cas de référence sont
  intacts ; les 4 ajoutés sont visibles au rapport (72 = 68 + 1 second compte + 3 salle
  introuvable).
- **Aucune dépendance nouvelle.** `node:zlib`, `node:fs`, `@playwright/test`, `kysely` étaient
  déjà là.
- **`main` n'est pas touché**, `.docs/03-active-task.md` non plus, `routeTree.gen.ts` est régénéré
  par `tsr generate` et n'apparaît pas dans le diff.
- **La migration est rejouable** : `create or replace function` et `drop trigger if exists` avant
  chaque `create trigger`, donc un rejeu ne lève rien.

## Recommandation

Livrer en brouillon vers `v2`. Ne pas fusionner avant que le titulaire ait tranché s'il veut une
FK déclarative : elle exigerait alors la réécriture des fixtures, donc une décision explicite et
non un effet de bord de cette phase.
