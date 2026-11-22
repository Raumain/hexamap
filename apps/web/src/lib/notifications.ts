import { infiniteQueryOptions, queryOptions } from '@tanstack/react-query';
import { api } from './api';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

/** Taille de page demandée au serveur ; le curseur porte la suite. */
export const NOTIFICATIONS_PAGE_SIZE = 30;

export class NotificationsApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'NotificationsApiError';
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

function throwNotificationsError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new NotificationsApiError(info.message, info.code);
}

export const notificationsQueryKey = ['notifications'] as const;
export const unreadQueryKey = ['notifications', 'unread'] as const;

export async function fetchNotifications(input: { limit?: number; cursor?: string | null }) {
  const limit = input.limit ?? NOTIFICATIONS_PAGE_SIZE;
  const cursor = input.cursor ?? null;

  // Le curseur absent ne s'envoie pas : `?cursor=` vide serait un curseur invalide.
  const { data, error } = await api.api.v1.notifications.get({
    query: cursor ? { limit, cursor } : { limit },
  });
  if (error) throwNotificationsError(error);
  if (data && typeof data === 'object' && 'items' in data) {
    return data;
  }
  throwNotificationsError(data);
}

export type NotificationsPage = NonNullable<Awaited<ReturnType<typeof fetchNotifications>>>;
export type NotificationItem = NotificationsPage['items'][number];

export async function fetchUnreadCount() {
  const { data, error } = await api.api.v1.notifications['unread-count'].get();
  if (error) throwNotificationsError(error);
  if (data && typeof data === 'object' && 'unread' in data) {
    return data;
  }
  throwNotificationsError(data);
}

export type UnreadCount = NonNullable<Awaited<ReturnType<typeof fetchUnreadCount>>>;

export async function markRead(id: string) {
  const { data, error } = await api.api.v1.notifications({ id }).read.post();
  if (error) throwNotificationsError(error);
  if (data && typeof data === 'object' && 'item' in data) {
    return data;
  }
  throwNotificationsError(data);
}

export async function markAllRead() {
  const { data, error } = await api.api.v1.notifications['read-all'].post();
  if (error) throwNotificationsError(error);
  if (data && typeof data === 'object' && 'marked' in data) {
    return data;
  }
  throwNotificationsError(data);
}

/**
 * La salle et la cloche lisent le même compteur serveur : aucun décrément local
 * n'est possible. Toute mutation de lecture invalide les deux clés.
 */
export const notificationsInfiniteQueryOptions = infiniteQueryOptions({
  queryKey: notificationsQueryKey,
  queryFn: ({ pageParam }) => fetchNotifications({ cursor: pageParam }),
  initialPageParam: null as string | null,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  staleTime: 30_000,
  refetchInterval: 60_000,
  refetchOnWindowFocus: true,
  retry: false,
});

export const unreadCountQueryOptions = queryOptions({
  queryKey: unreadQueryKey,
  queryFn: fetchUnreadCount,
  staleTime: 15_000,
  refetchInterval: 60_000,
  refetchOnWindowFocus: true,
  retry: false,
});

export function notificationsErrorMessage(error: unknown): string {
  if (error instanceof NotificationsApiError) {
    switch (error.code) {
      case 'NOTIFICATION_CURSOR_INVALID':
        return 'La suite de la liste n’a pas pu être chargée. Rechargez la salle.';
      case 'NOTIFICATION_NOT_FOUND':
        return 'Cette notification n’existe plus.';
      case 'NOTIFICATION_KIND_UNKNOWN':
        return 'Ce type de notification est inconnu.';
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
