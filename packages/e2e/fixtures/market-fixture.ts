/**
 * Fixture de jeu du banc E2E : une annonce ouverte appartenant à un **second
 * compte**.
 *
 * `global-setup.ts` n'inscrit qu'un joueur, donc Le Comptoir n'exposait aucune
 * annonce étrangère et le cas « un double-appui n'achète qu'une fois » ne
 * pouvait pas s'exécuter. Le vendeur est créé ici, en SQL, après le seed du
 * référentiel et avant le démarrage de Playwright (service `seed` de
 * `docker-compose.e2e.yml`).
 *
 * Le fichier vit hors de `scripts/import` : la règle locale de ce dossier
 * interdit d'y écrire des données de jeu. Il est exécuté par Bun (image `dev`),
 * qui résout `@hexamap/db` par chemin relatif — `packages/e2e` ne déclare pas de
 * dépendance vers le paquet de base.
 */

import { createDb } from '../../db/src/index';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[e2e] DATABASE_URL manquant pour la fixture du marché');
  process.exit(1);
}

/** Identifiant stable : la suppression en cascade remet le banc dans son état. */
const SELLER_ID = 'e2e-seller';
const SELLER_EMAIL = 'vendeur-e2e@hexamap.test';
const SELLER_PSEUDO = 'e2e-vendeur';

/** Commune du référentiel E2E (`scripts/import/src/e2e-seed.ts`). */
const CARD_REF = 'E2E-C-EPIQUE-0';

const db = createDb(databaseUrl);

try {
  // Idempotent : `market_listings` et `user_cards` disparaissent en cascade
  // avec le vendeur, donc un rejeu ne laisse jamais deux annonces orphelines.
  await db.deleteFrom('user').where('id', '=', SELLER_ID).execute();

  const now = new Date();

  await db
    .insertInto('user')
    .values({
      id: SELLER_ID,
      name: 'Vendeur E2E',
      email: SELLER_EMAIL,
      emailVerified: true,
      pseudo: SELLER_PSEUDO,
      createdAt: now,
      updatedAt: now,
    })
    .execute();

  const card = await db
    .insertInto('user_cards')
    .values({
      user_id: SELLER_ID,
      category: 'COMMUNE',
      ref_code: CARD_REF,
      rarity: 'EPIQUE',
      score: 1250,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await db
    .insertInto('market_listings')
    .values({
      seller_id: SELLER_ID,
      user_card_id: card.id,
      price: 10,
    })
    .execute();

  console.log(`[e2e] Annonce du marché prête : ${SELLER_PSEUDO} vend ${CARD_REF} pour 10 écus.`);
} finally {
  await db.destroy();
}
