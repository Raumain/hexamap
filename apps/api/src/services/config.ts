import { HttpError } from '../lib/http-error';
import type { Executor } from './draw';

export interface ScratchConfig {
  cap: number;
  regenMs: number;
  startCharges: number;
}

/**
 * Les trois clés du carnet, et elles seules : la disponibilité des charges ne
 * doit pas dépendre d'une clé des phases 27 à 29 (amis, médailles).
 */
const SCRATCH_KEYS = ['SCRATCH_CHARGE_CAP', 'SCRATCH_REGEN_MS', 'SCRATCH_START_CHARGES'];

function configMissing(): HttpError {
  return new HttpError(503, 'GAME_CONFIG_MISSING', 'Configuration de jeu incomplète.');
}

function requireNumber(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw configMissing();
  }
  return value;
}

/** Lit la configuration du carnet. Aucune valeur par défaut, aucun cache. */
export async function readScratchConfig(exec: Executor): Promise<ScratchConfig> {
  const rows = await exec
    .selectFrom('game_config')
    .select(['key', 'value'])
    .where('key', 'in', SCRATCH_KEYS)
    .execute();

  const values = new Map(rows.map((row) => [row.key, row.value]));

  return {
    cap: requireNumber(values.get('SCRATCH_CHARGE_CAP')),
    regenMs: requireNumber(values.get('SCRATCH_REGEN_MS')),
    startCharges: requireNumber(values.get('SCRATCH_START_CHARGES')),
  };
}

export interface ShopConfig {
  dailyPurchaseCap: number;
}

/** Lit le plafond quotidien d'écus. Aucune valeur par défaut, aucun cache. */
export async function readShopConfig(exec: Executor): Promise<ShopConfig> {
  const row = await exec
    .selectFrom('game_config')
    .select(['key', 'value'])
    .where('key', '=', 'SHOP_DAILY_PURCHASE_CAP')
    .executeTakeFirst();

  return { dailyPurchaseCap: requireNumber(row?.value) };
}
