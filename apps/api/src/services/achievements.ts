import {
  ACHIEVEMENTS,
  type AchievementFamily,
  type AchievementMetrics,
  newlyEarned,
} from '@hexamap/shared';
import { sql } from 'kysely';
import { db } from '../db';
import { HttpError } from '../lib/http-error';
import type { Executor } from './draw';
import { emitNotification } from './notifications';
import { loadTableauScores } from './tableaux';

const PAYOUTS_KEY = 'ACHIEVEMENT_PAYOUTS_ENABLED';
const PARIS_DATE = new Intl.DateTimeFormat('fr-CA', {
  timeZone: 'Europe/Paris',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export interface AchievementState {
  key: string;
  family: AchievementFamily;
  label: string;
  description: string;
  payout: number;
  threshold: number;
  progress: number | null;
  earnedAt: string | null;
}

export interface AchievementsView {
  payoutsEnabled: boolean;
  total: number;
  achievements: AchievementState[];
}

function toNumber(value: string | number | bigint | null | undefined): number {
  return Number(value ?? 0);
}

/** Lit l'interrupteur du robinet. Une clé absente est une erreur explicite,
 *  jamais un défaut silencieux.
 *
 *  Le test est strict et ferme par défaut : `value` est un `jsonb`, donc seule
 *  la valeur booléenne `true` ouvre le robinet. Une chaîne `"true"` mal typée,
 *  un `0` ou une forme `{ enabled: true }` laissent le robinet fermé — une
 *  configuration illisible ne doit jamais verser d'écus. */
async function readPayoutsEnabled(exec: Executor): Promise<boolean> {
  const row = await exec
    .selectFrom('game_config')
    .select('value')
    .where('key', '=', PAYOUTS_KEY)
    .executeTakeFirst();
  if (!row) {
    throw new HttpError(503, 'GAME_CONFIG_MISSING', 'Configuration de jeu incomplète.');
  }
  return row.value === true;
}

/** Index de jour d'une chaîne `AAAA-MM-JJ`, en jours depuis l'époque. */
function dayIndex(day: string): number {
  const year = Number(day.slice(0, 4));
  const month = Number(day.slice(5, 7));
  const date = Number(day.slice(8, 10));
  return Math.round(Date.UTC(year, month - 1, date) / 86_400_000);
}

/** Plus longue série de jours consécutifs portant au moins un ticket, les
 *  journées étant découpées en `Europe/Paris`. */
async function longestStreak(exec: Executor, userId: string): Promise<number> {
  // Le seuil maximal du catalogue est de trente jours consécutifs : une borne
  // de quatre cents jours couvre très largement le calcul, et évite de relire
  // tout l'historique d'un joueur ancien à chaque évaluation.
  const rows = await exec
    .selectFrom('tickets')
    .select('created_at')
    .where('user_id', '=', userId)
    .where('created_at', '>', sql<Date>`now() - interval '400 days'`)
    .execute();
  if (rows.length === 0) {
    return 0;
  }

  const days = [...new Set(rows.map((row) => PARIS_DATE.format(row.created_at)))].sort();
  let best = 0;
  let current = 0;
  let previous: string | null = null;
  for (const day of days) {
    if (previous !== null && dayIndex(day) - dayIndex(previous) === 1) {
      current += 1;
    } else {
      current = 1;
    }
    if (current > best) {
      best = current;
    }
    previous = day;
  }
  return best;
}

/**
 * Collecte les métriques de toutes les familles. Chaque valeur vient d'une
 * requête serveur : rien n'est transmis par le client. Les métriques dont la
 * table n'est pas encore migrée valent `null` et laissent leur médaille
 * verrouillée.
 */
async function collectMetrics(exec: Executor, userId: string): Promise<AchievementMetrics> {
  const scratchRow = await exec
    .selectFrom('ticket_reveals')
    .innerJoin('tickets', 'tickets.id', 'ticket_reveals.ticket_id')
    .select((eb) => eb.fn.count('tickets.id').distinct().as('total'))
    .where('tickets.user_id', '=', userId)
    .executeTakeFirst();

  const pepiteRow = await exec
    .selectFrom('ticket_reveals')
    .innerJoin('tickets', 'tickets.id', 'ticket_reveals.ticket_id')
    .select((eb) => eb.fn.countAll().as('total'))
    .where('tickets.user_id', '=', userId)
    .whereRef('ticket_reveals.cell_index', '=', 'tickets.treasure_index')
    .executeTakeFirst();

  const cardsRow = await exec
    .selectFrom('user_cards')
    .select((eb) => eb.fn.countAll().as('total'))
    .where('user_id', '=', userId)
    .executeTakeFirst();

  const mythiqueRow = await exec
    .selectFrom('user_cards')
    .select((eb) => eb.fn.countAll().as('total'))
    .where('user_id', '=', userId)
    .where('rarity', '=', 'MYTHIQUE')
    .where('source', '=', 'TICKET')
    .executeTakeFirst();

  const regionsRow = await exec
    .selectFrom('user_cards')
    .select((eb) => eb.fn.count('ref_code').distinct().as('total'))
    .where('user_id', '=', userId)
    .where('category', '=', 'REGION')
    .executeTakeFirst();

  const departementsRow = await exec
    .selectFrom('user_cards')
    .select((eb) => eb.fn.count('ref_code').distinct().as('total'))
    .where('user_id', '=', userId)
    .where('category', '=', 'DEPARTEMENT')
    .executeTakeFirst();

  const raritiesRow = await exec
    .selectFrom('user_cards')
    .select((eb) => eb.fn.count('rarity').distinct().as('total'))
    .where('user_id', '=', userId)
    .executeTakeFirst();

  // `ref_odonymes` compte ~450 000 lignes : une sous-requête non bornée y
  // ferait un balayage complet à chaque évaluation. Les identifiants de rue du
  // joueur sont d'abord lus (quelques dizaines, servis par
  // `user_cards_owner_idx`), puis la vérification porte sur la clé primaire de
  // `ref_odonymes`. Un `ref_code` non numérique ne peut désigner un odonyme et
  // est écarté comme il l'était déjà ; un `in` vide est court-circuité, Kysely
  // refusant de compiler une liste vide.
  const rueRows = await exec
    .selectFrom('user_cards')
    .select('ref_code')
    .where('user_id', '=', userId)
    .where('category', '=', 'RUE')
    .execute();
  const rueCodes = rueRows.map((row) => row.ref_code).filter((refCode) => /^\d+$/.test(refCode));

  const uniqueRueRow =
    rueCodes.length === 0
      ? undefined
      : await exec
          .selectFrom('ref_odonymes')
          .select((eb) => eb.fn.countAll().as('total'))
          .where('nb_communes', '=', 1)
          .where('id', 'in', rueCodes)
          .executeTakeFirst();

  const tableauxRow = await exec
    .selectFrom('tableaux')
    .select((eb) => eb.fn.countAll().as('total'))
    .where('user_id', '=', userId)
    .executeTakeFirst();

  const salesRow = await exec
    .selectFrom('market_listings')
    .select((eb) => [eb.fn.countAll().as('total'), eb.fn.sum('price').as('ecus')])
    .where('seller_id', '=', userId)
    .where('status', '=', 'SOLD')
    .executeTakeFirst();

  const purchasesRow = await exec
    .selectFrom('market_listings')
    .select((eb) => [eb.fn.countAll().as('total'), eb.fn.max('price').as('best')])
    .where('buyer_id', '=', userId)
    .where('status', '=', 'SOLD')
    .executeTakeFirst();

  // Seules les amitiés ACCEPTED comptent (Archi §2.9), quel que soit le sens
  // de la demande. Aucune colonne de progression : le compte est recalculé.
  const friendsRow = await exec
    .selectFrom('friendships')
    .select((eb) => eb.fn.countAll().as('total'))
    .where('status', '=', 'ACCEPTED')
    .where((eb) => eb.or([eb('requester_id', '=', userId), eb('addressee_id', '=', userId)]))
    .executeTakeFirst();

  const [tableauScores, consecutiveDays] = await Promise.all([
    loadTableauScores(exec, userId),
    longestStreak(exec, userId),
  ]);

  const bestMultiplier =
    tableauScores.length === 0
      ? 0
      : Math.max(...tableauScores.map((tableau) => tableau.multiplier));
  const bestTableauScore =
    tableauScores.length === 0 ? 0 : Math.max(...tableauScores.map((tableau) => tableau.total));

  return {
    ticketsScratched: toNumber(scratchRow?.total),
    pepitesFound: toNumber(pepiteRow?.total),
    mythiqueFromTicket: toNumber(mythiqueRow?.total),
    cardsOwned: toNumber(cardsRow?.total),
    regionsOwned: toNumber(regionsRow?.total),
    departementsOwned: toNumber(departementsRow?.total),
    raritiesOwned: toNumber(raritiesRow?.total),
    uniqueRue: toNumber(uniqueRueRow?.total),
    tableauxCount: toNumber(tableauxRow?.total),
    bestMultiplierTenths: Math.round(bestMultiplier * 10),
    bestTableauScore,
    salesCount: toNumber(salesRow?.total),
    purchasesCount: toNumber(purchasesRow?.total),
    ecusEarned: toNumber(salesRow?.ecus),
    bestPurchase: toNumber(purchasesRow?.best),
    friendsAccepted: toNumber(friendsRow?.total),
    profileComplete: null,
    consecutiveDays,
  };
}

/** Projection pure du catalogue : aucune lecture, aucune écriture. Les
 *  métriques et les médailles déjà obtenues sont fournies par l'appelant, ce
 *  qui permet à l'évaluation de ne collecter qu'une fois. */
function projectAchievements(
  metrics: AchievementMetrics,
  unlockedAt: ReadonlyMap<string, Date>,
  payoutsEnabled: boolean,
): AchievementsView {
  const payouts = new Map(ACHIEVEMENTS.map((achievement) => [achievement.key, achievement.payout]));

  let total = 0;
  for (const key of unlockedAt.keys()) {
    total += payouts.get(key) ?? 0;
  }

  const achievements: AchievementState[] = ACHIEVEMENTS.map((achievement) => ({
    key: achievement.key,
    family: achievement.family,
    label: achievement.label,
    description: achievement.description,
    payout: achievement.payout,
    threshold: achievement.threshold,
    progress: metrics[achievement.metric],
    earnedAt: unlockedAt.get(achievement.key)?.toISOString() ?? null,
  }));

  return { payoutsEnabled, total, achievements };
}

/** Médailles déjà obtenues, indexées par clé et datées de leur déblocage. */
async function readUnlockedAt(exec: Executor, userId: string): Promise<Map<string, Date>> {
  const rows = await exec
    .selectFrom('user_achievements')
    .select(['achievement_key', 'unlocked_at'])
    .where('user_id', '=', userId)
    .execute();
  return new Map(rows.map((row) => [row.achievement_key, row.unlocked_at] as const));
}

/** État complet du catalogue pour un joueur : une collecte, aucune écriture,
 *  aucun versement. */
export async function loadAchievements(exec: Executor, userId: string): Promise<AchievementsView> {
  const payoutsEnabled = await readPayoutsEnabled(exec);
  const metrics = await collectMetrics(exec, userId);
  const unlockedAt = await readUnlockedAt(exec, userId);
  return projectAchievements(metrics, unlockedAt, payoutsEnabled);
}

/**
 * Évalue les médailles d'un joueur et verse les primes nouvellement acquises,
 * dans une seule transaction. La ligne utilisateur est verrouillée, donc deux
 * évaluations concurrentes se sérialisent ; la clé primaire composite de
 * `user_achievements` rend le versement idempotent.
 */
export async function evaluateAchievements(userId: string): Promise<AchievementsView> {
  return db.transaction().execute(async (trx) => {
    await trx.selectFrom('user').select('id').where('id', '=', userId).forUpdate().execute();

    const payoutsEnabled = await readPayoutsEnabled(trx);
    // Une seule collecte de métriques par évaluation : la série de jours et
    // les compteurs ne sont jamais recalculés, ni pour le versement ni pour la
    // réponse.
    const metrics = await collectMetrics(trx, userId);

    if (!payoutsEnabled) {
      return projectAchievements(metrics, await readUnlockedAt(trx, userId), false);
    }

    const unlockedRows = await trx
      .selectFrom('user_achievements')
      .select('achievement_key')
      .where('user_id', '=', userId)
      .execute();
    const unlocked = new Set(unlockedRows.map((row) => row.achievement_key));

    for (const achievement of newlyEarned(metrics, unlocked)) {
      const inserted = await trx
        .insertInto('user_achievements')
        .values({ user_id: userId, achievement_key: achievement.key })
        .onConflict((oc) => oc.columns(['user_id', 'achievement_key']).doNothing())
        .returning('achievement_key')
        .executeTakeFirst();

      // Une ligne déjà présente (rejeu concurrent) ne paie pas.
      if (!inserted) {
        continue;
      }

      // La médaille est annoncée dans la transaction de son versement : un
      // échec d'écriture annule la prime, jamais l'inverse.
      await emitNotification(trx, {
        userId,
        kind: 'ACHIEVEMENT',
        ref: achievement.key,
        payload: { key: achievement.key, label: achievement.label, payout: achievement.payout },
      });

      await trx
        .insertInto('currency_ledger')
        .values({
          user_id: userId,
          delta: achievement.payout,
          reason: `ACHIEVEMENT:${achievement.key}`,
        })
        .execute();

      // Le marché ne lit que `"user".currency` : la colonne suit le grand-livre
      // dans la même transaction.
      await trx
        .updateTable('user')
        .set({ currency: sql<number>`coalesce(currency, 0) + ${achievement.payout}` })
        .where('id', '=', userId)
        .execute();
    }

    return projectAchievements(metrics, await readUnlockedAt(trx, userId), true);
  });
}
