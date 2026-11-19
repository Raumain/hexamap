import { queryOptions } from '@tanstack/react-query';
import { api } from './api';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class FriendsApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'FriendsApiError';
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

function throwFriendsError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new FriendsApiError(info.message, info.code);
}

export const friendsQueryKey = ['friends'] as const;

export async function fetchFriends() {
  const { data, error } = await api.api.v1.friends.get();
  if (error) throwFriendsError(error);
  if (data && typeof data === 'object' && 'friends' in data) {
    return data;
  }
  throwFriendsError(data);
}

export type FriendsResult = NonNullable<Awaited<ReturnType<typeof fetchFriends>>>;
export type FriendEntry = FriendsResult['friends'][number];
export type FriendRequestStatus = FriendEntry['status'];

export interface SentRequest {
  readonly status: FriendRequestStatus;
}

export const friendsQueryOptions = queryOptions({
  queryKey: friendsQueryKey,
  queryFn: fetchFriends,
  staleTime: 10_000,
  retry: false,
});

export async function sendRequest(pseudo: string): Promise<SentRequest> {
  const { data, error } = await api.api.v1.friends.requests.post({ pseudo });
  if (error) throwFriendsError(error);
  if (data && typeof data === 'object' && 'request' in data) {
    // 201 quand la demande est créée, 200 quand une demande croisée est absorbée
    // en acceptation mutuelle : le statut renvoyé pilote le message affiché.
    return { status: data.request.status };
  }
  throwFriendsError(data);
}

export async function acceptRequest(id: string) {
  const { data, error } = await api.api.v1.friends.requests({ id }).accept.post();
  if (error) throwFriendsError(error);
  if (data && typeof data === 'object' && 'request' in data) {
    return data;
  }
  throwFriendsError(data);
}

export async function declineRequest(id: string) {
  const { data, error } = await api.api.v1.friends.requests({ id }).decline.post();
  if (error) throwFriendsError(error);
  if (data && typeof data === 'object' && 'request' in data) {
    return data;
  }
  throwFriendsError(data);
}

export async function removeFriend(id: string) {
  const { data, error } = await api.api.v1.friends({ id }).delete();
  if (error) throwFriendsError(error);
  if (data && typeof data === 'object' && 'removed' in data) {
    return data;
  }
  throwFriendsError(data);
}

export async function blockPlayer(userId: string) {
  const { data, error } = await api.api.v1.blocks.post({ userId });
  if (error) throwFriendsError(error);
  if (data && typeof data === 'object' && 'blocked' in data) {
    return data;
  }
  throwFriendsError(data);
}

export function friendsErrorMessage(error: unknown): string {
  if (error instanceof FriendsApiError) {
    switch (error.code) {
      case 'SELF_FRIENDSHIP':
        return 'Vous ne pouvez pas vous ajouter vous-même.';
      case 'PLAYER_NOT_FOUND':
        return 'Aucun joueur ne porte ce pseudo.';
      case 'FRIENDSHIP_EXISTS':
        return 'Vous êtes déjà amis avec ce joueur.';
      case 'FRIENDSHIP_BLOCKED':
        return 'Cette relation est indisponible.';
      case 'FRIEND_REQUEST_REOPEN_TOO_SOON':
        return 'Cette demande a été déclinée récemment. Réessayez plus tard.';
      case 'FRIEND_REQUEST_CAP_REACHED':
        return 'Vous avez atteint le nombre de demandes du jour.';
      case 'FRIENDSHIP_NOT_FOUND':
        return 'Aucune relation avec ce joueur.';
      case 'FRIENDSHIP_DECLINED':
        return 'Cette demande a été refusée.';
      case 'FRIEND_REQUEST_NOT_CANCELLABLE':
        return 'Une demande reçue se refuse, elle ne s’annule pas.';
      case 'SELF_BLOCK':
        return 'Vous ne pouvez pas vous bloquer vous-même.';
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
