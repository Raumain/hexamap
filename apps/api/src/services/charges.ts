import { type ChargeBalance, type ChargeRules, regenerateCharges } from '@hexamap/shared';
import { Kysely } from 'kysely';
import { HttpError } from '../lib/http-error';
import { readScratchConfig, type ScratchConfig } from './config';
import type { Executor } from './draw';

export interface ChargeSnapshot {
  charges: number;
  cap: number;
  nextChargeAt: Date | null;
  regenMs: number;
}

interface DerivedLedger {
  config: ScratchConfig;
  storedCharges: number;
  storedLastRegenAt: number;
  balance: ChargeBalance;
}

function noChargeLeft(): HttpError {
  return new HttpError(
    409,
    'NO_CHARGE_LEFT',
    'Aucune charge disponible : votre prochaine charge arrive bientôt.',
  );
}

function rulesOf(config: ScratchConfig): ChargeRules {
  return { cap: config.cap, regenMs: config.regenMs };
}

/** Convertit un solde pur en instant `Date` : seule frontière `number` ↔ `Date` du service. */
function snapshot(config: ScratchConfig, balance: ChargeBalance): ChargeSnapshot {
  return {
    charges: balance.charges,
    cap: config.cap,
    nextChargeAt: balance.nextChargeAt === null ? null : new Date(balance.nextChargeAt),
    regenMs: config.regenMs,
  };
}

/**
 * Crée la ligne du carnet si elle manque, puis la verrouille. La ligne est
 * paresseuse : l'inscription ne crée rien, la première lecture s'en charge.
 */
async function lockLedger(exec: Executor, userId: string, now: Date): Promise<DerivedLedger> {
  const config = await readScratchConfig(exec);

  await exec
    .insertInto('user_scratch_charges')
    .values({
      user_id: userId,
      charges: Math.min(config.startCharges, config.cap),
      last_regen_at: now,
    })
    .onConflict((oc) => oc.column('user_id').doNothing())
    .execute();

  const row = await exec
    .selectFrom('user_scratch_charges')
    .select(['charges', 'last_regen_at'])
    .where('user_id', '=', userId)
    .forUpdate()
    .executeTakeFirstOrThrow();

  const storedLastRegenAt = row.last_regen_at.getTime();
  const balance = regenerateCharges(
    { charges: row.charges, lastRegenAt: storedLastRegenAt },
    rulesOf(config),
    now.getTime(),
  );

  return { config, storedCharges: row.charges, storedLastRegenAt, balance };
}

async function persistLedger(
  exec: Executor,
  userId: string,
  charges: number,
  lastRegenAt: number,
): Promise<void> {
  await exec
    .updateTable('user_scratch_charges')
    .set({ charges, last_regen_at: new Date(lastRegenAt) })
    .where('user_id', '=', userId)
    .execute();
}

async function readInside(exec: Executor, userId: string, now: Date): Promise<ChargeSnapshot> {
  const derived = await lockLedger(exec, userId, now);
  const { balance } = derived;

  // Au plafond l'état dérivé diffère à chaque lecture : c'est le figeage.
  if (
    balance.charges !== derived.storedCharges ||
    balance.lastRegenAt !== derived.storedLastRegenAt
  ) {
    await persistLedger(exec, userId, balance.charges, balance.lastRegenAt);
  }

  return snapshot(derived.config, balance);
}

/** Lit le carnet. Ouvre sa propre transaction quand on lui passe l'instance Kysely. */
export async function readCharges(
  exec: Executor,
  userId: string,
  now: Date = new Date(),
): Promise<ChargeSnapshot> {
  if (exec instanceof Kysely) {
    return exec.transaction().execute((trx) => readInside(trx, userId, now));
  }
  return readInside(exec, userId, now);
}

/**
 * Dépense une charge sous le verrou de la ligne. À appeler **dans** la
 * transaction de la génération : un refus ultérieur annule la dépense.
 */
export async function consumeCharge(
  exec: Executor,
  userId: string,
  now: Date = new Date(),
): Promise<ChargeSnapshot> {
  const derived = await lockLedger(exec, userId, now);

  if (derived.balance.charges <= 0) {
    throw noChargeLeft();
  }

  // Redériver depuis le solde diminué arme le compte à rebours après une
  // dépense depuis le plafond, où le figeage avait rendu `nextChargeAt` nul.
  const spent = regenerateCharges(
    { charges: derived.balance.charges - 1, lastRegenAt: derived.balance.lastRegenAt },
    rulesOf(derived.config),
    now.getTime(),
  );

  await persistLedger(exec, userId, spent.charges, spent.lastRegenAt);

  return snapshot(derived.config, spent);
}
