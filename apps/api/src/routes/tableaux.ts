import type { CardCategory, Rarity } from '@hexamap/db';
import {
  type CommuneOdonymeRef,
  evaluateTableau,
  rueExistsInCommune,
  slotMatchesCategory,
  type TableauGeography,
  type TableauSlot,
} from '@hexamap/shared';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';
import { cardNomKey, type Executor, resolveCardNoms } from '../services/draw';

const raritySchema = t.Union([
  t.Literal('COMMUNE'),
  t.Literal('INHABITUELLE'),
  t.Literal('RARE'),
  t.Literal('EPIQUE'),
  t.Literal('LEGENDAIRE'),
  t.Literal('MYTHIQUE'),
]);

const categorySchema = t.Union([
  t.Literal('REGION'),
  t.Literal('DEPARTEMENT'),
  t.Literal('COMMUNE'),
  t.Literal('RUE'),
]);

const slotSchema = t.Union([
  t.Literal('REGION'),
  t.Literal('DEPARTEMENT'),
  t.Literal('COMMUNE'),
  t.Literal('RUE'),
]);

const linkKeySchema = t.Union([
  t.Literal('region-departement'),
  t.Literal('departement-commune'),
  t.Literal('commune-rue'),
]);

const slotCardSchema = t.Object(
  {
    id: t.String(),
    category: categorySchema,
    refCode: t.String(),
    nom: t.String(),
    rarity: raritySchema,
    score: t.Integer(),
    locked: t.Boolean(),
  },
  { additionalProperties: false },
);

const tableauCardSchema = t.Object(
  { ...slotCardSchema.properties, slot: slotSchema },
  { additionalProperties: false },
);

/** Slot d'un tableau listé : une carte résolue, ou null si le slot est vide. */
const nullableSlotCardSchema = t.Union([tableauCardSchema, t.Null()]);

const linkResultSchema = t.Object(
  { key: linkKeySchema, valid: t.Boolean(), label: t.String() },
  { additionalProperties: false },
);

const alignmentSchema = t.Object(
  {
    links: t.Integer(),
    multiplier: t.Number(),
    breakdown: t.Array(linkResultSchema),
  },
  { additionalProperties: false },
);

const geographySchema = t.Object(
  {
    regionCode: t.Union([t.String(), t.Null()]),
    departementCode: t.Union([t.String(), t.Null()]),
    departementRegionCode: t.Union([t.String(), t.Null()]),
    communeInsee: t.Union([t.String(), t.Null()]),
    communeDepartementCode: t.Union([t.String(), t.Null()]),
    rueOdonymeId: t.Union([t.String(), t.Null()]),
    rueInCommune: t.Boolean(),
  },
  { additionalProperties: false },
);

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

type CardRow = {
  id: string;
  category: CardCategory;
  ref_code: string;
  score: number;
  rarity: Rarity;
  locked: boolean;
};

type SelectedCards = {
  region: CardRow | null;
  departement: CardRow | null;
  commune: CardRow | null;
  rue: CardRow | null;
};

/** Lignes de référence déjà résolues, nécessaires à la construction d'une
 *  géographie. `null` quand la ligne manque en base. */
interface GeographyReferenceRows {
  region: { code: string } | null;
  departement: { code: string; code_region: string | null } | null;
  commune: { code_insee: string; code_departement: string | null } | null;
  odonymes: ReadonlyArray<CommuneOdonymeRef>;
}

/** Construit la géographie d'une sélection (partielle ou complète) à partir des
 *  lignes de référence déjà résolues. Pur : aucune requête, ne lève jamais.
 *  Repli sur `ref_code` quand la ligne de référence manque ; lien invalide. */
function buildTableauGeography(
  cards: SelectedCards,
  refs: GeographyReferenceRows,
): TableauGeography {
  const regionCode = cards.region ? (refs.region?.code ?? cards.region.ref_code) : null;

  const departementCode = cards.departement
    ? (refs.departement?.code ?? cards.departement.ref_code)
    : null;
  const departementRegionCode = cards.departement ? (refs.departement?.code_region ?? null) : null;

  const communeInsee = cards.commune ? (refs.commune?.code_insee ?? cards.commune.ref_code) : null;
  const communeDepartementCode = cards.commune ? (refs.commune?.code_departement ?? null) : null;

  const rueOdonymeId = cards.rue ? cards.rue.ref_code : null;
  const rueInCommune = rueExistsInCommune(refs.odonymes, communeInsee, rueOdonymeId);

  return {
    regionCode,
    departementCode,
    departementRegionCode,
    communeInsee,
    communeDepartementCode,
    rueOdonymeId,
    rueInCommune,
  };
}

