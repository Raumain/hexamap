import { queryOptions } from '@tanstack/react-query';
import { api } from './api';

export interface ImportStatus {
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

export const importStatusQueryKey = ['import-status'] as const;

/** La salle est réservée aux sessions ouvertes ; un 401/403 n'est pas une panne. */
export class ImportStatusAccessError extends Error {
  constructor() {
    super('Accès réservé.');
    this.name = 'ImportStatusAccessError';
  }
}

/** Eden type les erreurs d'une route sur son schéma de réponse : le refus du
 * groupe protégé se lit donc dans le corps, pas dans le code HTTP typé. */
function isAccessError(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false;
  const code = (value as Record<string, unknown>).code;
  return code === 'UNAUTHORIZED' || code === 'FORBIDDEN';
}

export async function fetchImportStatus(): Promise<ImportStatus> {
  const { data, error } = await api.api.v1['import-status'].get();
  if (error) {
    if (isAccessError(error.value)) {
      throw new ImportStatusAccessError();
    }
    throw new Error(`Statut d'import indisponible (HTTP ${error.status})`);
  }
  if (data === null || typeof data !== 'object') {
    throw new Error("Réponse du suivi d'import invalide");
  }
  return data;
}

export const importStatusQueryOptions = queryOptions({
  queryKey: importStatusQueryKey,
  queryFn: fetchImportStatus,
  // Une session refusée ne se répare pas en réessayant : le sondage s'arrête.
  refetchInterval: (query) =>
    query.state.error instanceof ImportStatusAccessError ? false : 1_000,
  staleTime: 0,
  retry: false,
});
