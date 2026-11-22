import type { Database } from '@hexamap/db';
import {
  PUSH_DEFAULT_QUIET_END,
  PUSH_DEFAULT_QUIET_START,
  pushDecision,
  pushNotificationMessage,
  utcDay,
} from '@hexamap/shared';
import { type Kysely, sql } from 'kysely';
import { type PushHostResolver, requirePublicPushEndpoint } from '../lib/push-endpoint';
import { readScratchConfig } from './config';
import type { Executor } from './draw';
import type { PushSender } from './push-sender';

export type { PushHostResolver } from '../lib/push-endpoint';

/**
 * Clé fixe du verrou d'ordonnanceur. Distincte de `MIGRATION_LOCK_KEY`
 * (`2_147_483_000`) : deux verrous consultatifs de la même clé se bloqueraient
 * mutuellement.
 */
export const PUSH_SWEEP_LOCK_KEY = 2_147_483_043;

/** Borne d'un battement : une poussée n'est jamais un travail de masse. */
const DEFAULT_SWEEP_LIMIT = 200;

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPreferences {
  quietStart: number;
  quietEnd: number;
}

/**
 * Enregistre un abonnement. L'`endpoint` est validé **avant** l'écriture : un hôte
 * privé, un protocole non `https` ou un nom qui ne résout pas lèvent un `400` et
 * ne laissent aucune ligne (`.docs/02-database.md` §4.12).
 *
 * `endpoint` est unique globalement : se réabonner depuis le même navigateur avec
 * un autre compte **réassigne** la ligne. Les colonnes de quota ne sont pas
 * réinitialisées — sinon une boucle de réabonnement contournerait le quota du jour.
 */
export async function subscribe(
  exec: Executor,
  userId: string,
  input: PushSubscriptionInput,
  options?: { resolve?: PushHostResolver },
): Promise<void> {
  await requirePublicPushEndpoint(input.endpoint, options);

  await exec
    .insertInto('push_subscriptions')
    .values({
      user_id: userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    })
    .onConflict((oc) =>
      oc.column('endpoint').doUpdateSet({
        user_id: userId,
        p256dh: input.p256dh,
        auth: input.auth,
      }),
    )
    .execute();
}

/** Supprime l'abonnement de **ce** compte. Rend le nombre de lignes retirées. */
export async function unsubscribe(
  exec: Executor,
  userId: string,
  endpoint: string,
): Promise<number> {
  const result = await exec
    .deleteFrom('push_subscriptions')
    .where('user_id', '=', userId)
    .where('endpoint', '=', endpoint)
    .executeTakeFirst();

  return Number(result.numDeletedRows);
}

/**
 * Les préférences vivent dans leur propre table : elles **survivent** au
 * désabonnement, sinon le joueur qui réactive retrouverait les heures calmes par
 * défaut sans l'avoir demandé. Une ligne absente vaut les défauts du contrat.
 */
export async function readPushPreferences(
  exec: Executor,
  userId: string,
): Promise<PushPreferences> {
  const row = await exec
    .selectFrom('push_preferences')
    .select(['quiet_start', 'quiet_end'])
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return {
    quietStart: row?.quiet_start ?? PUSH_DEFAULT_QUIET_START,
    quietEnd: row?.quiet_end ?? PUSH_DEFAULT_QUIET_END,
  };
}

export async function writePushPreferences(
  exec: Executor,
  userId: string,
  preferences: PushPreferences,
): Promise<void> {
  await exec
    .insertInto('push_preferences')
    .values({
      user_id: userId,
      quiet_start: preferences.quietStart,
      quiet_end: preferences.quietEnd,
    })
    .onConflict((oc) =>
      oc.column('user_id').doUpdateSet({
        quiet_start: preferences.quietStart,
        quiet_end: preferences.quietEnd,
        updated_at: new Date(),
      }),
    )
    .execute();
}

export interface PushSweepResult {
  /** `false` quand un autre processus détenait le verrou : rien n'a été fait. */
  locked: boolean;
  scanned: number;
  sent: number;
  skipped: number;
  purged: number;
}

export interface PushSweepDeps {
  db: Kysely<Database>;
  sender: PushSender;
  /** Instant de référence, injecté pour que la décision soit reproductible. */
  now?: Date;
  limit?: number;
}

interface SweepContext {
  now: Date;
  limit: number;
  sender: PushSender;
}

interface SweepContext {
  now: Date;
  limit: number;
  sender: PushSender;
}

