# Journal — Phase 32, « Le Socle de la v2 »

Session du 2026-11-22 · branche `feat/v2-32-socle` · migration `0014_ref_integrity`.

---

## 1. Ce qui a été mesuré avant d'écrire

| Mesure | Valeur |
| :--- | :--- |
| Chunk d'entrée, avant | `index-CvGIS3vT.js` — **478,09 Ko bruts / 145,61 Ko gzip** |
| `autoCodeSplitting` | **déjà `true`** depuis `eb18205` — les routes étaient donc déjà découpées |
| 404 | aucun `defaultNotFoundComponent` ; cinq `throw notFound()` rendaient la page anglaise |
| `skip` E2E | aucun — le seul `test.skip` est le commentaire de `mobile.spec.ts:599` qui documente sa suppression |
| Cas double-appui | **déjà présent** et déjà débloqué par `market-fixture.ts` (`mobile.spec.ts:580`) |
| `origin/v2` | existe : `git ls-remote --exit-code --heads origin v2` → code 0, `fe757014` |

**Conséquence.** Le « découpage par route » demandé par le brief était déjà fait. Le gain
restant est le **vendor** absorbé par le chunk d'entrée : c'est là que porte le lot 1.

---

## 2. Le point dur de la phase — et pourquoi le contrat a été rendu autrement

Le brief demandait une **FK `(category, ref_code)` par table** (BUG-002) et un **`CHECK` sur
`ref_regions.code`** (BUG-003). Les deux sont **inatteignables sans réécrire `packages/spec`**,
ce qui est interdit. Ce n'est pas une opinion, c'est mesuré, deux fois.

**Première mesure — les fixtures fabriquent volontairement de l'hors-référentiel :**

| Fixture | Ce qu'elle fait | Ce que la FK/le CHECK lui ferait |
| :--- | :--- | :--- |
| `achievements.spec.ts:295-306` | carte `COMMUNE`, `ref_code = '<préfixe>-<uuid8>'`, **sans référentiel semé** | `23503` à l'insertion |
| `cards.spec.ts:97`, `charges.spec.ts:128`, `market.spec.ts:78`, `tableaux.spec.ts:134,184`, `tickets.spec.ts:219,997` | `ref_regions` aux codes `<préfixe>-R1` | `23514` par le `CHECK` |
| `scripts/import/src/e2e-seed.ts:22-24` | référentiel du banc aux codes `E2E-R1` / `E2E-R2` | `23514` → **banc entier rouge** |
| `tickets.spec.ts:345-363` et `afterAll` équivalents | suppriment les `ref_*` **avant** `"user"`, donc pendant que des cartes les citent | `23503` → **nettoyage en échec** |

**Seconde mesure — deux cas gelés vident `ref_odonymes` :** `tickets.spec.ts:991` et `:1075`
(`truncate table commune_odonymes, ref_odonymes`) pour éprouver la robustesse du tirage. Une
garde `TRUNCATE` sur cette table les rend rouges. C'est exactement ce que la première version de
`0014` a produit : `2 fail`, « un jumelé ne dépasse jamais la rareté RARE » et « un référentiel
totalement vide reste une erreur explicite », avec `la table ref_odonymes est citée par 14
carte(s)`.

**Décision retenue, et l'alternative écartée.** La FK et le `CHECK` de table sont écartés. La
protection est posée là où le dégât se produit réellement :

1. `TRUNCATE` gardé sur `ref_regions`, `ref_departements`, `ref_communes` (`23503`) — c'était
   littéralement l'opération de l'import (`truncateReferenceTables`).
2. `--merge` dans l'import : upsert + `pruneUnreferencedReferenceRows`, qui **ne supprime jamais
   une ligne citée**. C'est la « procédure de réimport qui ne casse pas une collection ».
3. `orphan_user_cards()` : rend visible ce que `routes/cards.ts:114` affichait sans nom.
4. BUG-003 à la frontière que le bug propose lui-même : `isFrenchRegionCode` +
   `REFERENCE_CODE_INVALID` dans `scripts/import`, **avant la première écriture**.

