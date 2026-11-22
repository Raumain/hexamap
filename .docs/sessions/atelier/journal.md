# Journal — Phase 41, L'Atelier

## Ce qui est livré

- `.docs/02-database.md` : `user_cards.source` à quatre valeurs (`TICKET`, `MARKET`, `REWARD`,
  `CRAFT`), phrase qui dit que `CRAFT` est écrit par la base via le service, jamais par le client,
  et `0018` passée au statut **Migrée**.
- Migration `0018_card_source` : `drop constraint if exists` puis `add constraint` à quatre
  valeurs, rejouable. `migrator.ts` (import + clé en fin de liste) et `schema.ts` (`CardSource`).
- `packages/shared/src/atelier.ts` : règle pure (`CRAFT_THRESHOLD = 3`, `CRAFT_TRANSITIONS`,
  `nextCraftRarity`, `craftedScore`, `isCraftableRarity`, `craftGroupKey`), exportée par le barrel.
- `apps/api/src/services/atelier.ts` : fusion sous une transaction, `SELECT … FOR UPDATE` ordonné
  par `id`, refus des cartes engagées, suppression des copies, insertion de la carte produite avec
  `source = 'CRAFT'` et le score du palier.
- `apps/api/src/routes/cards.ts` : `POST /cards/craft`, schémas TypeBox complets, et `CRAFT` ajouté
  aux deux unions `source`.
- Web : `apps/web/src/lib/atelier.ts`, `components/atelier/craft-panel.tsx` monté dans
  `routes/collection.tsx`, contenu `ATELIER` dans `content/collection.ts`, libellé `CRAFT` dans
  `content/card-detail.ts`.
- `packages/spec/src/atelier.spec.ts` : règle pure + API (seuil, rejeu, plafond, `MYTHIQUE`,
  groupe de six, groupe voisin, annonce, tableau, troc, propriété, non-authentifié).
- `packages/e2e/fixtures/atelier-fixture.ts` + `packages/e2e/tests/atelier.spec.ts`.

## Décisions tranchées

- **Aucun aléatoire, donc aucun angle « coffre à butin ».** La fusion n'ouvre rien : elle
  transforme trois exemplaires identiques en une carte du palier suivant. Aucun tirage, aucun RNG,
  aucun test statistique ; le §2.8 du GDD n'a rien à redire parce que rien n'est vendu ni tiré.
- **Seuil = 3, et tout le groupe est consommé.** Un groupe de six reste **une** fusion : six cartes
  consommées, une produite, jamais deux. Règle explicite et testée, pas un hasard du code.
- **Les cartes les plus jouées deviennent non fusibles, et c'est le prix assumé.** Engager une
  carte dans un tableau ou une annonce ouverte interdit sa fusion (`409 CARD_ENGAGED`). Les
  colonnes de `tableaux` sont en `on delete set null` : consommer une de ces cartes viderait un
  emplacement déjà soumis sans que le joueur l'ait demandé. Une offre de troc `PENDING` est
  refusée pour la même raison (cascade `on delete cascade`). Le refus est nommé, avec un message
  qui dit laquelle des trois situations bloque.
- **Site d'appel : la plus petite surface.** Une action `POST /api/v1/cards/craft` dans
  `routes/cards.ts` et un panneau « L'Atelier » dans `routes/collection.tsx`. Aucune salle neuve,
  aucune entrée de coquille, aucun nom à ajouter dans `DESIGN_SYSTEM.md`.
- **Score produit = `EDITION_SCORE` du palier visé** (200 à 2 000). C'est la seule lecture
  déterministe de « le score de son palier » ; les cartes consommées ne changent jamais de score.
  Conséquence assumée : une commune ÉPIQUE très peuplée peut valoir plus que la LÉGENDAIRE
  produite — la rareté monte, le score suit la table d'édition, pas la population d'origine.
- **Le troc ouvert est traité comme un engagement**, bien que le brief ne cite que l'annonce et le
  tableau : supprimer une carte en troc annulerait l'offre par cascade, la même destruction
  silencieuse que celle qu'on veut éviter.
- **Idempotence portée par l'état.** Aucune table de rejeu : après fusion, le groupe n'a plus trois
  copies, donc un rejeu répond `CRAFT_NOT_ENOUGH` et ne produit rien.

## Conséquences assumées (documentées, non corrigées)

- Une carte ayant participé à un troc terminé perd, à sa fusion, la ligne `trade_offers`
  correspondante par `on delete cascade`. `trade_offers` reste un registre opérationnel, pas un
  grand-livre immuable ; aucune table de journalisation n'est introduite.
- Une insertion de tableau concurrente à une fusion ne verrouille pas les cartes (pas de FK
  bloquante). La fenêtre est bornée au joueur lui-même et le refus `tableaux` couvre l'état
  stable ; le risque résiduel est celui de deux onglets du même compte au même instant.

## Vérification

```
docker compose --profile tools run --rm \
  -e TEST_DATABASE_URL='postgres://hexamap:hexamap@db:5432/hexamap_test_41' \
  dev bun run ci:check
  ✓ 1/4 Lint            321 fichiers
  ✓ 2/4 Typecheck       6 workspaces
  ✓ 3/4 Base de données
  ✓ 4/4 Spécifications  487 pass, 0 fail, 26 fichiers
```

Banc E2E (HTTPS, Caddy) :

```
docker compose -f docker-compose.e2e.yml up -d --build db api proxy
docker compose -f docker-compose.e2e.yml run --rm playwright npx --no-install playwright test
  102 passed
```

Le cas de la phase, joué seul : `tests/atelier.spec.ts --project=chromium` → **1 passed**.

La vérification visuelle est faite par l'E2E : le panneau est trouvé par son rôle de région, la
confirmation nomme le groupe, le message de succès et la table de collection sont assertés. Aucune
capture manuelle n'a été nécessaire.

## Portée

Aucun fichier de `.docs/03-active-task.md`, `ROADMAP.md`, `.docs/01-architecture.md`,
`apps/web/src/routeTree.gen.ts` ni `packages/db/src/types.generated.ts` n'a été touché. Une seule
migration : `0018_card_source`. Aucune dépendance ajoutée.
