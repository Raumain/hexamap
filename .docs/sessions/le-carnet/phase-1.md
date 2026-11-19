---
status: done
---

# Instruction: La formule partagée

## Architecture projection

```txt
packages/
  shared/src/
    index.ts          ✏️ exporte le nouveau module
    charges.ts        ✅ formule pure du carnet
  spec/src/
    charges.spec.ts   ✅ cas unitaires, écrits rouges d'abord
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | carnet `{charges: 0, lastRegenAt: t0}`, règles `{cap: 6, regenMs 1 800 000}` | carnet prêt | bun test |
| Happy path | `regenerateCharges(…, t0 + 3 × regen + 1 000)` | `charges === 3`, `lastRegenAt === t0 + 3 × regen` (reste de 1 000 ms conservé) | bun test |
| Edge case | au plafond, `now` très postérieur | `charges === cap`, `lastRegenAt === now`, `nextChargeAt === null` | bun test |
| Edge case | deux lectures successives dans la même fenêtre | `lastRegenAt` inchangé : aucune minute avalée | bun test |
| Edge case | `regenMs <= 0` | aucun crédit, `nextChargeAt === null`, pas de NaN | bun test |
| Teardown | aucun | état du dépôt inchangé (module pur) | system |

## Tasks to do

### `1)` Le module pur

> `packages/shared/src/charges.ts` possède la seule formule, pour le serveur comme pour le front.

1. Déclarer `ChargeRules { cap: number; regenMs: number }`, `ChargeLedger { charges: number; lastRegenAt: number }`, `ChargeBalance extends ChargeLedger { nextChargeAt: number | null }`.
2. `regenerateCharges(ledger, rules, now)`: `earned = floor(max(0, now - lastRegenAt) / regenMs)`, `charges = min(cap, ledger.charges + earned)`; si `regenMs <= 0`, `earned = 0` et `nextChargeAt = null`.
3. Si `charges >= cap`: rendre `{ charges: cap, lastRegenAt: now, nextChargeAt: null }` (figeage).
4. Sinon `lastRegenAt = ledger.lastRegenAt + credited × regenMs` quand `credited > 0` — jamais `now` ; `nextChargeAt = lastRegenAt + regenMs`.
5. `chargesAt(charges, nextChargeAt, rules, now)`: décompte local du front, même arithmétique, avançant par pas de `regenMs` et rendant `nextChargeAt = null` au plafond.
6. Exporter le module depuis `packages/shared/src/index.ts`, en fin de baril.

### `2)` Les cas rouges

> Écrire les cas avant le code, les voir échouer, puis les rendre verts.

1. `packages/spec/src/charges.spec.ts`, `describe('Carnet de charges — formule')`, préfixe de libellé `Archi §2.6 — `.
2. Couvrir : solde dérivé, reste fractionnaire conservé sur deux lectures, figeage au plafond, `nextChargeAt` nul au plafond, plafond à 8, crédit plafonné, horloge qui recule (`now < lastRegenAt`), `regenMs <= 0`, et `chargesAt` (avant l'échéance, après, au plafond).

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `regenerateCharges` ne rend jamais `nextChargeAt` non nul au plafond, et n'avance jamais `lastRegenAt` avant une charge entière acquise. |
| 1 | Aucun `Date.now()` dans le module : `now` est un paramètre. |
| 2 | Les cas sont rouges avant l'implémentation (module absent), verts après, sans qu'aucun cas existant ne soit modifié. |
