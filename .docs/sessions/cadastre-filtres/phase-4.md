---
status: pending
---

# Instruction: Banc E2E du Cadastre

Les critères d'acceptation sont prouvés dans un navigateur réel, et les deux cas d'Atlas que la
normalisation déplace sont réalignés — jamais supprimés, jamais affaiblis sans preuve.

## Architecture projection

> Tree of the final files. ✅ create · ✏️ modify · ❌ delete

```txt
packages/e2e/tests/
  cadastre.spec.ts                 ✅
  atlas.spec.ts                    ✏️  deux assertions d'URL
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | `goto('/collection?rarete=RARE,EPIQUE&categorie=COMMUNE,RUE')` | URL réécrite triée, contrôles dans l'état attendu | browser |
| Happy path | `reload()` | même URL, même nombre de lignes | browser |
| Edge case | `goBack()` après deux filtres | un seul filtre défait, toujours sur `/collection` | browser |
| Edge case | `goto('/collection?rarete=ANANAS&categorie=COMMUNE')` | URL réécrite en `?categorie=COMMUNE`, aucune erreur | browser |
| Edge case | `goto('/collection?departement=29')` | `select` porte `29` (valeur injectée : le résumé d'Atlas ne connaît que les codes `E2E-*`, la valeur courante est donc ajoutée comme option), `aria-live` à zéro, état vide filtré visible | browser |
| Edge case | `goto('/collection?commune=E2E-C-RARE-0')` | URL devient `?q=E2E-C-RARE-0`, ligne de la commune visible | browser |
| Edge case | hauteur de la ligne `E2E-D1` sous `?rarete=RARE` puis `?categorie=DEPARTEMENT&rarete=RARE` | hauteurs égales et > 0 (les deux jeux contiennent la ligne : elle est un département Rare) | browser |
| Teardown | aucun | aucune donnée de jeu écrite par la spec | api |

## Tasks to do

### `1)` Créer `packages/e2e/tests/cadastre.spec.ts`

> Huit cas, sélecteurs par rôle et libellé français.

1. Lien profond restauré à l'identique, puis `reload()`.
2. Le retour défait le dernier filtre et ne quitte pas la salle.
3. Une frappe ne crée pas d'entrée d'historique (cas posé depuis une autre salle).
4. `?departement=29` : département sélectionné, zéro carte, état vide filtré.
5. `?commune=E2E-C-RARE-0` : devient `q`, la ligne est visible.
6. Valeur inconnue écartée et URL réécrite normalisée.
7. Mesure de ligne identique sous deux jeux de filtres.
8. Lien depuis L'Atlas vers le Cadastre, retour, puis `reload()`.

### `2)` Réaligner `packages/e2e/tests/atlas.spec.ts`

> Deux cas assertaient la forme exacte de l'URL d'arrivée.

1. `atlas — la commune mène au Cadastre` : assertion `/\/collection\?q=E2E-C-[^&]+$/`, plus vérification que la recherche porte le code.
2. `atlas — le département mène au Cadastre` : assertion `/\/collection$/` et présence du Cadastre **nu** (aucun filtre actif), avec un commentaire disant pourquoi (`E2E-D1` n'est pas un code français, le validateur du contrat l'écarte, donc aucun filtre ne s'applique à l'arrivée).
3. Aucun cas supprimé, aucun `skip`, aucun `fixme`, aucun délai relâché.

### `3)` Jouer le banc

> Deux projets au moins : `chromium` porte les deux fichiers.

1. `docker compose -f docker-compose.e2e.yml up -d --build db api proxy`
2. `docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test`
3. Relever le total exécuté, les échecs et les ignorés, et les reporter tels quels.

## Test acceptance criteria

| Task | Acceptance criteria |
| --- | --- |
| 1 | `cadastre.spec.ts` s'exécute dans le projet `chromium`, huit cas, zéro échec, zéro ignoré. |
| 2 | `atlas.spec.ts` reste vert. Le cas commune prouve le transport du code INSEE jusqu'à `q`. Le cas département prouve que le clic atteint le Cadastre et que celui-ci écarte un code non conforme (`E2E-D1`) : URL nue, donc Cadastre nu — aucun filtre ne s'applique. Il ne prétend **pas** prouver le transport du code, qui a été écarté par le validateur. |
| 3 | Le banc complet rend zéro échec et zéro ignoré. `cadastre.spec.ts` ne tourne que dans le projet `chromium` (seul projet sans `testMatch` restreint), donc le total exécuté augmente **de huit**, ni plus ni moins. |
