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

export async function fetchImportStatus(): Promise<ImportStatus> {
  const { data, error } = await api.api.v1['import-status'].get();
  if (error) {
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
  refetchInterval: 1_000,
  staleTime: 0,
  retry: false,
});