/** Résout la géographie d'une sélection (partielle ou complète) sans jamais
 *  lever si une donnée de référence est absente : champ null, lien invalide. */
async function resolveGeography(exec: Executor, cards: SelectedCards): Promise<TableauGeography> {
  const region = cards.region
    ? await exec
        .selectFrom('ref_regions')
        .select('code')
        .where('code', '=', cards.region.ref_code)
        .executeTakeFirst()
    : null;

  const departement = cards.departement
    ? await exec
        .selectFrom('ref_departements')
        .select(['code', 'code_region'])
        .where('code', '=', cards.departement.ref_code)
        .executeTakeFirst()
    : null;

  const commune = cards.commune
    ? await exec
        .selectFrom('ref_communes')
        .select(['code_insee', 'code_departement'])
        .where('code_insee', '=', cards.commune.ref_code)
        .executeTakeFirst()
    : null;

  const communeInsee = commune?.code_insee ?? cards.commune?.ref_code ?? null;
  const odonymes: CommuneOdonymeRef[] =
    cards.rue && communeInsee !== null
      ? (
          await exec
            .selectFrom('commune_odonymes')
            .select(['code_insee', 'odonyme_id'])
            .where('code_insee', '=', communeInsee)
            .where('odonyme_id', '=', cards.rue.ref_code)
            .execute()
        ).map((row) => ({ codeInsee: row.code_insee, odonymeId: row.odonyme_id }))
      : [];

  return buildTableauGeography(cards, {
    region: region ?? null,
    departement: departement ?? null,
    commune: commune ?? null,
    odonymes,
  });
}

/** Projette une carte résolue en carte de slot (nom via la map des noms). */
function toSlotCard(noms: Map<string, string>, slot: TableauSlot, card: CardRow) {
  return {
    id: card.id,
    category: card.category,
    refCode: card.ref_code,
    nom: noms.get(cardNomKey(card.category, card.ref_code)) ?? '',
    rarity: card.rarity,
    score: card.score,
    locked: card.locked,
    slot,
  };
}

/** Vérifie que chaque carte non nulle correspond à la catégorie de son slot. */
function assertSlotsMatch(cards: SelectedCards): void {
  const checks: Array<[TableauSlot, CardRow | null]> = [
    ['REGION', cards.region],
    ['DEPARTEMENT', cards.departement],
    ['COMMUNE', cards.commune],
    ['RUE', cards.rue],
  ];
  for (const [slot, card] of checks) {
    if (card !== null && !slotMatchesCategory(slot, card.category)) {
      throw new HttpError(400, 'INVALID_CARD_SET', 'La carte ne correspond pas à son emplacement.');
    }
  }
}

