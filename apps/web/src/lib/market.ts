import type { Category, Rarity } from '@hexamap/shared';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from './api';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class MarketApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'MarketApiError';
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

function throwMarketError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new MarketApiError(info.message, info.code);
}

export const marketListingsQueryKey = ['market', 'listings'] as const;
export const myListingsQueryKey = ['market', 'mine'] as const;

export interface MarketFilters {
  category?: Category;
  rarity?: Rarity;
  limit: number;
  offset: number;
}

export async function fetchMarketListings(filters: MarketFilters) {
  const { data, error } = await api.api.v1.market.listings.get({
    query: {
      limit: filters.limit,
      offset: filters.offset,
      category: filters.category,
      rarity: filters.rarity,
    },
  });
  if (error) throwMarketError(error);
  if (data && typeof data === 'object' && 'items' in data) {
    return data;
  }
  throwMarketError(data);
}

export type MarketListingsResult = NonNullable<Awaited<ReturnType<typeof fetchMarketListings>>>;
export type MarketListing = MarketListingsResult['items'][number];

export function marketListingsQueryOptions(filters: MarketFilters) {
  return queryOptions({
    queryKey: [...marketListingsQueryKey, filters],
    queryFn: () => fetchMarketListings(filters),
    staleTime: 15_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export async function fetchMyListings() {
  const { data, error } = await api.api.v1.market.listings.mine.get({
    query: { limit: 100 },
  });
  if (error) throwMarketError(error);
  if (data && typeof data === 'object' && 'items' in data) {
    return data;
  }
  throwMarketError(data);
}

export const myListingsQueryOptions = queryOptions({
  queryKey: myListingsQueryKey,
  queryFn: fetchMyListings,
  staleTime: 10_000,
  retry: false,
});

export async function buyListing(id: string) {
  const { data, error } = await api.api.v1.market.listings({ id }).buy.post();
  if (error) throwMarketError(error);
  if (data && typeof data === 'object' && 'listing' in data && 'balance' in data) {
    return data;
  }
  throwMarketError(data);
}

export async function cancelListing(id: string) {
  const { data, error } = await api.api.v1.market.listings({ id }).delete();
  if (error) throwMarketError(error);
  if (data && typeof data === 'object' && 'listing' in data) {
    return data;
  }
  throwMarketError(data);
}

export async function createListing(input: { userCardId: string; price: number }) {
  const { data, error } = await api.api.v1.market.listings.post(input);
  if (error) throwMarketError(error);
  if (data && typeof data === 'object' && 'listing' in data) {
    return data;
  }
  throwMarketError(data);
}

export function marketErrorMessage(error: unknown): string {
  if (error instanceof MarketApiError) {
    switch (error.code) {
      case 'INSUFFICIENT_FUNDS':
        return 'Votre solde est insuffisant pour cet achat.';
      case 'CANNOT_BUY_OWN_CARD':
        return 'Vous ne pouvez pas acheter votre propre carte.';
      case 'LISTING_NOT_OPEN':
        return "Cette annonce n'est plus disponible.";
      case 'CARD_LOCKED':
        return 'Cette carte est verrouillée (vente en cours ou tableau).';
      case 'CARD_ALREADY_LISTED':
        return 'Cette carte est déjà en vente.';
      case 'NOT_LISTING_OWNER':
        return "Vous n'êtes pas le vendeur de cette annonce.";
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
