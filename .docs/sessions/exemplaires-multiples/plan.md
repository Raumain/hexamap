# Plan — Phase 47, les exemplaires multiples se lisent

## Contrat

Source normative : `.docs/10-retours-v2.md`, R-007 **constat A** (l. 238-284), et le brief de
phase. Aucune route, aucun champ de réponse, aucune migration, aucun index. L'agrégation est
**côté client** sur les lignes déjà reçues de `GET /cards`.

## Décisions de conception

1. **Le module vit dans `packages/shared/src/exemplaires.ts`** (pur, sans React ni routeur),
   réexporté par `packages/shared/src/index.ts` (`export * from './exemplaires';`, inséré à sa
   place alphabétique après `charges`). C'est le choix préféré par le brief §11 : `packages/spec`
   l'importe par `@hexamap/shared`, sans chemin relatif vers `apps/web`.
2. **Une seule fonction publique** : `groupExemplaires(cards)`. Elle rend une liste de groupes
   `{ key, representative, count, rank }`, dans l'ordre de première apparition.
   - `key` = `craftGroupKey({ category, refCode, rarity })` — la fonction de
     `packages/shared/src/atelier.ts`, donc la clé de L'Atelier, **jamais** `(category, ref_code)`.
   - `representative` = l'exemplaire le plus récent (`acquiredAt` le plus grand, ISO), à défaut
     le premier rencontré ; `rank` = rang d'apparition du groupe.
   - L'entrée n'est **jamais** mutée : lecture seule, aucune écriture sur les cartes.
3. **Un unique point de conversion vers `craftGroupKey`** : le module construit explicitement
   `{ category: card.category, refCode: card.refCode, rarity: card.rarity }`. La réponse de
   `GET /cards` est déjà en camelCase (`refCode`, `cards.ts:191`) : il n'y a donc pas de
   `ref_code` à convertir côté web, mais aucun composant ne recopie ce mapping — il vit ici.
4. **Deux présentations, une seule vérité** : Le Cadastre, Le Cartel et le tiroir de La Planche
   appellent tous `groupExemplaires` et lisent le `count` du groupe. Aucun composant ne recompte
   (`filter`/`reduce` de comptage interdit hors du module). Les surfaces à carte unique font une
   **lecture** du résultat (`groups.find(...)?.count`), pas un recomptage.
5. **La marque « ×N » vit dans l'habillage de la ligne**, pas dans la planche : les quatre
   gabarits de `components/ui/cards/` ne bougent pas, le budget de ≤ 18 nœuds non-SVG de
   `design-system.spec.ts` reste tenu sans mesure nouvelle, et la hauteur de ligne reste celle du
   contenu (le badge est en ligne, à côté de la planche, dans la hauteur déjà fixée par la
   planche `w-14` + `py-2`).
6. **`total` et le compteur `aria-live` disent ce qu'ils comptent.** `GET /cards` borne sa
   réponse (limit max 5000, `cards.ts:153`) : un total de groupes ne peut pas être connu quand
   la charge est bornée. Le libellé de total reste donc « N cartes au total » (vérité serveur),
   et le compteur filtré devient « X cartes affichées sur Y cartes · Z groupes ». Le préfixe
   `0 cartes affichées` exigé par `cadastre.spec.ts:144` est conservé.
7. **Aucune dépendance nouvelle.**

## Fichiers touchés

