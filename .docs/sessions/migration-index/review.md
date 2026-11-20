---
verdict: approve
---

# Revue — Phase 30.1 (migration `0013_shop`)

Périmètre relu : `packages/db/migrations/0013_shop.ts`, `packages/db/src/migrator.ts`,
`packages/spec/src/ledger.spec.ts`, `.docs/02-database.md` (§2, §4.1, §4.6, §7.1).

## Verdict

**Prêt à livrer.** Aucun défaut *deal-breaker*. Un défaut mineur trouvé et corrigé pendant
la passe.

## Ce que la revue a vérifié

| Point | Constat |
| ----- | ------- |
| Prédicat de l'index | `reason like 'PURCHASE:%'` exige le deux-points : `PURCHASE_REFUND:<id>` n'est **pas** couvert. Prouvé par un cas dédié (deux remboursements identiques → deux lignes). |
| Rejouabilité | `create unique index if not exists`, `insert … on conflict (key) do nothing`. Test de rejeu réel : `kysely_migration` et `kysely_migration_lock` supprimées sur la base de test, 13 migrations rejouées, second passage sans effet. |
| Migrations livrées | `0001`–`0012` et `packages/db/src/schema.ts` intacts. |
| Ordre du `migrator.ts` | import et clé ajoutés **à la fin**, aucune réécriture de la liste. |
| Contrat | Aucune table ni colonne nouvelle ; la clé `SHOP_DAILY_PURCHASE_CAP` est un `number` JSON `12000`, vérifié par `toBe(12000)` et non par une comparaison de chaîne. |
| Aucun `CHECK` | Le plafond reste une clé `game_config` ; aucune contrainte de plafond n'a été introduite. |
| Isolation de la spec | Chaque cas crée son propre compte, `afterAll` supprime les comptes créés (cascade sur `currency_ledger`), aucun état partagé entre cas. |

## Défauts

### Corrigé pendant la revue

- 🟢 `down` supprimait `SHOP_DAILY_PURCHASE_CAP` sans regarder sa valeur. Si un exploitant
  avait réglé le plafond à autre chose que 12 000, un `down` aurait effacé son réglage. La
  suppression est désormais gardée par `and value = '12000'::jsonb`, comme le fait déjà
  `0009_scratch_charges`.

### Mineurs acceptés

- 🟢 `up` crée l'index avant de semer la clé : deux instructions indépendantes, l'ordre est
  sans conséquence (aucune des deux ne dépend de l'autre).
- 🟢 La spec ne vérifie pas que l'index est *partiel* par introspection (`pg_indexes.indexdef`) :
  le comportement des deux cas `MARKET_BUY` et `PURCHASE_REFUND` le prouve, et une assertion sur
  le texte du DDL serait un couplage à la forme du plan d'exécution, pas au contrat.

## Fonctionnel — critères

1. ✅ Index présent après migration (cas 1 + `pg_indexes` en base de test).
2. ✅ Deux `PURCHASE:<même id>` → une ligne (cas 2).
3. ✅ Deux `MARKET_BUY` → deux lignes (cas 3).
4. ✅ `SHOP_DAILY_PURCHASE_CAP` = `12000` (cas 5).
5. ✅ Rejeu sans erreur (procédure manuelle sur base de test, hors suite).
6. ✅ `ci:check` vert — 272 spécifications, 16 fichiers.

## Relevé

Le compte d'`expect()` n'est pas un invariant (constat consigné aux phases 20 à 23) : les
chiffres stables sont le nombre de spécifications et de fichiers.
