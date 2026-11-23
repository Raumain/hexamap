/**
 * Cartes dédiées aux exemplaires multiples (Cadastre, Cartel, La Planche).
 *
 * Deux formes sont éprouvées ici, et elles ne doivent pas se confondre :
 *
 * - `E2E-C-LEGENDAIRE-0` porte **trois exemplaires strictement identiques**
 *   (même catégorie, même référence, même rareté, même score). Le Cadastre les
 *   agrège en **une** ligne marquée `×3`, le Cartel annonce trois exemplaires et
 *   le tiroir de La Planche porte la marque sur chaque bouton.
 * - `E2E-C-MYTHIQUE-0` porte **deux exemplaires du même `ref_code` mais de
 *   raretés différentes** (`RARE` et `EPIQUE`) : ce ne sont pas des doublons,
 *   donc ils restent **deux** lignes distinctes.
 *
 * Les deux références sont propres à la fixture : personne d'autre dans le banc
 * ne les utilise, et la suppression ciblée du joueur rend le semis idempotent.
 * Le module tourne dans le conteneur Playwright (Node), qui résout `packages/db`
 * par chemin relatif — `packages/e2e` ne déclare aucune dépendance vers la base.
 */

import { createDb } from '../../db/src/index';

const CATEGORY = 'COMMUNE' as const;

/** Trois doublons identiques : le groupe agrégé. */
const REF_GROUP = 'E2E-C-LEGENDAIRE-0';
const GROUP_RARITY = 'INHABITUELLE' as const;
const GROUP_SCORE = 400;
const GROUP_COUNT = 3;

/** Deux éditions du même lieu : deux lignes, jamais un groupe. */
const REF_EDITIONS = 'E2E-C-MYTHIQUE-0';

function databaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      '[e2e] DATABASE_URL est absente : la fixture des exemplaires ne peut pas semer.',
    );
  }
  return url;
}

/**
 * Sème les cinq cartes du joueur, de façon **idempotente** : les deux
 * références sont propres à la fixture, donc toute carte que ce joueur porte
 * sur l'une d'elles est supprimée avant l'insertion.
 */
export async function ensureExemplairesCards(userId: string): Promise<void> {
  const db = createDb(databaseUrl());

  try {
    await db
      .deleteFrom('user_cards')
      .where('user_id', '=', userId)
      .where('ref_code', 'in', [REF_GROUP, REF_EDITIONS])
      .execute();

    // Les trois identiques : des `acquired_at` distincts, le plus récent d'abord.
    const now = Date.now();
    for (let index = 0; index < GROUP_COUNT; index += 1) {
      await db
        .insertInto('user_cards')
        .values({
          user_id: userId,
          category: CATEGORY,
          ref_code: REF_GROUP,
          rarity: GROUP_RARITY,
          score: GROUP_SCORE,
          acquired_at: new Date(now - index * 1_000),
        })
        .execute();
    }

    // Les deux éditions : même lieu, raretés et scores différents.
    await db
      .insertInto('user_cards')
      .values({
        user_id: userId,
        category: CATEGORY,
        ref_code: REF_EDITIONS,
        rarity: 'RARE',
        score: 750,
        acquired_at: new Date(now - 10_000),
      })
      .execute();

    await db
      .insertInto('user_cards')
      .values({
        user_id: userId,
        category: CATEGORY,
        ref_code: REF_EDITIONS,
        rarity: 'EPIQUE',
        score: 1250,
        acquired_at: new Date(now - 20_000),
      })
      .execute();
  } finally {
    await db.destroy();
  }
}

export default { ensureExemplairesCards, clearExemplairesCards };

/** Nettoie les deux références du joueur, quel que soit le sort du test. */
export async function clearExemplairesCards(userId: string): Promise<void> {
  const db = createDb(databaseUrl());

  try {
    await db
      .deleteFrom('user_cards')
      .where('user_id', '=', userId)
      .where('ref_code', 'in', [REF_GROUP, REF_EDITIONS])
      .execute();
  } finally {
    await db.destroy();
  }
}
