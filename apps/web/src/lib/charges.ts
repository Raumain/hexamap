import { queryOptions } from '@tanstack/react-query';
import { api } from './api';

export const chargesQueryKey = ['charges'] as const;

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

function isApiErrorValue(value: unknown): value is { code: string; message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

export class ChargesApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'ChargesApiError';
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

function throwChargesError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new ChargesApiError(info.message, info.code);
}

export async function fetchCharges() {
  const { data, error } = await api.api.v1.charges.get();
  if (error) throwChargesError(error);
  if (data) return data;
  throwChargesError(data);
}

/**
 * Une seule lecture par montage du Relevé, resynchronisée par la mutation.
 * Aucun intervalle de rafraîchissement : le compte à rebours est local, le solde ne se sonde pas.
 */
export const chargesQueryOptions = queryOptions({
  queryKey: chargesQueryKey,
  queryFn: fetchCharges,
  staleTime: 0,
  retry: false,
});

export type Charges = Awaited<ReturnType<typeof fetchCharges>>;

export function chargesErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
