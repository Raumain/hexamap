import type { AtlasDepartementDetail, AtlasSummary } from '@hexamap/shared';
import { queryOptions } from '@tanstack/react-query';
import { api } from './api';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class AtlasApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'AtlasApiError';
    this.code = code;
  }
}

function toApiErrorInfo(value: unknown): { code: string | null; message: string } {
  // Eden renvoie `error` sous la forme `{ status, value }` ; l'extraction suit.
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const body = value.value;
    if (isApiErrorValue(body)) {
      return { code: body.code, message: body.message };
    }
  }
  if (isApiErrorValue(value)) {
    return { code: value.code, message: value.message };
  }
  return { code: null, message: FALLBACK_MESSAGE };
}

function throwAtlasError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new AtlasApiError(info.message, info.code);
}

export const atlasSummaryQueryKey = ['atlas', 'summary'] as const;

export const atlasDepartementQueryKey = (code: string) => ['atlas', 'departement', code] as const;

export async function fetchAtlasSummary(): Promise<AtlasSummary> {
  const { data, error } = await api.api.v1.atlas.summary.get();
  if (error) throwAtlasError(error);
  if (data && typeof data === 'object' && 'regions' in data && 'departements' in data) {
    return data;
  }
  throwAtlasError(data);
}

export async function fetchAtlasDepartement(code: string): Promise<AtlasDepartementDetail> {
  const { data, error } = await api.api.v1.atlas.departements({ code }).get();
  if (error) throwAtlasError(error);
  if (data && typeof data === 'object' && 'communes' in data) {
    return data;
  }
  throwAtlasError(data);
}

export function atlasSummaryQueryOptions() {
  return queryOptions({
    queryKey: atlasSummaryQueryKey,
    queryFn: fetchAtlasSummary,
    staleTime: 60_000,
    retry: false,
  });
}

export function atlasDepartementQueryOptions(code: string) {
  return queryOptions({
    queryKey: atlasDepartementQueryKey(code),
    queryFn: () => fetchAtlasDepartement(code),
    staleTime: 60_000,
    retry: false,
  });
}

export function atlasErrorMessage(error: unknown): string {
  if (error instanceof AtlasApiError) {
    if (error.code === 'UNAUTHORIZED') {
      return 'Votre session a expiré. Reconnectez-vous.';
    }
    if (error.code === 'DEPARTEMENT_NOT_FOUND') {
      return 'Ce département est introuvable ou hors de la carte.';
    }
  }
  return FALLBACK_MESSAGE;
}
