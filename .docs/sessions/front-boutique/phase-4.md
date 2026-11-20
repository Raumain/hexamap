---
status: pending
---

# Instruction: La preuve

## Architecture projection

```txt
packages/e2e/tests/
  mobile.spec.ts             ✏️ modify (un cas ajouté, aucun cas existant retouché)
.docs/sessions/front-boutique/
  journal.md                 ✅ create
```

## Test Scope

| Scenario | Action | Observable outcome | Actor |
| --- | --- | --- | --- |
| Setup | `docker-compose.e2e.yml` reconstruit (`db api proxy`) — l'image sert `apps/web/dist` figé | Le banc sert le bundle de la phase | cli |
| Happy path | Depuis `/`, feuille `Plus`, appui sur `La Boutique` | `/boutique`, quatre packs et leurs prix visibles, aucun débordement à 390 px | browser |
| Edge case | Appui sur `Acheter` sans clé Stripe | « La boutique n'est pas encore ouverte. », bouton réarmé | browser |
| Teardown | none | Aucune écriture : le checkout répond 503 avant tout ordre | — |

## Tasks to do

### `1)` Le cas mobile

> Un seul cas neuf, joué sur les deux projets tactiles.

1. `test.describe` avec `test.use({ viewport: { width: 390, height: 844 } })`.
2. Cas : `page.goto('/')`, `openMoreSheet(page)`, clic sur le lien `La Boutique`, attente de
   `toHaveURL(/\/boutique$/)` et du `h1`.
3. Quatre planches : `getByRole('article')` ou le conteneur de grille — quatre prix distincts
   (`/4,99\s?€/`, `/9,99\s?€/`, `/19,99\s?€/`, `/44,99\s?€/`) et quatre boutons `Acheter`.
4. Appui sur le premier `Acheter` : `getByText('La boutique n’est pas encore ouverte.')` visible
   (attention à l'apostrophe typographique : la constante de `content/boutique.ts` fait foi).
5. `assertNoHorizontalOverflow(page, '/boutique')` et capture `test.info().attach('boutique-390.png', …)`
   pleine page, comme les cas voisins de la phase 22.
6. Ne pas retoucher les cas existants de `mobile.spec.ts` : le nouveau cas porte ses assertions.

### `2)` La vérification

> La seule preuve acceptée.

1. `docker compose --profile tools run --rm -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_304' dev bun run ci:check`
   — quatre étapes, noter le nombre de spécifications et de fichiers.
2. `docker compose -f docker-compose.e2e.yml up -d --build db api proxy` **après** tout changement
   dans `apps/web` (l'image sert `dist` figé).
3. `docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test tests/mobile.spec.ts`
   puis le banc complet, pour vérifier qu'aucune salle secondaire n'a régressé.
4. Récupérer la capture 390 px de `/boutique` pour le corps de la PR.

## Test acceptance criteria

| Task | Acceptance criteria |
| ---- | ------------------- |
| 1 | Le cas est rouge avant l'implémentation (`/boutique` absent du routeur) et vert après, sur `Pixel 7` et `iPhone 13`. |
| 2 | `ci:check` vert (lint, typecheck, ping, spécifications) ; `mobile.spec.ts` vert ; aucune régression sur les autres projets. |
