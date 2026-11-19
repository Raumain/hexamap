import { queryOptions } from '@tanstack/react-query';
import { api } from './api';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class CardDetailApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'CardDetailApiError';
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

function throwCardDetailError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new CardDetailApiError(info.message, info.code);
}

export const cardDetailQueryKey = (cardId: string) => ['cards', 'detail', cardId] as const;

export async function fetchCardDetail(cardId: string) {
  const { data, error } = await api.api.v1.cards({ id: cardId }).get();
  if (error) throwCardDetailError(error);
  if (data && typeof data === 'object' && 'card' in data) {
    return data.card;
  }
  throwCardDetailError(data);
}

export type CardDetail = Awaited<ReturnType<typeof fetchCardDetail>>;

export function cardDetailQueryOptions(cardId: string) {
  return queryOptions({
    queryKey: cardDetailQueryKey(cardId),
    queryFn: () => fetchCardDetail(cardId),
    staleTime: 15_000,
    retry: false,
  });
}

export function cardDetailErrorMessage(error: unknown): string {
  if (error instanceof CardDetailApiError) {
    switch (error.code) {
      case 'CARD_NOT_VISIBLE':
        return "Cette planche n'est pas exposée.";
      case 'CARD_NOT_FOUND':
        return 'Cette planche est introuvable.';
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
