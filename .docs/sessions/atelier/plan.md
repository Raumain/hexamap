---
objective: "L'Atelier est livré : `user_cards.source` accepte `CRAFT`, la fusion de trois doublons donne une carte au palier + 1, refuse `MYTHIQUE` (`409 CRAFT_CEILING`) et les cartes engagées (`409 CARD_ENGAGED`), avec specs et E2E vertes et `ci:check` vert."
status: done
---

# Plan — Phase 41, L'Atelier

Source : brief de session « Phase 41 — L'Atelier », `.docs/07-roadmap-v2.md` §4,
`.docs/02-database.md` §4.2/§4.4/§4.5/§4.6, `.docs/01-architecture.md` §2.2/§2.5/§2.8.

## Décisions d'implémentation (tranchées ici, citées dans le journal)

| Sujet | Décision | Raison |
| :--- | :--- | :--- |
| Seuil | `CRAFT_THRESHOLD = 3` | Trois doublons donnent une carte ; en dessous `409 CRAFT_NOT_ENOUGH`. C'est le seuil que l'E2E décrit. |
| Consommation | **Toutes** les copies du groupe `(catégorie, ref_code, rareté)` | Un groupe de six reste une seule fusion : il consomme six cartes et rend une carte, jamais deux. Règle explicite, testée. |
| Palier | Déterministe, `+1`, cinq transitions `COMMUNE→INHABITUELLE→RARE→EPIQUE→LEGENDAIRE` | Aucun RNG, aucun test statistique. `LEGENDAIRE` et `MYTHIQUE` n'ont pas de successeur → `409 CRAFT_CEILING`. |
| Score produit | `EDITION_SCORE[palier cible]` (200/400/750/1250/2000) | « le score de son palier » ; cohérent avec le score d'édition Région/Département, déterminisme total. Les cartes consommées ne bougent pas. |
| Carte engagée | `locked`, annonce `OPEN`, `tableaux` (4 colonnes) ou offre `PENDING` → `409 CARD_ENGAGED` | Refuser plutôt que trouer un tableau (`on delete set null`) ou annuler un troc par cascade. Nommé et expliqué dans le journal. |
| Site d'appel | `POST /api/v1/cards/craft` + panneau « L'Atelier » monté dans `collection.tsx` | Plus petite surface. Aucune salle neuve, aucune entrée de coquille, aucun nom dans `DESIGN_SYSTEM.md`. |
| Idempotence | Portée par l'état : après fusion, le groupe n'a plus assez de copies → `CRAFT_NOT_ENOUGH` | Aucune table de rejeu, aucune clé d'idempotence supplémentaire. La spec le prouve. |
| Migration | `0018_card_source` : `drop constraint if exists` puis `add constraint` à quatre valeurs | `0003` est immuable ; le `CHECK` est anonyme, donc auto-nommé `user_cards_source_check`. Rejouable. |

## Phases

| # | Phase | Fichiers | Depends on |
| --- | --- | --- | --- |
| 1 | Contrat de données | `.docs/02-database.md` (§4.2 + §6 `CardSource`) | none |
| 2 | Règle pure partagée | `packages/shared/src/atelier.ts`, `packages/shared/src/index.ts` | 1 |
| 3 | Spécifications rouges | `packages/spec/src/atelier.spec.ts` | 2 |
| 4 | Migration + schéma | `packages/db/migrations/0018_card_source.ts`, `packages/db/src/migrator.ts`, `packages/db/src/schema.ts` | 3 |
| 5 | Service de fusion | `apps/api/src/services/atelier.ts` | 4 |
| 6 | Route | `apps/api/src/routes/cards.ts` (route + deux unions `source`) | 5 |
| 7 | Client web | `apps/web/src/lib/atelier.ts`, `apps/web/src/content/collection.ts` | 6 |
| 8 | Interface | `apps/web/src/components/atelier/craft-panel.tsx`, `apps/web/src/routes/collection.tsx` | 7 |
| 9 | E2E | `packages/e2e/fixtures/atelier-fixture.ts`, `packages/e2e/tests/atelier.spec.ts` | 6 |
| 10 | Statut Migrée | `.docs/02-database.md` §2 | 4 |
| 11 | Preuves | `ci:check` + banc E2E | toutes |

## Contrat de données (recopié dans `.docs/02-database.md` §4.2)

```sql
-- 0018_card_source
alter table user_cards drop constraint if exists user_cards_source_check;
alter table user_cards add constraint user_cards_source_check
  check (source in ('TICKET', 'MARKET', 'REWARD', 'CRAFT'));
```

`CRAFT` n'est écrit que par la fusion serveur (`services/atelier.ts`), jamais par le client :
le corps de la route ne porte ni `source`, ni `score`, ni `id`.

## Surface HTTP (dans le groupe protégé `/api/v1`, montée par `routes/cards.ts`)

| Route | Corps | Réponses |
| :--- | :--- | :--- |
| `POST /cards/craft` | `{ category, refCode, rarity }` | `201 { craftedCard, consumed }`, `401`, `409 CRAFT_NOT_ENOUGH` / `CRAFT_CEILING` / `CARD_ENGAGED` |

## Règle pure (`packages/shared/src/atelier.ts`)

- `CRAFT_THRESHOLD = 3`
- `CRAFT_TRANSITIONS: Record<Rarity, Rarity \| null>` — cinq successeurs, `LEGENDAIRE` et
  `MYTHIQUE` à `null`.
- `nextCraftRarity(rarity): Rarity | null`
- `craftedScore(rarity): number` — `EDITION_SCORE` du palier.
- `isCraftableRarity(rarity): boolean`

## Vérification

```sh
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_41' \
  dev bun run ci:check
```

Puis :

```sh
docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
```

Mapping critère → preuve :

| Critère | Preuve |
| :--- | :--- |
| Fusion rejouée sans seconde carte | spec `atelier.spec.ts` : rejeu → `409`, compte inchangé |
| Aucune destruction | spec : 3 avant, 1 après, groupe vidé ; E2E : 3 → 1 |
| Carte engagée refusée | spec : annonce `OPEN`, tableau et troc → `409 CARD_ENGAGED` |
| Aucun `MYTHIQUE` | spec : cinq transitions + `LEGENDAIRE`/`MYTHIQUE` → `409 CRAFT_CEILING` |
| E2E | `packages/e2e/tests/atelier.spec.ts` |
| Règle dans `shared` | spec importe `@hexamap/shared`, route ne recalcule rien |
| Site d'appel tranché | ce plan + journal |
| `ci:check` vert | sortie de la commande ci-dessus |
