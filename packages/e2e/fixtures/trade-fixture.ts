/**
 * Cartes dédiées au troc E2E.
 *
 * Le banc partage ses comptes : le premier joueur porte le combo de La Planche
 * et le meilleur tableau de la Vitrine, le second compte du banc porte la commune
 * que la Vitrine exige. Un troc consomme une carte, donc il ne peut pas toucher
 * ces fixtures : chaque test reçoit ici ses deux cartes, sur des références que
 * personne d'autre n'utilise.
 *
 * Le module tourne dans le conteneur Playwright (Node), qui résout `packages/db`
 * par chemin relatif — `packages/e2e` ne déclare aucune dépendance vers la base.
 */

import { type CardCategory, createDb, type Rarity } from '../../db/src/index';

interface FixtureCard {
  category: CardCategory;
  refCode: string;
  rarity: Rarity;
  score: number;
}

/** Deux communes que ni le combo, ni la Vitrine, ni le marché du banc n'emploient. */
const PROPOSER_CARD: FixtureCard = {
  category: 'COMMUNE',
  refCode: 'E2E-C-LEGENDAIRE-1',
  rarity: 'LEGENDAIRE',
  score: 2000,
};

const RECEIVER_CARD: FixtureCard = {
  category: 'COMMUNE',
  refCode: 'E2E-C-MYTHIQUE-1',
  rarity: 'MYTHIQUE',
  score: 3500,
};

export interface TradeCards {
  proposerCardId: string;
  receiverCardId: string;
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('[e2e] DATABASE_URL est absente : la fixture du troc ne peut pas semer.');
  }
  return url;
}

/**
 * Sème une carte pour chaque camp, de façon **idempotente** : la référence est
 * propre à la fixture, donc toute carte qui la porte est supprimée avant
 * l'insertion, quel que soit son propriétaire — un troc précédent a pu la
 * déplacer. `trade_offers` tombe par cascade avec la carte.
 */
export async function ensureTradeCards(
  proposerId: string,
  receiverId: string,
): Promise<TradeCards> {
  const db = createDb(databaseUrl());

  try {
    const ids: string[] = [];

    for (const [userId, card] of [
      [proposerId, PROPOSER_CARD],
      [receiverId, RECEIVER_CARD],
    ] as const) {
      await db
        .deleteFrom('user_cards')
        .where('category', '=', card.category)
        .where('ref_code', '=', card.refCode)
        .execute();

      const inserted = await db
        .insertInto('user_cards')
        .values({
          user_id: userId,
          category: card.category,
          ref_code: card.refCode,
          rarity: card.rarity,
          score: card.score,
        })
        .returning('id')
        .executeTakeFirstOrThrow();

      ids.push(inserted.id);
    }

    const [proposerCardId, receiverCardId] = ids;
    if (!proposerCardId || !receiverCardId) {
      throw new Error('[e2e] la fixture du troc n’a pas rendu ses deux cartes.');
    }
    return { proposerCardId, receiverCardId };
  } finally {
    await db.destroy();
  }
}
