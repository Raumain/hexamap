import { queryOptions } from '@tanstack/react-query';
import { api } from './api';
import { isApiErrorValue } from './tickets';

export const collectionQueryKey = ['collection', 'cards'] as const;
export const COLLECTION_CARD_LIMIT = 5000;

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class CollectionApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'CollectionApiError';
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

function throwCollectionError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new CollectionApiError(info.message, info.code);
}

export async function fetchCollectionCards() {
  const { data, error } = await api.api.v1.cards.get({
    query: { limit: COLLECTION_CARD_LIMIT },
  });
  if (error) throwCollectionError(error);
  if (data && typeof data === 'object' && 'items' in data) {
    return { items: data.items, total: data.total };
  }
  throwCollectionError(data);
}

export type CollectionCardsResult = NonNullable<Awaited<ReturnType<typeof fetchCollectionCards>>>;
export type CollectionCard = CollectionCardsResult['items'][number];

export const collectionQueryOptions = queryOptions({
  queryKey: collectionQueryKey,
  queryFn: fetchCollectionCards,
  staleTime: 30_000,
  retry: false,
});

export function collectionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
