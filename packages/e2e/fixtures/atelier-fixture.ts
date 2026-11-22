/**
 * Cartes dédiées à L'Atelier E2E.
 *
 * Le banc partage ses comptes : le premier joueur porte le combo de La Planche,
 * le meilleur tableau de la Vitrine, et les cartes du marché et du troc. Une
 * fusion **consomme** des cartes, donc elle ne peut pas toucher ces fixtures :
 * le test reçoit ici son propre groupe de trois doublons, sur une référence que
 * personne d'autre n'utilise (`E2E-C-RARE-1`, distincte de `E2E-C-RARE-0`).
 *
 * Le module tourne dans le conteneur Playwright (Node), qui résout `packages/db`
 * par chemin relatif — `packages/e2e` ne déclare aucune dépendance vers la base.
 */

import { createDb } from '../../db/src/index';

const CATEGORY = 'COMMUNE' as const;
const REF_CODE = 'E2E-C-RARE-1';
const RARITY = 'RARE' as const;
const SCORE = 750;
const COUNT = 3;

export interface AtelierCards {
  refCode: string;
  ids: string[];
}

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('[e2e] DATABASE_URL est absente : la fixture de L’Atelier ne peut pas semer.');
  }
  return url;
}

/**
 * Sème trois doublons identiques pour le joueur, de façon **idempotente** : la
 * référence est propre à la fixture, donc toute carte qui la porte est supprimée
 * avant l'insertion — y compris une carte `CRAFT` laissée par un run précédent.
 */
export async function ensureAtelierCards(userId: string): Promise<AtelierCards> {
  const db = createDb(databaseUrl());

  try {
    await db
      .deleteFrom('user_cards')
      .where('category', '=', CATEGORY)
      .where('ref_code', '=', REF_CODE)
      .execute();

    const ids: string[] = [];
    for (let index = 0; index < COUNT; index += 1) {
      const inserted = await db
        .insertInto('user_cards')
        .values({
          user_id: userId,
          category: CATEGORY,
          ref_code: REF_CODE,
          rarity: RARITY,
          score: SCORE,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      ids.push(inserted.id);
    }

    return { refCode: REF_CODE, ids };
  } finally {
    await db.destroy();
  }
}
