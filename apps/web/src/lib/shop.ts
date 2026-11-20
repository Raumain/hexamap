import type { PackKey } from '@hexamap/shared';
import { queryOptions } from '@tanstack/react-query';
import { BOUTIQUE } from '../content/boutique';
import { api } from './api';
import { isApiErrorValue } from './tickets';

export class ShopApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'ShopApiError';
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
  return { code: null, message: BOUTIQUE.errors.fallback };
}

function throwShopError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new ShopApiError(info.message, info.code);
}

export const shopOrderQueryKey = (id: string) => ['shop', 'order', id] as const;

export async function fetchShopOrder(id: string) {
  const { data, error } = await api.api.v1.shop.orders({ id }).get();
  if (error) throwShopError(error);
  if (data && typeof data === 'object' && 'status' in data) {
    return data;
  }
  throwShopError(data);
}

export type ShopOrder = NonNullable<Awaited<ReturnType<typeof fetchShopOrder>>>;

export function shopOrderQueryOptions(id: string) {
  return queryOptions({
    queryKey: shopOrderQueryKey(id),
    queryFn: () => fetchShopOrder(id),
    staleTime: 0,
    retry: false,
  });
}

export async function createCheckout(packKey: PackKey) {
  // Le serveur décide du prix : le corps ne porte que la clé du catalogue.
  const { data, error } = await api.api.v1.shop.checkout.post({ packKey });
  if (error) throwShopError(error);
  if (data && typeof data === 'object' && 'url' in data && typeof data.url === 'string') {
    return { url: data.url };
  }
  throwShopError(data);
}

export function checkoutErrorMessage(error: unknown): string {
  if (error instanceof ShopApiError) {
    switch (error.code) {
      case 'SHOP_DISABLED':
        return BOUTIQUE.errors.SHOP_DISABLED;
      case 'SHOP_DAILY_CAP_REACHED':
        return BOUTIQUE.errors.SHOP_DAILY_CAP_REACHED;
      case 'UNKNOWN_PACK':
        return BOUTIQUE.errors.UNKNOWN_PACK;
      case 'UNAUTHORIZED':
        return BOUTIQUE.errors.UNAUTHORIZED;
      case 'ORDER_NOT_FOUND':
        return BOUTIQUE.errors.ORDER_NOT_FOUND;
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : BOUTIQUE.errors.fallback;
}
