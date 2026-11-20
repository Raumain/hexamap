import { join } from 'node:path';
import { Elysia, t } from 'elysia';
import { env } from '../env';

interface StatusPayload {
  running: boolean;
  phase: string;
  phaseLabel: string;
  step: number;
  steps: number;
  done: number;
  total: number | null;
  message: string;
  startedAt: string | null;
  updatedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  log: string[];
}

const statusSchema = t.Object({
  running: t.Boolean(),
  phase: t.String(),
  phaseLabel: t.String(),
  step: t.Number(),
  steps: t.Number(),
  done: t.Number(),
  total: t.Union([t.Number(), t.Null()]),
  message: t.String(),
  startedAt: t.Union([t.String(), t.Null()]),
  updatedAt: t.Union([t.String(), t.Null()]),
  finishedAt: t.Union([t.String(), t.Null()]),
  error: t.Union([t.String(), t.Null()]),
  log: t.Array(t.String()),
});

const IDLE_STATUS: StatusPayload = {
  running: false,
  phase: 'idle',
  phaseLabel: 'Aucun import en cours',
  step: 0,
  steps: 0,
  done: 0,
  total: null,
  message: '',
  startedAt: null,
  updatedAt: null,
  finishedAt: null,
  error: null,
  log: [],
};

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Tolère un fichier partiellement écrit ou corrompu : on retombe sur l'état inactif. */
function normalizeStatus(value: unknown): StatusPayload {
  if (typeof value !== 'object' || value === null) return IDLE_STATUS;
  const record = value as Record<string, unknown>;
  const log = Array.isArray(record.log)
    ? record.log.filter((line): line is string => typeof line === 'string')
    : [];

  return {
    running: record.running === true,
    phase: asString(record.phase, IDLE_STATUS.phase),
    phaseLabel: asString(record.phaseLabel, IDLE_STATUS.phaseLabel),
    step: asNumber(record.step, 0),
    steps: asNumber(record.steps, 0),
    done: asNumber(record.done, 0),
    total: asNullableNumber(record.total),
    message: asString(record.message, ''),
    startedAt: asNullableString(record.startedAt),
    updatedAt: asNullableString(record.updatedAt),
    finishedAt: asNullableString(record.finishedAt),
    error: asNullableString(record.error),
    log,
  };
}

// Page de suivi temporaire : outil de développement, lecture seule, montée dans
// le groupe protégé par `authPlugin`. Le journal et `error` peuvent contenir des
// chemins, des DSN et des URL amont : aucune session ouverte, aucune lecture.
export const importStatusRoutes = new Elysia({ name: 'routes.import-status' }).get(
  '/import-status',
  async ({ set }) => {
    set.headers['Cache-Control'] = 'no-store';

    const file = Bun.file(join(env.IMPORT_STATUS_DIR, 'status.json'));
    if (!(await file.exists())) return IDLE_STATUS;

    try {
      return normalizeStatus(JSON.parse(await file.text()));
    } catch {
      return IDLE_STATUS;
    }
  },
  {
    response: {
      200: statusSchema,
    },
  },
);