export const tableauRoutes = new Elysia({ name: 'routes.tableaux', prefix: '/tableaux' })
  .use(authPlugin)
  .get(
    '/preview',
    async ({ user, query, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const requested: Array<[TableauSlot, string]> = [];
      if (query.regionCardId) requested.push(['REGION', query.regionCardId]);
      if (query.departementCardId) requested.push(['DEPARTEMENT', query.departementCardId]);
      if (query.communeCardId) requested.push(['COMMUNE', query.communeCardId]);
      if (query.rueCardId) requested.push(['RUE', query.rueCardId]);

      const ids = requested.map(([, id]) => id);
      const rows =
        ids.length === 0
          ? []
          : await db
              .selectFrom('user_cards')
              .select(['id', 'category', 'ref_code', 'score', 'rarity', 'locked'])
              .where('id', 'in', ids)
              .where('user_id', '=', user.id)
              .execute();

      const byId = new Map(rows.map((row) => [row.id, row]));
      for (const id of ids) {
        if (!byId.has(id)) {
          set.status = 403;
          return { code: 'CARD_NOT_OWNED', message: 'Carte introuvable dans votre collection.' };
        }
      }

      const cards: SelectedCards = {
        region: query.regionCardId ? (byId.get(query.regionCardId) ?? null) : null,
        departement: query.departementCardId ? (byId.get(query.departementCardId) ?? null) : null,
        commune: query.communeCardId ? (byId.get(query.communeCardId) ?? null) : null,
        rue: query.rueCardId ? (byId.get(query.rueCardId) ?? null) : null,
      };

      try {
        assertSlotsMatch(cards);
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }

      const geography = await resolveGeography(db, cards);
      const complete =
        cards.region !== null &&
        cards.departement !== null &&
        cards.commune !== null &&
        cards.rue !== null;

      const scores = {
        region: cards.region?.score ?? 0,
        departement: cards.departement?.score ?? 0,
        commune: cards.commune?.score ?? 0,
        rue: cards.rue?.score ?? 0,
      };
      const evaluation = evaluateTableau(scores, geography);

      return {
        geography,
        alignment: evaluation.alignment,
        total: complete ? evaluation.total : null,
        complete,
      };
    },
    {
      query: t.Object({
        regionCardId: t.Optional(t.String({ format: 'uuid' })),
        departementCardId: t.Optional(t.String({ format: 'uuid' })),
        communeCardId: t.Optional(t.String({ format: 'uuid' })),
        rueCardId: t.Optional(t.String({ format: 'uuid' })),
      }),
      response: {
        200: t.Object(
          {
            geography: geographySchema,
            alignment: alignmentSchema,
            total: t.Union([t.Integer(), t.Null()]),
            complete: t.Boolean(),
          },
          { additionalProperties: false },
        ),
        400: errorSchema,
        401: errorSchema,
        403: errorSchema,
      },
    },
  )
  .get(
    '/',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const tableaux = await db
        .selectFrom('tableaux')
        .select([
          'id',
          'name',
          'created_at',
          'region_card_id',
          'departement_card_id',
          'commune_card_id',
          'rue_card_id',
        ])
        .where('user_id', '=', user.id)
        .orderBy('created_at', 'desc')
        .limit(200)
        .execute();

      if (tableaux.length === 0) {
        return { items: [] };
      }

      // Une seule requête `user_cards` pour toutes les cartes référencées
      // (revérifie la possession : une FK ne garantit pas l'appartenance).
      const cardIds = tableaux
        .flatMap((tableau) => [
          tableau.region_card_id,
          tableau.departement_card_id,
          tableau.commune_card_id,
          tableau.rue_card_id,
        ])
        .filter((id) => id !== null);

      const cardRows =
        cardIds.length === 0
          ? []
          : await db
              .selectFrom('user_cards')
              .select(['id', 'category', 'ref_code', 'score', 'rarity', 'locked'])
              .where('id', 'in', cardIds)
              .where('user_id', '=', user.id)
              .execute();
      const cardsById = new Map(cardRows.map((row) => [row.id, row]));
      const noms = await resolveCardNoms(db, cardRows);

      // Résolution des référentiels en 4 requêtes max, puis index en Map O(1).
      const regionCodes = cardRows
        .filter((row) => row.category === 'REGION')
        .map((row) => row.ref_code);
      const departementCodes = cardRows
        .filter((row) => row.category === 'DEPARTEMENT')
        .map((row) => row.ref_code);
      const communeCodes = cardRows
        .filter((row) => row.category === 'COMMUNE')
        .map((row) => row.ref_code);
      const rueCodes = cardRows.filter((row) => row.category === 'RUE').map((row) => row.ref_code);

      const [regionRefs, departementRefs, communeRefs, odonymeRefs] = await Promise.all([
        regionCodes.length === 0
          ? Promise.resolve([] as { code: string }[])
          : db.selectFrom('ref_regions').select('code').where('code', 'in', regionCodes).execute(),
        departementCodes.length === 0
          ? Promise.resolve([] as { code: string; code_region: string | null }[])
          : db
              .selectFrom('ref_departements')
              .select(['code', 'code_region'])
              .where('code', 'in', departementCodes)
              .execute(),
        communeCodes.length === 0
          ? Promise.resolve([] as { code_insee: string; code_departement: string | null }[])
          : db
              .selectFrom('ref_communes')
              .select(['code_insee', 'code_departement'])
              .where('code_insee', 'in', communeCodes)
              .execute(),
        communeCodes.length === 0 || rueCodes.length === 0
          ? Promise.resolve([] as { code_insee: string; odonyme_id: string }[])
          : db
              .selectFrom('commune_odonymes')
              .select(['code_insee', 'odonyme_id'])
              .where('code_insee', 'in', communeCodes)
              .where('odonyme_id', 'in', rueCodes)
              .execute(),
      ]);

      const regionByCode = new Map(regionRefs.map((row) => [row.code, row]));
      const departementByCode = new Map(departementRefs.map((row) => [row.code, row]));
      const communeByInsee = new Map(communeRefs.map((row) => [row.code_insee, row]));
      const odonymeByCommune = new Map<string, CommuneOdonymeRef[]>();
      for (const row of odonymeRefs) {
        const list = odonymeByCommune.get(row.code_insee) ?? [];
        list.push({ codeInsee: row.code_insee, odonymeId: row.odonyme_id });
        odonymeByCommune.set(row.code_insee, list);
      }

      const enriched = tableaux.map((tableau) => {
        const cards: SelectedCards = {
          region: tableau.region_card_id ? (cardsById.get(tableau.region_card_id) ?? null) : null,
          departement: tableau.departement_card_id
            ? (cardsById.get(tableau.departement_card_id) ?? null)
            : null,
          commune: tableau.commune_card_id
            ? (cardsById.get(tableau.commune_card_id) ?? null)
            : null,
          rue: tableau.rue_card_id ? (cardsById.get(tableau.rue_card_id) ?? null) : null,
        };

        const geography = buildTableauGeography(cards, {
          region: cards.region ? (regionByCode.get(cards.region.ref_code) ?? null) : null,
          departement: cards.departement
            ? (departementByCode.get(cards.departement.ref_code) ?? null)
            : null,
          commune: cards.commune ? (communeByInsee.get(cards.commune.ref_code) ?? null) : null,
          odonymes: cards.commune ? (odonymeByCommune.get(cards.commune.ref_code) ?? []) : [],
        });

        const scores = {
          region: cards.region?.score ?? 0,
          departement: cards.departement?.score ?? 0,
          commune: cards.commune?.score ?? 0,
          rue: cards.rue?.score ?? 0,
        };
        const evaluation = evaluateTableau(scores, geography);
        const complete =
          cards.region !== null &&
          cards.departement !== null &&
          cards.commune !== null &&
          cards.rue !== null;

        return { tableau, cards, evaluation, complete };
      });

      enriched.sort(
        (a, b) =>
          b.evaluation.total - a.evaluation.total ||
          b.tableau.created_at.getTime() - a.tableau.created_at.getTime(),
      );

      const items = enriched.map(({ tableau, cards, evaluation, complete }) => ({
        id: tableau.id,
        name: tableau.name,
        createdAt: tableau.created_at.toISOString(),
        complete,
        total: evaluation.total,
        alignment: evaluation.alignment,
        cards: {
          region: cards.region ? toSlotCard(noms, 'REGION', cards.region) : null,
          departement: cards.departement
            ? toSlotCard(noms, 'DEPARTEMENT', cards.departement)
            : null,
          commune: cards.commune ? toSlotCard(noms, 'COMMUNE', cards.commune) : null,
          rue: cards.rue ? toSlotCard(noms, 'RUE', cards.rue) : null,
        },
      }));

      return { items };
    },
    {
      response: {
        200: t.Object(
          {
            items: t.Array(
              t.Object(
                {
                  id: t.String(),
                  name: t.String(),
                  createdAt: t.String(),
                  complete: t.Boolean(),
                  total: t.Integer(),
                  alignment: alignmentSchema,
                  cards: t.Object(
                    {
                      region: nullableSlotCardSchema,
                      departement: nullableSlotCardSchema,
                      commune: nullableSlotCardSchema,
                      rue: nullableSlotCardSchema,
                    },
                    { additionalProperties: false },
                  ),
                },
                { additionalProperties: false },
              ),
            ),
          },
          { additionalProperties: false },
        ),
        401: errorSchema,
      },
    },
  )
  .post(
    '/',
    async ({ user, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      const cardIds = [
        body.regionCardId,
        body.departementCardId,
        body.communeCardId,
        body.rueCardId,
      ];

      try {
        const result = await db.transaction().execute(async (trx) => {
          if (new Set(cardIds).size !== 4) {
            throw new HttpError(
              400,
              'INVALID_CARD_SET',
              'Les quatre cartes doivent être distinctes.',
            );
          }

          const owned = await trx
            .selectFrom('user_cards')
            .select(['id', 'category', 'ref_code', 'score', 'rarity', 'locked'])
            .where('id', 'in', cardIds)
            .where('user_id', '=', user.id)
            .where('locked', '=', false)
            .forUpdate()
            .execute();

          if (owned.length !== 4) {
            throw new HttpError(
              403,
              'CARD_NOT_OWNED',
              'Vous ne possédez pas toutes ces cartes ou elles sont verrouillées.',
            );
          }

          const byId = new Map(owned.map((row) => [row.id, row]));
          const cards: SelectedCards = {
            region: byId.get(body.regionCardId) ?? null,
            departement: byId.get(body.departementCardId) ?? null,
            commune: byId.get(body.communeCardId) ?? null,
            rue: byId.get(body.rueCardId) ?? null,
          };

          assertSlotsMatch(cards);

          const inUse = await trx
            .selectFrom('tableaux')
            .select('id')
            .where('user_id', '=', user.id)
            .where((eb) =>
              eb.or([
                eb('region_card_id', 'in', cardIds),
                eb('departement_card_id', 'in', cardIds),
                eb('commune_card_id', 'in', cardIds),
                eb('rue_card_id', 'in', cardIds),
              ]),
            )
            .executeTakeFirst();

          if (inUse) {
            throw new HttpError(
              409,
              'CARD_IN_USE',
              'Une carte est déjà utilisée dans un autre tableau.',
            );
          }

          const geography = await resolveGeography(trx, cards);
          const scores = {
            region: cards.region?.score ?? 0,
            departement: cards.departement?.score ?? 0,
            commune: cards.commune?.score ?? 0,
            rue: cards.rue?.score ?? 0,
          };
          const evaluation = evaluateTableau(scores, geography);

          const inserted = await trx
            .insertInto('tableaux')
            .values({
              user_id: user.id,
              name: body.name?.trim() || 'Mon tableau',
              region_card_id: body.regionCardId,
              departement_card_id: body.departementCardId,
              commune_card_id: body.communeCardId,
              rue_card_id: body.rueCardId,
            })
            .returning(['id', 'name', 'created_at'])
            .executeTakeFirstOrThrow();

          const noms = await resolveCardNoms(trx, owned);

          return {
            id: inserted.id,
            name: inserted.name,
            createdAt: inserted.created_at.toISOString(),
            cards: {
              region: toSlotCard(noms, 'REGION', cards.region as CardRow),
              departement: toSlotCard(noms, 'DEPARTEMENT', cards.departement as CardRow),
              commune: toSlotCard(noms, 'COMMUNE', cards.commune as CardRow),
              rue: toSlotCard(noms, 'RUE', cards.rue as CardRow),
            },
            alignment: evaluation.alignment,
            total: evaluation.total,
          };
        });

        set.status = 201;
        return { tableau: result };
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      body: t.Object({
        name: t.Optional(t.String({ minLength: 1, maxLength: 80 })),
        regionCardId: t.String({ format: 'uuid' }),
        departementCardId: t.String({ format: 'uuid' }),
        communeCardId: t.String({ format: 'uuid' }),
        rueCardId: t.String({ format: 'uuid' }),
      }),
      response: {
        201: t.Object(
          {
            tableau: t.Object(
              {
                id: t.String(),
                name: t.String(),
                createdAt: t.String(),
                cards: t.Object(
                  {
                    region: tableauCardSchema,
                    departement: tableauCardSchema,
                    commune: tableauCardSchema,
                    rue: tableauCardSchema,
                  },
                  { additionalProperties: false },
                ),
                alignment: alignmentSchema,
                total: t.Integer(),
              },
              { additionalProperties: false },
            ),
          },
          { additionalProperties: false },
        ),
        400: errorSchema,
        401: errorSchema,
        403: errorSchema,
        409: errorSchema,
      },
    },
  );
