# Journal — Phase 30.1 (migration `0013_shop`)

## 2026-11-20 — L'index qui rend un webhook sûr

**Le périmètre.** Schéma et spec uniquement : aucun écran, aucun Stripe, aucune route. L'index
partiel `currency_ledger_purchase_uniq` et la clé `SHOP_DAILY_PURCHASE_CAP` de `game_config`.

**Le rouge, observé et non supposé.** La spec a été écrite avant la migration, puis jouée sur la
base de test après avoir retiré l'index et la clé tout en laissant `0013_shop` enregistrée dans
`kysely_migration` — le `runMigrations` du `beforeAll` ne réapplique donc rien :

```
1 pass, 3 fail, 8 expect() calls
  index : Expected to contain "currency_ledger_purchase_uniq"
          Received ["currency_ledger_pkey", "currency_ledger_user_idx"]
  rejeu : Expected 1  Received 2
  clé   : Expected length 1  Received length 0
```

Le troisième échec est la conséquence comportementale, pas une redondance : sans index, un rejeu
paie deux fois. Le cas `MARKET_BUY` passait déjà, pour la bonne raison — aucun index ne le couvre.

**Le vert.** Même commande, après réapplication de `0013_shop` : `5 pass, 0 fail, 12 expect()`.
Le cinquième cas, ajouté en revue, verrouille le piège du brief : `PURCHASE_REFUND:<id>` n'est pas
une purchase, l'index ne le couvre pas, deux remboursements identiques écrivent bien deux lignes.

**Le rejeu, prouvé sur une base jetable.** `drop table kysely_migration; drop table
kysely_migration_lock;` puis `bun run db:migrate` deux fois : 13 migrations appliquées au premier
passage, aucune au second, index et clé toujours présents. La procédure reste manuelle, hors de la
suite : une spec qui supprime la table de suivi ferait échouer les autres fichiers du même run.

**Vérification (Docker uniquement)**
```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_301' \
  dev bun run ci:check
  ✓ 1/4 Lint  ✓ 2/4 Typecheck  ✓ 3/4 Base de données  ✓ 4/4 Spécifications
  272 pass, 0 fail, 1634 expect() calls, Ran 272 tests across 16 files
```

**Portée** : un fichier de migration neuf, une entrée dans `migrator.ts`, une spec neuve,
quatre sections de `.docs/02-database.md`. `packages/db/src/schema.ts`, `0001`–`0012`,
`.docs/01-architecture.md`, `ROADMAP.md` et `.docs/03-active-task.md` intacts. Aucune dépendance,
aucune modification de contrat : le DDL était déjà écrit, il est désormais migré.
