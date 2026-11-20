---
objective: "L'index partiel `currency_ledger_purchase_uniq` et la clé `SHOP_DAILY_PURCHASE_CAP` existent après migration, sont verrouillés par une spec d'intégration, et la migration se rejoue sans erreur."
status: implemented
---

# Plan: Phase 30.1 — migration 0013_shop (idempotence d'achat, plafond quotidien)

Source: `.docs/03-active-task.md` (brief de session Phase 30.1), `.docs/02-database.md` §4.6, §4.1, §1 règle 8.

## Phases

| #   | Phase                                        | File                         | Depends on |
| --- | -------------------------------------------- | ---------------------------- | ---------- |
| 1   | Spec rouge + migration + semis + doc         | [`phase-1.md`](./phase-1.md) | none       |

Une seule phase : le périmètre est un index, une clé de configuration, une spec et quatre
paragraphes de contrat. Rien ne se livre séparément.

## External sources

| URL | What it settled |
| --- | --------------- |
| none | Aucune source externe : le contrat est interne (`PostgreSQL 16` partiel unique index). |

## Impact

| Category        | Verdict and evidence | Handled in |
| --------------- | -------------------- | ---------- |
| runtime         | Aucun code d'API ni de front ne lit la clé ou l'index dans cette phase. `game_config` gagne une ligne, `currency_ledger` gagne un index. | phase-1 |
| regression      | `MARKET_BUY`/`MARKET_SELL` restent hors du prédicat `reason like 'PURCHASE:%'` (index partiel) : la spec prouve deux lignes pour deux `MARKET_BUY`. | phase-1 |
| architecture    | Aucune table, aucune colonne, `packages/db/src/schema.ts` inchangé. | phase-1 |
| documentation   | `.docs/02-database.md` §2 (statut Migrée), §4.1 (clé), §4.6 (note au présent), §7.1 (invariant). | phase-1 |

## Rules

| Rule | Why it applies |
| ---- | -------------- |
| Toute migration est rejouable (§1 règle 8) | `if not exists` sur l'index, `on conflict (key) do nothing` sur le semis. |
| Une migration livrée ne change plus de nom (§1 règle 2) | `0001`–`0012` restent intouchées ; `0013_shop` s'ajoute à la fin du `migrator.ts`. |
| Motifs `currency_ledger` en liste fermée (§4.6) | Seul `PURCHASE:<ref>` est concerné par l'index, pas `PURCHASE_REFUND:<ref>`. |
| Aucun `CHECK` sur un réglage de jeu (§4.7) | `SHOP_DAILY_PURCHASE_CAP` est une clé `game_config`, jamais une contrainte. |
| Tout s'exécute dans Docker | `ci:check` et le rejeu passent par `docker compose --profile tools run --rm dev`. |

## Decisions

| Decision | Why |
| -------- | --- |
| Index unique partiel `(user_id, reason) where reason like 'PURCHASE:%'` | L'unicité d'un webhook ne peut pas être une vérification avant insertion (deux livraisons lisent « absent ») : elle doit être portée par la base. |
| `on conflict do nothing` sans cible dans la spec | Attrape l'index partiel sans répéter son prédicat, qui n'est pas une contrainte nommée. |
| La spec vit dans `packages/spec/src/ledger.spec.ts` | Fichier neuf : `packages/spec` n'est jamais réordonné, et le sujet (grand-livre) n'a pas encore de spec. |
