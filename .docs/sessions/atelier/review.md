# Review: Phase 41 — L'Atelier

- Rounds: 1
- Started: 2026-11-22

## Round 1 · r-41a7

- Date: 2026-11-22
- By: Raumain
- Diff: `6c49aae...working tree` (base `feat/v2-wave-5`, head = arbre de travail avant commit)
- Axes: code, functional, relevancy
- Verdict: prêt à livrer
- Score: 8/8 met, 0 unmet, 0 unverified at runtime, 0 out of the diff

### Criteria

- [x] Une fusion rejouée ne produit pas de seconde carte — `packages/spec/src/atelier.spec.ts` « une fusion rejouée… » (rejeu → `409 CRAFT_NOT_ENOUGH`, 0 RARE / 1 ÉPIQUE)
- [x] Aucune carte détruite par erreur, trois consommées pour une produite — spec « trois doublons… » (`consumed = 3`, groupe vidé) et E2E « trois doublons fondent… » (`after.length === totalBefore - 2`)
- [x] Une carte engagée est refusée explicitement — spec « en vente ouverte », « d’un tableau », « dans un troc ouvert » → `409 CARD_ENGAGED`, cartes intactes
- [x] Aucun `MYTHIQUE` produit, `LEGENDAIRE` → `409 CRAFT_CEILING` — spec « LEGENDAIRE est le plafond » et « groupe MYTHIQUE refusé »
- [x] Cas E2E : trois doublons → une carte — `packages/e2e/tests/atelier.spec.ts` exécuté seul (1 passed) puis dans le banc complet (102 passed)
- [x] Règle de fusion dans `packages/shared`, verrouillée par la spec — `packages/shared/src/atelier.ts` + spec pure (transitions, seuil, score, clé)
- [x] Site d’appel tranché et journalisé — `POST /api/v1/cards/craft` + panneau monté dans `routes/collection.tsx` (journal)
- [x] `ci:check` vert — 487 spécifications, 26 fichiers, 0 échec

### Findings

- `apps/api/src/services/atelier.ts:52` : `CraftedCardView.source` est typé `string` alors que le domaine expose `CardSource` → typer `source: CardSource` pour que le compilateur garde la liste fermée — 🟢 minor, code-health
- `apps/api/src/services/atelier.ts:141` : la fusion verrouille et vérifie `market_listings`/`tableaux`, mais une insertion concurrente de tableau ne verrouille pas les cartes ; `tableaux` étant en `on delete set null`, une course théorique pourrait vider une colonne → déjà couverte par le refus `tableaux` au moment du verrou ; risque résiduel documenté au journal — 🟢 minor, backend
- `apps/web/src/content/collection.ts:64` : `atelierResultLabel` construit un `Intl.NumberFormat` par ligne → hoister le formateur si la liste grandit — 🟢 minor, performance
- `packages/db/migrations/0018_card_source.ts:34` : `down` réinstalle l’ancien `CHECK` et échouerait si des lignes `CRAFT` existent → acceptable, ce projet ne joue jamais `down` (Kysely ne migre que vers l’avant) — 🟢 minor, code-health
- `apps/api/src/services/atelier.ts:110` : consommer une carte ayant participé à un troc `ACCEPTED` supprime la ligne `trade_offers` par cascade → conséquence du schéma (`on delete cascade`), assumée et écrite au journal ; aucune table nouvelle n’est introduite — 🟢 minor, backend
