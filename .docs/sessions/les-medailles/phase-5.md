---
status: done
---

# Instruction: Interface des médailles

## Architecture projection

```txt
apps/web/src/
  content/achievements.ts      ✅ libellés de salle (français)
  lib/achievements.ts          ✅ client TanStack Query (clé, fetch, options)
  routes/achievements.tsx      ✅ salle « Les Médailles »
  components/layout/nav-items.ts ✏️ entrée de rail et libellé de salon
```

## Test Scope

| Scenario     | Action                  | Observable outcome   | Actor                           |
| ------------ | ----------------------- | -------------------- | ------------------------------- |
| Setup        | session ouverte, aucune médaille | la salle affiche six familles et 37 médailles verrouillées | browser |
| Happy path   | une médaille obtenue | la carte de la médaille passe en « Obtenue » avec sa date et son montant | browser |
| Edge case    | interrupteur à `false` | un bandeau annonce que les primes sont suspendues, les médailles restent visibles | browser |
| Teardown     | navigation vers Le Relevé | aucune requête supplémentaire | browser |

## Tasks to do

### `1)` Client

> Une seule requête serveur, aucune formule recopiée.

1. `lib/achievements.ts` : clé `['achievements']`, `fetchAchievements`, `achievementsQueryOptions`, lecture d'erreur Eden identique à `lib/market.ts`.
2. `content/achievements.ts` : titre, sous-titres, états (`Obtenue`, `Verrouillée`, `À venir`), message d'interruption.

### `2)` Salle

1. Garde de session identique aux autres salles (`isPending`, puis `/login`).
2. Groupement par famille avec les libellés venant de `@hexamap/shared`, jamais recopiés.
3. Une carte par médaille : libellé, montant en écus, progression `n / seuil`, date d'obtention.
4. Bandeau si `payoutsEnabled === false` ; aucune mutation depuis cette salle.

### `3)` Navigation

1. Ajouter la salle à `nav-items.ts` (route, libellé, glyphe) et le nom de salon dans `salonForPath`.
2. Vérifier que la barre d'onglets mobile reste à cinq contrôles : la nouvelle salle passe par la feuille des salles secondaires.

## Test acceptance criteria

| Task | Acceptance criteria              |
| ---- | -------------------------------- |
| 1 | aucune erreur de type sur la réponse Eden, aucune URL absolue |
| 2 | texte français, aucun libellé de famille recopié depuis le serveur |
| 2 | 37 cartes rendues, groupées en six familles, aucun défilement horizontal à 390 px |
| 3 | la salle est atteinte depuis le rail et depuis la feuille mobile |