**Ce qui reste ouvert et n'est pas coché.** Une insertion SQL directe d'une carte vers un code
inexistant reste acceptée ; `ref_code` n'a pas de FK. Aucun chemin applicatif ne peut la produire
(les quatre fonctions de tirage lisent leur `ref_code` dans la table qu'elles citent), mais le
verrou n'est pas déclaratif.

---

## 3. Une erreur d'analyse corrigée par la spec, pas par le code

Premier test de garde : `truncate table ref_regions` seul rendait **`0A000`**, pas `23503`.
Cause : `ref_regions` est référencée par `ref_departements.code_region` et
`ref_communes.code_region`, donc PostgreSQL refuse le vidage partiel (`feature_not_supported`)
**avant** toute garde applicative. La garde n'était jamais atteinte. Le cas vide désormais les
cinq tables ensemble, comme l'import.

Second défaut du même cas : le `keep` de l'élagage contenait encore `regionCited`, si bien que la
ligne « conservée » l'était parce qu'elle figurait dans `keep`, et non parce qu'une carte la
citait. Le cas n'aurait rien prouvé. Corrigé : les deux lignes du cas sont hors de `keep`.

---

## 4. Le 404 — un vrai défaut trouvé par le navigateur

`defaultNotFoundComponent` et `notFoundComponent` se sont d'abord montrés **imbriqués** : le
routeur rend le composant de repli **dans l'`Outlet`** de la route qui gère le défaut. Ma page
ré-emballait `AppShell`, d'où **deux `<main>`, deux rails et deux barres d'onglets**. La spec
`not-found.spec.ts` l'a attrapé (`strict mode violation: getByRole('main') resolved to 2
elements`) — un typecheck n'aurait jamais vu ça.

Correction : le composant ne porte plus la coquille ; elle est fournie une seule fois par la
route racine. Le cas asserte désormais `toHaveCount(1)` sur `<main>`, avec le commentaire de la
cause.

---

## 5. BUG-001 — procédure d'opérateur, **écrite et non exécutée**

BUG-001 est une action sur la base de développement. Rien n'a été lancé : les requêtes ci-dessous
sont le script à jouer par un opérateur, dans cet ordre.

### 5.1 Contrôle préalable (lecture seule)

```sql
-- Les quatre contrôles du registre : chacun doit rendre 0 après nettoyage.
select count(*) from ref_regions       where code !~ '^[0-9]+$';
select count(*) from ref_departements  where code !~ '^[0-9]+$' and code not in ('2A', '2B');
select count(*) from ref_communes      where code_insee !~ '^[0-9]';
select count(*) from ref_odonymes      where nom_affichage ~ '^[0-9a-f]{8} Rue';

-- Les cartes réellement concernées, à relire avant toute suppression.
select uc.id, uc.user_id, uc.category, uc.ref_code, uc.rarity, uc.score, uc.acquired_at
from user_cards uc
where (uc.category = 'REGION'
        and not exists (select 1 from ref_regions r where r.code = uc.ref_code))
   or (uc.category = 'DEPARTEMENT'
        and not exists (select 1 from ref_departements d where d.code = uc.ref_code))
   or (uc.category = 'COMMUNE'
        and not exists (select 1 from ref_communes c where c.code_insee = uc.ref_code))
   or (uc.category = 'RUE'
        and not exists (select 1 from ref_odonymes o where o.id::text = uc.ref_code));

-- La fonction livrée par 0014 doit rendre la même liste, par construction.
select * from orphan_user_cards();
```

### 5.2 Ce que les lignes de test référencent encore

```sql
-- Aucune ligne de test ne doit être citée ailleurs qu'en `user_cards`.
select 'commune_odonymes' as origine, count(*)
from commune_odonymes co
join ref_communes c on c.code_insee = co.code_insee
where c.code_insee !~ '^[0-9]'
union all
select 'ticket_reveals', count(*)
from ticket_reveals tr
join user_cards uc on uc.id = tr.card_user_id
where uc.ref_code !~ '^[0-9]';
```

### 5.3 Réparation (transactionnelle, à jouer **uniquement** après relecture de 5.1)

```sql
begin;

-- 1. Les cartes d'abord : ce sont elles qui portent le `ref_code` fautif, et la
--    garde `TRUNCATE` de 0014 n'autoriserait de toute façon pas l'inverse.
delete from user_cards uc
where (uc.category = 'REGION'
        and not exists (select 1 from ref_regions r where r.code = uc.ref_code))
   or (uc.category = 'DEPARTEMENT'
        and not exists (select 1 from ref_departements d where d.code = uc.ref_code))
   or (uc.category = 'COMMUNE'
        and not exists (select 1 from ref_communes c where c.code_insee = uc.ref_code))
   or (uc.category = 'RUE'
        and not exists (select 1 from ref_odonymes o where o.id::text = uc.ref_code));

-- 2. Les odonymes de test (préfixe hexadécimal de 8 caractères + « Rue »).
delete from commune_odonymes co
using ref_odonymes o
where o.id = co.odonyme_id
  and o.nom_affichage ~ '^[0-9a-f]{8} Rue';

delete from ref_odonymes where nom_affichage ~ '^[0-9a-f]{8} Rue';

-- 3. Les communes, départements et régions de test, dans l'ordre des clés
--    étrangères. `delete`, jamais `truncate` : 0014 refuse le vidage d'une table
--    encore citée, et cette procédure ne doit rien détruire d'autre.
delete from ref_communes     where code_insee !~ '^[0-9]';
delete from ref_departements where code !~ '^[0-9]+$' and code not in ('2A', '2B');
delete from ref_regions      where code !~ '^[0-9]+$';

-- 4. Contrôle final : les quatre compteurs doivent valoir 0 et les deux
--    `delete` d'étape 1 ne doivent plus rien trouver.
select count(*) from orphan_user_cards();

commit;
```

### 5.4 Ce qu'il ne faut pas faire

- **Ne pas** remplacer les `delete` par un `truncate … cascade` : `cascade` emporterait
  `user_cards` de vrais joueurs par les clés étrangères de `tableaux` et `market_listings`.
- **Ne pas** rejouer `bun run ci:check` sur la base de développement après coup sans
  `TEST_DATABASE_URL` — le garde-fou refuse, et c'est voulu.
- **Ne pas** considérer la procédure comme exécutée : elle ne l'est pas. Le constat du
  `2026-11-22` est celui du registre.

---

## 6. Vérification

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_32' \
  dev bun run ci:check
  ✓ 1/4 Lint
  ✓ 2/4 Typecheck
  ✓ 3/4 Base de données
  ✓ 4/4 Spécifications   ← 348 pass, 0 fail, 19 fichiers
  ✓ Gatekeeper vert.
```

```
docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm seed
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  72 passed (2.5m)   ← 68 de référence + 1 second compte + 3 salle introuvable
```

Aucun `skip` ajouté, aucune assertion retirée.

**Build, avant / après** (le chunk d'entrée) :

| | Avant | Après |
| :--- | ---: | ---: |
| Chunk d'entrée | 478,09 Ko bruts / 145,61 Ko gzip | **50,92 Ko bruts / 15,97 Ko gzip** |
| Plus gros chunk | 478,09 Ko | **410,33 Ko** (`vendor-react`) |
| Chunks > 500 Ko | 0 | **0** |

---

## 7. Deux écarts assumés, écrits ici plutôt que corrigés en silence

1. **Le second compte n'a pas réveillé le cas de double-appui : il l'était déjà.** Le brief
   supposait le cas « laissé en attente », alors que `mobile.spec.ts:580` l'assertait déjà, adossé
   à `market-fixture.ts`. Ce que cette phase ajoute réellement, c'est une **session** : le vendeur
   de `market-fixture.ts` est une ligne SQL sans mot de passe, donc jamais connectable. Les phases
   37 (amis), 40 (troc) et 39 (notifications) exigeaient deux sessions simultanées ;
   `packages/e2e/fixtures/second-account.ts` les fournit, avec une vraie inscription par l'API et
   un `storageState` consommable par `test.use`.
2. **La garde `ref_odonymes` manque.** Elle est techniquement possible mais rendrait rouges deux
   cas gelés. C'est le seul endroit où le contrat de données est plus faible que demandé, et le
   §2 explique pourquoi.

---

## 8. Portée

**Nouveaux fichiers** : `packages/db/migrations/0014_ref_integrity.ts`,
`packages/db/src/reference-integrity.ts`, `packages/shared/src/reference-codes.ts`,
`packages/spec/src/ref-integrity.spec.ts`, `packages/e2e/fixtures/second-account.ts`,
`packages/e2e/tests/second-account.spec.ts`, `packages/e2e/tests/not-found.spec.ts`,
`apps/web/src/components/ui/not-found.tsx`, `apps/web/src/content/not-found.ts`.

**Modifiés** : `apps/web/vite.config.ts`, `apps/web/src/main.tsx`,
`apps/web/src/routes/__root.tsx`, `packages/db/src/{index,migrator}.ts`,
`packages/shared/src/index.ts`, `packages/e2e/global-setup.ts`,
`scripts/import/src/{args,index}.ts`, `.docs/02-database.md`, `.docs/04-bugs.md`.

**Aucune dépendance nouvelle. Aucun fichier de `packages/spec` existant modifié.**
`.docs/03-active-task.md`, `ROADMAP.md`, `.docs/01-architecture.md` et `main` ne sont pas touchés.