| Fichier | Nature |
| --- | --- |
| `packages/shared/src/exemplaires.ts` | **nouveau** — module pur d'agrégation |
| `packages/shared/src/index.ts` | ajout d'un `export *` (une ligne) |
| `packages/spec/src/exemplaires.spec.ts` | **nouveau** — spec du module (3 exemplaires, 2 éditions, représentant, non-mutation) |
| `apps/web/src/content/collection.ts` | libellés : marque d'exemplaires, compteur de groupes |
| `apps/web/src/routes/collection.tsx` | une ligne par groupe, marque ×N, total/virtualisation/aria-live |
| `apps/web/src/routes/card.$cardId.tsx` | nombre d'exemplaires de la carte affichée (même agrégation) |
| `apps/web/src/routes/tableau.tsx` | nombre d'exemplaires sur chaque candidate du tiroir |
| `packages/e2e/fixtures/exemplaires-fixture.ts` | **nouveau** — seed idempotent (3 identiques + 2 éditions) |
| `packages/e2e/tests/cadastre.spec.ts` | **nouveau cas** ajouté en fin de fichier ; aucun cas existant modifié |
| `.docs/sessions/exemplaires-multiples/` | plan, revue, journal |

Hors périmètre : `apps/web/src/components/layout/`, `components/ui/cards/`, toute migration,
`apps/api/`, `routeTree.gen.ts`, `types.generated.ts`.

## Ordre des étapes

1. **Spec d'abord (rouge).** Écrire `packages/spec/src/exemplaires.spec.ts` : trois exemplaires
   identiques → un groupe de 3, représentant le plus récent ; deux mêmes `refCode` d'éditions
   différentes → deux groupes ; entrée non mutée ; ordre/rang. Lancer la spec **avant** le code
   et constater l'échec (module absent).
2. **Module.** Écrire `packages/shared/src/exemplaires.ts` et l'export. Spec verte.
3. **Libellés.** `content/collection.ts` : `exemplairesMark`, `exemplairesCountLabel`,
   `collectionGroupsLabel` (français, ≥ 10 px à l'affichage).
4. **Le Cadastre.** `groups = groupExemplaires(filtered)` ; lignes = représentants ; badge
   `×N` dans la ligne ; `aria-live` et total conformes au point 6 ; `estimateSize` inchangé
   (estimation d'avant-mesure, pas une hauteur déclarée).
5. **Le Cartel.** `useQuery(collectionQueryOptions)` + `groupExemplaires` ; afficher
   « N exemplaires » de la carte courante, à côté de ses métadonnées.
6. **Le tiroir de La Planche.** Grouper une fois les `items` reçus ; afficher le compte sur
   chaque candidate (lecture du groupe, pas de second calcul).
7. **Banc E2E.** Fixture idempotente (suppression ciblée puis insertion) : trois exemplaires
   identiques et deux exemplaires de même `refCode` d'éditions différentes, chez le joueur
   principal. Ajouter un cas en fin de `cadastre.spec.ts` : trois identiques → **une** ligne
   portant « ×3 » ; deux éditions → **deux** lignes. Aucun cas existant réécrit, dont la mesure
   de hauteur (l. 177-199) rejouée telle quelle.
8. **Vérifications.** `ci:check` (lint, typecheck, base, specs) dans Docker avec
   `TEST_DATABASE_URL=postgres://hexamap:hexamap@db:5432/hexamap_test_47`, puis banc E2E complet.
9. **Revue hostile** (`05-review`), correctifs, puis commits atomiques et PR brouillon vers
   `feat/v2-retours-wave-1`.

## Vérification de chaque critère

| Critère | Preuve |
| --- | --- |
| 1. ×3 sur une ligne | spec `exemplaires.spec.ts` + cas E2E `cadastre` |
| 2. deux éditions = deux lignes | spec (2e cas) + cas E2E |
| 3. hauteur = contenu | `cadastre.spec.ts:177-199` rejoué sans modification |
| 4. même nombre partout | un seul module ; cas E2E du tiroir |
| 5. aucun recomptage | `grep` des `filter`/`reduce` de comptage hors module + revue du diff |
| 6. les nombres disent ce qu'ils comptent | libellés `content/collection.ts` + assertions E2E |
| 7. spec nouvelle seule | `bun test packages/spec` sans modification d'un cas existant |
| 8. porte verte | `ci:check` + banc E2E complets, chiffres cités dans le journal |
