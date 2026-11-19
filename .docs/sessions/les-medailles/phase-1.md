---
status: done
---

# Instruction: Catalogue partagé des médailles et spec rouge

## Architecture projection

```txt
packages/shared/src/
  achievements.ts        ✅ catalogue typé + agrégats purs
  index.ts               ✏️ export du nouveau module
packages/spec/src/
  achievements.spec.ts   ✅ cas de catalogue, écrits rouges d'abord
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | lancer `bun test packages/spec/src/achievements.spec.ts` sans `achievements.ts` | échec de résolution du module (rouge attendu) | system |
| Happy path   | écrire le catalogue puis rejouer le fichier | tous les cas de catalogue verts | system |
| Edge case    | dupliquer une clé ou mettre un montant à 0 | le cas de parité échoue | system |
| Teardown     | aucun état persistant | rien à nettoyer | system |

## Tasks to do

### `1)` Catalogue

> Le catalogue est la seule source des clés, familles, seuils et montants.

1. Exporter `ACHIEVEMENT_FAMILIES`, `ACHIEVEMENTS`, les types `AchievementFamily`, `AchievementMetric`, `AchievementDefinition`, et `ACHIEVEMENT_PAYOUT_TOTAL`.
2. Six familles : `SCRATCH`, `COLLECTION`, `TABLEAU`, `MARKET`, `SOCIAL`, `ATTENDANCE`, chacune avec son libellé français.
3. Trente-sept médailles reprenant exactement les montants du ROADMAP §2 (total 65 950).

### `2)` Agrégats

> Le regroupement par famille sert au serveur comme à l'écran.

1. Exporter `achievementsByFamily()` : six entrées, dans l'ordre des familles.

### `3)` Évaluation pure

> Aucune formule recopiée : le serveur et le front lisent les mêmes fonctions.

1. Exporter `achievementProgress(metrics)` et `newlyEarned(metrics, unlocked)`.
2. `friendsAccepted` et `profileComplete` acceptent `null` : la médaille sociale est alors verrouillée, jamais obtenue.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | `ACHIEVEMENTS.length === 37` et `ACHIEVEMENT_PAYOUT_TOTAL === 65950` |
| 1 | aucune clé dupliquée, aucun montant nul ou négatif, aucun seuil négatif |
| 1 | chaque palier du ROADMAP est retrouvé par sa clé et son montant exact |
| 2 | les six familles sont présentes et chacune porte au moins une médaille |
| 3 | `newlyEarned` ne rend jamais une médaille déjà débloquée ni une médaille sociale quand la métrique vaut `null` |
