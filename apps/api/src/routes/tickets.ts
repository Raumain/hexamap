import type { TicketStatus } from '@hexamap/db';
import { Elysia, t } from 'elysia';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import { authPlugin } from '../middleware/auth';
import { rarityUp, resolveCardMeta } from '../services/draw';
import { pickIndex } from '../services/rng';
import {
  expireStaleTicket,
  generateTicket,
  insertUserCard,
  loadMaskedTicket,
  type MaskedCell,
  manhattanDistance,
  parseGrid,
  type ScratchEffect,
  type TicketCell,
} from '../services/ticket';

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

const kindSchema = t.Union([
  t.Literal('CARD'),
  t.Literal('TREASURE'),
  t.Literal('TWIN'),
  t.Literal('STATION'),
  t.Literal('BELVEDERE'),
  t.Literal('RENOVATION'),
]);

const maskedCardSchema = t.Object(
  {
    category: categorySchema,
    refCode: t.String(),
    rarity: raritySchema,
    score: t.Integer(),
    nom: t.String(),
    blasonUrl: t.Union([t.String(), t.Null()]),
    blasonCredit: t.Union([t.String(), t.Null()]),
  },
  { additionalProperties: false },
);

const maskedCellSchema = t.Object(
  {
    index: t.Integer(),
    revealed: t.Boolean(),
    distance: t.Union([t.Integer(), t.Null()]),
    kind: t.Union([kindSchema, t.Null()]),
    nom: t.Union([t.String(), t.Null()]),
    card: t.Union([maskedCardSchema, t.Null()]),
  },
  { additionalProperties: false },
);

const maskedTicketSchema = t.Object(
  {
    id: t.String(),
    status: t.Union([t.Literal('ACTIVE'), t.Literal('EXHAUSTED'), t.Literal('EXPIRED')]),
    scrapesRemaining: t.Integer(),
    renovationPending: t.Boolean(),
    createdAt: t.String(),
    expiresAt: t.Union([t.String(), t.Null()]),
    cells: t.Array(maskedCellSchema),
    treasureFound: t.Boolean(),
  },
  { additionalProperties: false },
);

const scratchEffectSchema = t.Union([
  t.Literal('CARD_ADDED'),
  t.Literal('SCRAPES_ADDED'),
  t.Literal('ADJACENT_REVEALED'),
  t.Literal('RENOVATION_APPLIED'),
  t.Literal('RENOVATION_PENDING'),
  t.Literal('TREASURE_FOUND'),
  t.Literal('TICKET_EXHAUSTED'),
]);

const errorSchema = t.Object(
  { code: t.String(), message: t.String() },
  { additionalProperties: false },
);

const unauthorized = { code: 'UNAUTHORIZED', message: 'Non authentifié' };

/** Voisins orthogonaux (4-connectivité) d'un indice de grille 4×4. */
function adjacentIndices(index: number): number[] {
  const row = Math.floor(index / 4);
  const col = index % 4;
  const result: number[] = [];
  if (row > 0) result.push(index - 4);
  if (row < 3) result.push(index + 4);
  if (col > 0) result.push(index - 1);
  if (col < 3) result.push(index + 1);
  return result;
}

