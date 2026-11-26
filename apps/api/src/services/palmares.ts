import type { CardCategory, Rarity } from '@hexamap/db';
import {
  type IsoWeek,
  isoWeekLabel,
  isoWeekOf,
  isoWeekRange,
  TABLEAU_SLOTS,
  type TableauSlot,
} from '@hexamap/shared';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import { cardNomKey, resolveCardAssets, resolveCardNoms } from './draw';

export interface PalmaresCard {
  cardId: string;
  category: CardCategory;
  refCode: string;
  nom: string;
  rarity: Rarity;
  score: number;
  blasonUrl: string | null;
  blasonCredit: string | null;
}

export interface PalmaresEntry {
  rank: number;
  tableauId: string;
  name: string;
  score: number;
  createdAt: string;
  yours: boolean;
  player: { id: string; pseudo: string; profilePublic: boolean };
  cards: PalmaresCard[];
}

export interface Palmares {
  week: string;
  weekStart: string;
  weekEnd: string;
  current: boolean;
  total: number;
  items: PalmaresEntry[];
}

type SlotColumn = 'region_card_id' | 'departement_card_id' | 'commune_card_id' | 'rue_card_id';

interface PalmaresRow {
  id: string;
  name: string;
  score: number;
  created_at: Date;
  user_id: string;
  region_card_id: string | null;
  departement_card_id: string | null;
  commune_card_id: string | null;
  rue_card_id: string | null;
  pseudo: string | null;
  user_name: string;
  profile_public: boolean | null;
}

const SLOT_COLUMNS: Record<TableauSlot, SlotColumn> = {
  REGION: 'region_card_id',
  DEPARTEMENT: 'departement_card_id',
  COMMUNE: 'commune_card_id',
  RUE: 'rue_card_id',
};

function cardIdOfSlot(row: PalmaresRow, slot: TableauSlot): string | null {
  return row[SLOT_COLUMNS[slot]];
}

/**
 * Le classement d'une semaine ISO. **La seule implémentation du rang** : le score
 * est lu tel qu'il a été figé à la soumission, jamais recalculé, et le départage
 * (score desc, `created_at` asc, `id` asc) est un unique `ORDER BY` serveur.
 *
 * L'horloge est résolue **une seule fois** : sans cela, une requête à cheval sur
 * le passage dimanche → lundi pouvait annoncer la semaine 47 avec `current: false`.
 *
 * `player.profilePublic` vient de `user_profiles` ; la ligne est créée
 * paresseusement et `profile_public` vaut `true` par défaut, donc une ligne
 * absente rend `true` (`.docs/02-database.md` §4.9). Une vitrine privée répond
 * 404 (`.docs/01-architecture.md` §2.9) : la salle ne doit pas offrir un lien mort.
 */
export async function loadPalmares(
  isoWeek: IsoWeek | null,
  limit: number,
  viewerId: string,
  now?: Date,
): Promise<Palmares> {
  const instant = now ?? new Date();
  const target = isoWeek ?? isoWeekOf(instant);

  const range = isoWeekRange(target);
  if (range === null) {
    throw new HttpError(
      400,
      'PALMARES_INVALID_WEEK',
      `La semaine ${isoWeekLabel(target)} n'existe pas.`,
    );
  }

  const rows: PalmaresRow[] = await db
    .selectFrom('tableaux')
    .innerJoin('user', 'user.id', 'tableaux.user_id')
    .leftJoin('user_profiles', 'user_profiles.user_id', 'tableaux.user_id')
    .select([
      'tableaux.id',
      'tableaux.name',
      'tableaux.score',
      'tableaux.created_at',
      'tableaux.user_id',
      'tableaux.region_card_id',
      'tableaux.departement_card_id',
      'tableaux.commune_card_id',
      'tableaux.rue_card_id',
      'user.pseudo',
      'user.name as user_name',
      'user_profiles.profile_public',
    ])
    .where('tableaux.created_at', '>=', range.start)
    .where('tableaux.created_at', '<', range.end)
    .orderBy('tableaux.score', 'desc')
    .orderBy('tableaux.created_at', 'asc')
    .orderBy('tableaux.id', 'asc')
    .limit(limit)
    .execute();

  const counted = await db
    .selectFrom('tableaux')
    .select(db.fn.countAll().as('total'))
    .where('created_at', '>=', range.start)
    .where('created_at', '<', range.end)
    .executeTakeFirstOrThrow();
  const total = Number(counted.total);

  const cardIds: string[] = [];
  for (const row of rows) {
    for (const slot of TABLEAU_SLOTS) {
      const cardId = cardIdOfSlot(row, slot);
      if (cardId !== null) cardIds.push(cardId);
    }
  }

  const cardRows =
    cardIds.length === 0
      ? []
      : await db
          .selectFrom('user_cards')
          .select(['id', 'category', 'ref_code', 'rarity', 'score'])
          .where('id', 'in', cardIds)
          .execute();
  const cardsById = new Map(cardRows.map((card) => [card.id, card]));
  const noms = await resolveCardNoms(db, cardRows);
  // Les blasons de toute la page se résolvent en un appel : jamais une requête par entrée.
  const assets = await resolveCardAssets(db, cardRows);

  const items: PalmaresEntry[] = rows.map((row, index) => {
    const cards: PalmaresCard[] = [];
    for (const slot of TABLEAU_SLOTS) {
      const cardId = cardIdOfSlot(row, slot);
      if (cardId === null) continue;
      const card = cardsById.get(cardId);
      if (card === undefined) continue;
      const key = cardNomKey(card.category, card.ref_code);
      const asset = assets.get(key);
      cards.push({
        cardId: card.id,
        category: card.category,
        refCode: card.ref_code,
        // Un référentiel incomplet ne rend jamais un libellé vide : le code de
        // référence est laid mais cliquable et identifiable (symptôme de BUG-002).
        nom: noms.get(key) ?? card.ref_code,
        rarity: card.rarity,
        score: card.score,
        blasonUrl: asset?.blasonUrl ?? null,
        blasonCredit: asset?.blasonCredit ?? null,
      });
    }

    return {
      rank: index + 1,
      tableauId: row.id,
      name: row.name,
      score: row.score,
      createdAt: row.created_at.toISOString(),
      yours: row.user_id === viewerId,
      player: {
        id: row.user_id,
        pseudo: row.pseudo ?? row.user_name,
        profilePublic: row.profile_public ?? true,
      },
      cards,
    };
  });

  return {
    week: isoWeekLabel(target),
    weekStart: range.start.toISOString(),
    weekEnd: range.end.toISOString(),
    current: isoWeekLabel(isoWeekOf(instant)) === isoWeekLabel(target),
    total,
    items,
  };
}
