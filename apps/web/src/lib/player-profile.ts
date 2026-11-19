import { queryOptions } from '@tanstack/react-query';
import { api } from './api';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class PlayerProfileApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'PlayerProfileApiError';
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

function throwPlayerProfileError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new PlayerProfileApiError(info.message, info.code);
}

export const playerProfileQueryKey = (playerId: string) => ['players', 'detail', playerId] as const;

export async function fetchPlayerProfile(playerId: string) {
  const { data, error } = await api.api.v1.players({ id: playerId }).get();
  if (error) throwPlayerProfileError(error);
  if (data && typeof data === 'object' && 'player' in data) {
    return data.player;
  }
  throwPlayerProfileError(data);
}

export type PlayerProfile = Awaited<ReturnType<typeof fetchPlayerProfile>>;

export function playerProfileQueryOptions(playerId: string) {
  return queryOptions({
    queryKey: playerProfileQueryKey(playerId),
    queryFn: () => fetchPlayerProfile(playerId),
    staleTime: 15_000,
    retry: false,
  });
}

// Une vitrine privée, un compte bloqué et un compte inconnu partagent le même
// 404 : un 403 confirmerait l'existence du compte (`.docs/01-architecture.md` §2.9).
export function playerProfileErrorMessage(error: unknown): string {
  if (error instanceof PlayerProfileApiError && error.code === 'PLAYER_NOT_FOUND') {
    return "Cette vitrine n'est pas publique.";
  }
  return FALLBACK_MESSAGE;
}