export const ticketRoutes = new Elysia({ name: 'routes.tickets', prefix: '/tickets' })
  .use(authPlugin)
  .post(
    '/',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      await expireStaleTicket(db, user.id);

      const active = await db
        .selectFrom('tickets')
        .select('id')
        .where('user_id', '=', user.id)
        .where('status', '=', 'ACTIVE')
        .executeTakeFirst();
      if (active) {
        set.status = 409;
        return { code: 'TICKET_ALREADY_ACTIVE', message: 'Un ticket est déjà en cours.' };
      }

      try {
        const { ticketId } = await db
          .transaction()
          .execute(async (trx) => generateTicket(trx, user.id));
        const ticket = await loadMaskedTicket(db, ticketId, user.id);
        set.status = 201;
        return { ticket };
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        // Deux créations concurrentes peuvent percuter l'index unique partiel
        // `tickets_one_active_per_user` malgré le pré-contrôle (TOCTOU) : on
        // mappe la violation d'unicité Postgres en 409 plutôt qu'en 500.
        const pgCode = (error as { code?: string }).code;
        const pgMessage = error instanceof Error ? error.message : '';
        if (pgCode === '23505' || /tickets_one_active_per_user|duplicate key/i.test(pgMessage)) {
          set.status = 409;
          return { code: 'TICKET_ALREADY_ACTIVE', message: 'Un ticket est déjà en cours.' };
        }
        throw error;
      }
    },
    {
      response: {
        201: t.Object({ ticket: maskedTicketSchema }, { additionalProperties: false }),
        401: errorSchema,
        409: errorSchema,
        503: errorSchema,
      },
    },
  )
  .get(
    '/current',
    async ({ user, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }

      await expireStaleTicket(db, user.id);

      const row = await db
        .selectFrom('tickets')
        .select([
          'id',
          'status',
          'scrapes_remaining',
          'renovation_pending',
          'created_at',
          'expires_at',
        ])
        .where('user_id', '=', user.id)
        .where('status', '=', 'ACTIVE')
        .orderBy('created_at', 'desc')
        .executeTakeFirst();

      if (!row) {
        set.status = 404;
        return { code: 'NO_ACTIVE_TICKET', message: 'Aucun ticket actif.' };
      }

      const ticket = await loadMaskedTicket(db, row.id, user.id);
      return { ticket };
    },
    {
      response: {
        200: t.Object({ ticket: maskedTicketSchema }, { additionalProperties: false }),
        401: errorSchema,
        404: errorSchema,
      },
    },
  )
  .post(
    '/:id/scratch',
    async ({ user, params, body, set }) => {
      if (!user) {
        set.status = 401;
        return unauthorized;
      }
      const userId = user.id;

      const revealed: MaskedCell[] = [];
      const effects: ScratchEffect[] = [];

      try {
        await db.transaction().execute(async (trx) => {
          const row = await trx
            .selectFrom('tickets')
            .selectAll()
            .where('id', '=', params.id)
            .where('user_id', '=', userId)
            .forUpdate()
            .executeTakeFirst();

          if (!row) {
            throw new HttpError(404, 'TICKET_NOT_FOUND', 'Ticket introuvable.');
          }
          if (row.status !== 'ACTIVE') {
            throw new HttpError(409, 'TICKET_NOT_ACTIVE', "Ce ticket n'est plus actif.");
          }
          if (row.expires_at && row.expires_at.getTime() < Date.now()) {
            await trx
              .updateTable('tickets')
              .set({ status: 'EXPIRED' })
              .where('id', '=', row.id)
              .execute();
            throw new HttpError(409, 'TICKET_EXPIRED', 'Ce ticket a expiré.');
          }
          if (row.scrapes_remaining <= 0) {
            throw new HttpError(409, 'NO_SCRAPES_LEFT', 'Plus aucun grattage disponible.');
          }

          const existing = await trx
            .selectFrom('ticket_reveals')
            .select('cell_index')
            .where('ticket_id', '=', row.id)
            .where('cell_index', '=', body.cellIndex)
            .executeTakeFirst();
          if (existing) {
            throw new HttpError(409, 'CELL_ALREADY_REVEALED', 'Cette case a déjà été grattée.');
          }

          const grid = parseGrid(row.grid);
          const cell = grid[body.cellIndex];
          if (!cell) {
            throw new HttpError(409, 'CELL_INVALID', 'Case invalide.');
          }

          const treasureIndex = row.treasure_index;
          const ticketId = row.id;

          const revealedSet = new Set<number>(
            (
              await trx
                .selectFrom('ticket_reveals')
                .select('cell_index')
                .where('ticket_id', '=', row.id)
                .execute()
            ).map((r) => r.cell_index),
          );

          let scrapesRemaining = row.scrapes_remaining - 1;
          let renovationPending = row.renovation_pending;

          async function revealCell(
            index: number,
            target: TicketCell,
            cascade: boolean,
          ): Promise<void> {
            const distance = manhattanDistance(index, treasureIndex);
            revealedSet.add(index);

            if (target.kind === 'STATION') {
              await trx
                .insertInto('ticket_reveals')
                .values({ ticket_id: ticketId, cell_index: index, card_user_id: null, distance })
                .execute();
              revealed.push({
                index,
                revealed: true,
                distance,
                kind: 'STATION',
                nom: null,
                card: null,
              });
              scrapesRemaining += 2;
              effects.push('SCRAPES_ADDED');
              return;
            }

            let rarity = target.card.rarity;
            let appliedRenovation = false;
            if (renovationPending) {
              rarity = rarityUp(rarity);
              renovationPending = false;
              appliedRenovation = true;
            }

            const meta = await resolveCardMeta(
              trx,
              target.card.category,
              target.card.ref_code,
              rarity,
            );
            const granted: {
              category: typeof target.card.category;
              ref_code: string;
              rarity: typeof rarity;
            } = {
              category: target.card.category,
              ref_code: target.card.ref_code,
              rarity,
            };
            const cardId = await insertUserCard(trx, userId, granted, meta.score);
            await trx
              .insertInto('ticket_reveals')
              .values({ ticket_id: ticketId, cell_index: index, card_user_id: cardId, distance })
              .execute();

            revealed.push({
              index,
              revealed: true,
              distance,
              kind: target.kind,
              nom: meta.nom,
              card: {
                category: target.card.category,
                refCode: target.card.ref_code,
                rarity,
                score: meta.score,
                nom: meta.nom,
                blasonUrl: meta.blasonUrl,
                blasonCredit: meta.blasonCredit,
              },
            });

            effects.push('CARD_ADDED');
            if (appliedRenovation) {
              effects.push('RENOVATION_APPLIED');
            }
            if (target.kind === 'TREASURE') {
              effects.push('TREASURE_FOUND');
            }
            if (target.kind === 'RENOVATION') {
              renovationPending = true;
              effects.push('RENOVATION_PENDING');
            }
            if (target.kind === 'BELVEDERE' && cascade) {
              const candidates = adjacentIndices(index).filter((i) => !revealedSet.has(i));
              if (candidates.length > 0) {
                const adj = candidates[pickIndex(candidates.length)];
                const adjCell = adj === undefined ? undefined : grid[adj];
                if (adj !== undefined && adjCell) {
                  await revealCell(adj, adjCell, false);
                  effects.push('ADJACENT_REVEALED');
                }
              }
            }
          }

          await revealCell(body.cellIndex, cell, true);

          let status: TicketStatus = row.status;
          if (scrapesRemaining === 0) {
            status = 'EXHAUSTED';
            effects.push('TICKET_EXHAUSTED');
          }

          await trx
            .updateTable('tickets')
            .set({
              scrapes_remaining: scrapesRemaining,
              status,
              renovation_pending: renovationPending,
            })
            .where('id', '=', row.id)
            .execute();
        });

        const ticket = await loadMaskedTicket(db, params.id, user.id);
        return { ticket, revealed, effects };
      } catch (error) {
        if (error instanceof HttpError) {
          set.status = error.status;
          return { code: error.code, message: error.message };
        }
        throw error;
      }
    },
    {
      params: t.Object({ id: t.String({ format: 'uuid' }) }),
      body: t.Object({ cellIndex: t.Integer({ minimum: 0, maximum: 15 }) }),
      response: {
        200: t.Object(
          {
            ticket: maskedTicketSchema,
            revealed: t.Array(maskedCellSchema),
            effects: t.Array(scratchEffectSchema),
          },
          { additionalProperties: false },
        ),
        401: errorSchema,
        404: errorSchema,
        409: errorSchema,
        422: errorSchema,
        503: errorSchema,
      },
    },
  );
