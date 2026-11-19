---
objective: "Un joueur obtient des médailles, chacune verse une seule fois des écus par currency_ledger, ce qui rend le marché solvable."
status: done
---

# Plan: Phase 27 — Les Médailles (succès → écus)

Source: brief de session phase 27, `ROADMAP.md` §2 (phase 27), `.docs/01-architecture.md` §2.8, `.docs/02-database.md` §4.6/§4.8/§6/§7.1.

## Phases

| #   | Phase        | File                         | Depends on |
| --- | ------------ | ---------------------------- | ---------- |
| 1   | Catalogue partagé + spec rouge | [`phase-1.md`](./phase-1.md) | none |
| 2   | Migration `0011_achievements` | [`phase-2.md`](./phase-2.md) | none |
| 3   | Service de versement + route | [`phase-3.md`](./phase-3.md) | 1, 2 |
| 4   | Intégration : idempotence et achat | [`phase-4.md`](./phase-4.md) | 2, 3 |
| 5   | Interface des médailles | [`phase-5.md`](./phase-5.md) | 1, 3 |
| 6   | Preuve `ci:check` | [`phase-6.md`](./phase-6.md) | 1, 2, 3, 4, 5 |

## External sources

| URL   | What it settled   |
| ----- | ----------------- |
| none  | Contrat interne : `.docs/01-architecture.md` §2.8 et `.docs/02-database.md` §4.8 suffisent. |

## Impact

| Category                                           | Verdict and evidence | Handled in         |
| -------------------------------------------------- | -------------------- | ------------------ |
| runtime | Le marché n'a aucun robinet : `currency_ledger` n'est écrit que par `market.ts` (`MARKET_BUY`/`MARKET_SELL`), donc un compte neuf (`currency = 0`) ne peut rien acheter. Le versement des médailles crée la première source de solde. | 3, 4 |
| regression | `packages/spec` compte 11 fichiers ; la phase en ajoute un et ne touche aucun cas existant. `tickets_one_active_per_user`, `market_listings_open_card_idx` et la liste fermée des `reason` restent intacts. | 6 |
| architecture | Nouvelle table `user_achievements` (statut Contrat → Migrée) et nouvelle route protégée `GET /api/v1/achievements` ; catalogue pur dans `packages/shared`. Aucune évolution du contrat lui-même. | 1, 2, 3 |
| documentation | `.docs/02-database.md` §2 : `user_achievements` passe de **Contrat** à **Migrée**. Aucun autre document de mémoire modifié (interdit par la session). | 2 |

## Rules

| Rule   | Why it applies |
| ------ | -------------- |
| Spec-first, jamais modifier un cas existant | `packages/spec` est la source de vérité exécutable ; les cas neufs sont écrits et vus rouges avant le code. |
| Aucune table ni colonne inventée | Seul `user_achievements` tel que `.docs/02-database.md` §4.8 le décrit est créé ; aucune colonne de progression. |
| Serveur autoritaire | La progression est recalculée depuis les tables source ; le client n'envoie jamais un compteur. |
| Migration 0011 uniquement | Les numéros 0009 (charges) et 0010 (amis) appartiennent à d'autres sessions. |
| Tout dans Docker | `bun`, `tsc`, `vite` ne tournent jamais sur l'hôte. |
| Français uniquement | Clés et types en anglais (comme `CardCategory`), libellés visibles en français. |

## Decisions

| Decision   | Why   |
| ---------- | ----- |
| Le catalogue porte un `metric` typé et un `threshold` ; la progression est un `Record<AchievementMetric, number \| null>`, `null` signifiant « source indisponible, médaille verrouillée ». | Les sextuplés du ROADMAP ne sont pas tous comparables (un palier de rareté, une rue à `N = 1`, un multiplicateur en dixièmes). Une métrique typée garde la comparaison `progress >= threshold` uniforme et testable. |
| Les médailles sociales restent **déclarées et verrouillées** dans cette phase. | Le ROADMAP §2 le prescrit explicitement (« ship declared and locked with this phase, then unlock in phase 28 ») et `friendships` n'existe ni dans `schema.ts` ni en migration sur cette base. Le comptage `ACCEPTED` est écrit et testé comme fonction pure, prêt à être branché. |
| Le versement insère la médaille puis la ligne de grand-livre dans la même transaction, et ne paie que si l'insertion a réellement créé la ligne. | L'idempotence tient à la clé primaire `(user_id, achievement_key)` : aucun `SELECT` préalable n'est fiable sous concurrence. |
| `ACHIEVEMENT_PAYOUTS_ENABLED` est semé par la migration 0011 en `ON CONFLICT DO NOTHING`. | La phase 26 sème les six clés de `game_config`, mais elle n'est pas sur cette base ; sans la clé, le service ne peut pas distinguer « interrupteur absent » de « interrupteur à false ». Le semis est idempotent et compatible avec celui de la phase 26. |
