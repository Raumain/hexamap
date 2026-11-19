---
status: done
---

# Instruction: Intégration — idempotence et achat après médaille

## Architecture projection

```txt
packages/spec/src/
  achievements.spec.ts   ✅ cas d'intégration ajoutés au fichier de la phase 1
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | deux comptes inscrits, une annonce ouverte à 100 écus | vendeur possesseur d'une carte, acheteur à 0 écu | api |
| Happy path   | l'acheteur gratte un ticket puis achète | `ACHIEVEMENT:SCRATCH_FIRST_TICKET` écrit une fois, solde 100, achat réussi | api |
| Edge case    | l'évaluation tourne deux fois | une seule ligne `user_achievements`, une seule ligne de grand-livre | api |
| Edge case    | deux évaluations concurrentes | une seule paie (clé primaire composite) | api |
| Teardown     | suppression des comptes de test | base au niveau de départ | system |

## Tasks to do

### `1)` Cas d'intégration du versement

> Le seul cas qui ferme le trou « le marché n'a pas de robinet ».

1. Réutiliser le motif de `market.spec.ts` : `createDb(DATABASE_URL)`, `runMigrations`, `app.handle`, `signUp`, `authFetch`.
2. Cas « un compte neuf verse 0 écu ».
3. Cas « une médaille paie une seule fois » (deux appels successifs).
4. Cas « deux versements concurrents ne paient qu'une fois » (`Promise.all`).
5. Cas « interrupteur à `false` » : basculer la clé, évaluer, constater l'absence de versement, restaurer.

### `2)` Cas d'achat et nettoyage

> La preuve que la monnaie est dépensable.

1. Cas « un joueur avec une médaille peut acheter » : verser, puis acheter une annonce à 100 écus.
2. Nettoyage par suppression des comptes créés (`createdUserIds`).

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `currency` reste à 0 et `currency_ledger` est vide pour un compte neuf |
| 1 | exactement une ligne de médaille et une ligne `ACHIEVEMENT:<key>` après deux appels |
| 1 | une seule ligne de grand-livre pour la clé sous `Promise.all` |
| 1 | aucune ligne écrite quand l'interrupteur est à `false`, médaille non obtenue |
| 2 | l'achat répond 200, la carte change de propriétaire, le solde devient 0 |
