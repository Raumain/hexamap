import type { CardCategory, CardSource, Database, Rarity } from '@hexamap/db';
import { CRAFT_THRESHOLD, craftedScore, nextCraftRarity } from '@hexamap/shared';
import type { Transaction } from 'kysely';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import { cardNomKey, resolveCardAssets, resolveCardNoms } from './draw';

/** Groupe visé : même catégorie, même référence, même rareté. */
export interface CraftInput {
  category: CardCategory;
  refCode: string;
  rarity: Rarity;
}

export interface CraftedCardView {
  id: string;
  category: CardCategory;
  refCode: string;
  nom: string;
  blasonUrl: string | null;
  blasonCredit: string | null;
  rarity: Rarity;
  score: number;
  acquiredAt: string;
  source: CardSource;
  locked: boolean;
}

export interface CraftResult {
  craftedCard: CraftedCardView;
  consumed: number;
}

type Exec = Transaction<Database>;

/**
 * Refuse de consommer une carte engagée. Le refus est explicite et nomme la
 * raison : supprimer une carte d'un tableau laisserait `on delete set null`
 * vider un emplacement déjà soumis, et supprimer une carte en troc annulerait
 * l'offre par cascade — deux destructions que le joueur n'a pas demandées.
 */
async function assertNotEngaged(trx: Exec, ids: string[], locked: boolean): Promise<void> {
  if (locked) {
    throw new HttpError(
      409,
      'CARD_ENGAGED',
      'Une carte de ce groupe est verrouillée par une vente en cours.',
    );
  }

  const listing = await trx
    .selectFrom('market_listings')
    .select('id')
    .where('user_card_id', 'in', ids)
    .where('status', '=', 'OPEN')
    .executeTakeFirst();
  if (listing) {
    throw new HttpError(409, 'CARD_ENGAGED', 'Une carte de ce groupe est en vente.');
  }

  const inTableau = await trx
    .selectFrom('tableaux')
    .select('id')
    .where((eb) =>
      eb.or([
        eb('region_card_id', 'in', ids),
        eb('departement_card_id', 'in', ids),
        eb('commune_card_id', 'in', ids),
        eb('rue_card_id', 'in', ids),
      ]),
    )
    .executeTakeFirst();
  if (inTableau) {
    throw new HttpError(409, 'CARD_ENGAGED', 'Une carte de ce groupe compose un tableau.');
  }

  const inTrade = await trx
    .selectFrom('trade_offers')
    .select('id')
    .where('status', '=', 'PENDING')
    .where((eb) => eb.or([eb('offered_card_id', 'in', ids), eb('requested_card_id', 'in', ids)]))
    .executeTakeFirst();
  if (inTrade) {
    throw new HttpError(409, 'CARD_ENGAGED', 'Une carte de ce groupe est engagée dans un troc.');
  }
}

/**
 * Fond **tout** le groupe `(catégorie, ref_code, rareté)` en une carte du palier
 * suivant. Déterministe : aucune entrée aléatoire, aucun RNG.
 *
 * L'idempotence est portée par l'état : après une fusion, le groupe n'a plus le
 * seuil de copies, donc un rejeu répond `CRAFT_NOT_ENOUGH` sans rien produire.
 */
export async function craftCards(userId: string, input: CraftInput): Promise<CraftResult> {
  const target = nextCraftRarity(input.rarity);
  if (target === null) {
    throw new HttpError(
      409,
      'CRAFT_CEILING',
      'Ce palier est le plus haut : il n’existe pas de rareté supérieure à produire.',
    );
  }

  const inserted = await db.transaction().execute(async (trx) => {
    // Un seul verrou, sur le groupe : la mise en vente verrouille elle aussi la
    // carte, donc les deux chemins se sérialisent sur la même ligne.
    const copies = await trx
      .selectFrom('user_cards')
      .select(['id', 'locked'])
      .where('user_id', '=', userId)
      .where('category', '=', input.category)
      .where('ref_code', '=', input.refCode)
      .where('rarity', '=', input.rarity)
      .orderBy('id')
      .forUpdate()
      .execute();

    if (copies.length < CRAFT_THRESHOLD) {
      throw new HttpError(
        409,
        'CRAFT_NOT_ENOUGH',
        `Il faut ${CRAFT_THRESHOLD} exemplaires identiques pour fondre une carte.`,
      );
    }

    const ids = copies.map((copy) => copy.id);
    await assertNotEngaged(
      trx,
      ids,
      copies.some((copy) => copy.locked),
    );

    await trx.deleteFrom('user_cards').where('id', 'in', ids).execute();

    const created = await trx
      .insertInto('user_cards')
      .values({
        user_id: userId,
        category: input.category,
        ref_code: input.refCode,
        rarity: target,
        score: craftedScore(target),
        source: 'CRAFT',
      })
      .returning([
        'id',
        'category',
        'ref_code',
        'rarity',
        'score',
        'acquired_at',
        'source',
        'locked',
      ])
      .executeTakeFirstOrThrow();

    return { created, consumed: copies.length };
  });

  const row = inserted.created;
  const key = cardNomKey(row.category, row.ref_code);
  const [noms, assets] = await Promise.all([
    resolveCardNoms(db, [row]),
    resolveCardAssets(db, [row]),
  ]);
  const asset = assets.get(key);

  return {
    craftedCard: {
      id: row.id,
      category: row.category,
      refCode: row.ref_code,
      nom: noms.get(key) ?? '',
      blasonUrl: asset?.blasonUrl ?? null,
      blasonCredit: asset?.blasonCredit ?? null,
      rarity: row.rarity,
      score: row.score,
      acquiredAt: row.acquired_at.toISOString(),
      source: row.source,
      locked: row.locked,
    },
    consumed: inserted.consumed,
  };
}
