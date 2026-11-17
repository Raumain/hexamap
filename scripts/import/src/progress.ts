import { mkdir, rename } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_STATUS_DIR = '/data/import-status';
const WRITE_INTERVAL_MS = 250;
const MAX_LOG_LINES = 12;
const MAX_LOG_LENGTH = 400;
const MAX_ERROR_LENGTH = 800;

export interface ImportProgress {
  running: boolean;
  phase: string;
  phaseLabel: string;
  step: number;
  steps: number;
  done: number;
  total: number | null;
  message: string;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  error: string | null;
  log: string[];
}

export interface ImportProgressWriter {
  begin(phase: string, phaseLabel: string, total: number | null): void;
  set(done: number, message?: string): void;
  advance(n?: number): void;
  log(line: string): void;
  fail(error: unknown): void;
  finish(message?: string): void;
}

function nowIso(): string {
  return new Date().toISOString();
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'Erreur inconnue';
}

function pushLog(target: ImportProgress, line: string): void {
  const trimmed = line.trim().slice(0, MAX_LOG_LENGTH);
  if (trimmed === '') return;
  target.log.push(trimmed);
  if (target.log.length > MAX_LOG_LINES) {
    target.log.splice(0, target.log.length - MAX_LOG_LINES);
  }
}

/**
 * Écrivain du fichier d'état partagé entre le pipeline d'import (conteneur
 * `dev`) et l'API (conteneur `api`). Les écritures sont atomiques (fichier
 * temporaire puis `rename`) et limitées en fréquence. Aucune erreur d'écriture
 * ne remonte : un statut manquant ne doit jamais interrompre l'import.
 */
export function createProgress(totalSteps = 0): ImportProgressWriter {
  const dir = process.env.IMPORT_STATUS_DIR?.trim() || DEFAULT_STATUS_DIR;
  const target = join(dir, 'status.json');
  const temporary = join(dir, 'status.json.tmp');
  const startedAt = nowIso();

  const state: ImportProgress = {
    running: true,
    phase: 'idle',
    phaseLabel: 'Démarrage',
    step: 0,
    steps: totalSteps,
    done: 0,
    total: null,
    message: '',
    startedAt,
    updatedAt: startedAt,
    finishedAt: null,
    error: null,
    log: [],
  };

  let lastWriteAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let queue: Promise<void> = Promise.resolve();

  function persist(): void {
    const snapshot: ImportProgress = { ...state, log: [...state.log] };
    const payload = `${JSON.stringify(snapshot)}\n`;
    queue = queue
      .then(async () => {
        await mkdir(dir, { recursive: true });
        await Bun.write(temporary, payload);
        await rename(temporary, target);
      })
      .catch(() => {});
  }

  function flush(): void {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    lastWriteAt = Date.now();
    state.updatedAt = nowIso();
    persist();
  }

  function schedule(): void {
    const elapsed = Date.now() - lastWriteAt;
    if (elapsed >= WRITE_INTERVAL_MS) {
      flush();
      return;
    }
    if (timer === null) {
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, WRITE_INTERVAL_MS - elapsed);
    }
  }

  return {
    begin(phase, phaseLabel, total) {
      const nextStep = state.step + 1;
      // `step` ne recule jamais et ne dépasse jamais le nombre d'étapes annoncé.
      state.step = state.steps > 0 ? Math.min(state.steps, nextStep) : nextStep;
      state.steps = state.steps > 0 ? state.steps : Math.max(state.steps, state.step);
      state.phase = phase;
      state.phaseLabel = phaseLabel;
      state.total = total;
      state.done = 0;
      state.message = phaseLabel;
      state.running = true;
      state.error = null;
      state.finishedAt = null;
      flush();
    },
    set(done, message) {
      state.done = Math.max(0, Math.trunc(done));
      if (message !== undefined) state.message = message;
      schedule();
    },
    advance(n = 1) {
      state.done = Math.max(0, state.done + Math.trunc(n));
      schedule();
    },
    log(line) {
      pushLog(state, line);
      flush();
    },
    fail(error) {
      state.running = false;
      state.error = errorMessage(error).slice(0, MAX_ERROR_LENGTH);
      state.finishedAt = nowIso();
      state.message = state.message === '' ? "Échec de l'import" : state.message;
      pushLog(state, `Échec : ${state.error}`);
      flush();
    },
    finish(message) {
      state.running = false;
      if (message !== undefined) state.message = message;
      state.finishedAt = nowIso();
      state.error = null;
      flush();
    },
  };
}