/**
 * **Un couple de lectures par battement, jamais une par utilisateur.**
 *
 * 1. `game_config` : une ligne, le délai de régénération ;
 * 2. les candidats : une jointure indexée (`user_scratch_charges_empty_idx` est
 *    partiel sur `charges = 0`) bornée par `limit`. Au repos, elle rend **zéro
 *    ligne** et le battement coûte deux `SELECT` vides.
 *
 * Le travail par candidat suit, et il n'existe que pour un envoi réel : une mise à
 * jour d'une ligne, ou une suppression sur `404`/`410`.
 */
async function sweep(
  connection: Kysely<Database>,
  context: SweepContext,
): Promise<Omit<PushSweepResult, 'locked'>> {
  const { now, limit, sender } = context;

  const config = await readScratchConfig(connection);

  const candidates = await connection
    .selectFrom('push_subscriptions as s')
    .innerJoin('user_scratch_charges as c', 'c.user_id', 's.user_id')
    .leftJoin('push_preferences as p', 'p.user_id', 's.user_id')
    .select([
      's.id as id',
      's.endpoint as endpoint',
      's.p256dh as p256dh',
      's.auth as auth',
      's.last_sent_on as last_sent_on',
      's.last_notified_charge_at as last_notified_charge_at',
      'c.charges as charges',
      'c.last_regen_at as last_regen_at',
      'p.quiet_start as quiet_start',
      'p.quiet_end as quiet_end',
    ])
    .where('c.charges', '=', 0)
    .where(
      sql<boolean>`c.last_regen_at + (${config.regenMs}::bigint * interval '1 millisecond') <= ${now}`,
    )
    .orderBy('c.last_regen_at', 'asc')
    .limit(limit)
    .execute();

  let sent = 0;
  let skipped = 0;
  let purged = 0;

  for (const candidate of candidates) {
    const decision = pushDecision({
      charges: candidate.charges,
      lastRegenAt: candidate.last_regen_at,
      regenMs: config.regenMs,
      now,
      quietStart: candidate.quiet_start ?? PUSH_DEFAULT_QUIET_START,
      quietEnd: candidate.quiet_end ?? PUSH_DEFAULT_QUIET_END,
      lastSentOn: candidate.last_sent_on,
      lastNotifiedChargeAt: candidate.last_notified_charge_at,
    });

    if (!decision.send) {
      skipped += 1;
      continue;
    }

    const outcome = await sender(
      { endpoint: candidate.endpoint, p256dh: candidate.p256dh, auth: candidate.auth },
      pushNotificationMessage(),
    );

    if (outcome === 'GONE') {
      // Le service de push déclare l'abonnement mort : `404` ou `410`. La ligne
      // part, c'est la seule façon d'arrêter un envoi définitivement refusé.
      await connection.deleteFrom('push_subscriptions').where('id', '=', candidate.id).execute();
      purged += 1;
      continue;
    }

    if (outcome !== 'SENT') {
      skipped += 1;
      continue;
    }

    // Le quota et l'anti-doublon sont écrits **après** un envoi accepté, dans le
    // même ordre que la décision les lit.
    await connection
      .updateTable('push_subscriptions')
      .set({
        last_sent_on: utcDay(now),
        last_notified_charge_at: decision.chargeAt,
        last_sent_at: now,
      })
      .where('id', '=', candidate.id)
      .execute();

    sent += 1;
  }

  return { scanned: candidates.length, sent, skipped, purged };
}

/**
 * Un battement complet, sous `pg_try_advisory_lock`.
 *
 * Le verrou est pris sur **la connexion du battement**, pas sur une connexion du
 * pool : un verrou consultatif est lié à la session qui l'a pris, et le relâcher
 * depuis une autre connexion ne ferait rien. `db.connection()` garantit qu'une
 * seule session porte l'acquisition, le travail et la libération.
 *
 * Verrou non pris : le battement rend `locked: false` immédiatement. Aucune
 * attente, aucune file, aucun report — le suivant reprendra.
 */
export async function runPushSweep(deps: PushSweepDeps): Promise<PushSweepResult> {
  const now = deps.now ?? new Date();
  const limit = deps.limit ?? DEFAULT_SWEEP_LIMIT;

  return deps.db.connection().execute(async (connection) => {
    const lock = await sql<{ locked: boolean }>`
      select pg_try_advisory_lock(${PUSH_SWEEP_LOCK_KEY}) as locked
    `.execute(connection);

    if (lock.rows[0]?.locked !== true) {
      return { locked: false, scanned: 0, sent: 0, skipped: 0, purged: 0 };
    }

    try {
      const outcome = await sweep(connection, { now, limit, sender: deps.sender });
      return { locked: true, ...outcome };
    } finally {
      await sql`select pg_advisory_unlock(${PUSH_SWEEP_LOCK_KEY})`.execute(connection);
    }
  });
}
