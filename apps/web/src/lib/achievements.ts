import { queryOptions } from '@tanstack/react-query';
import { api } from './api';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class AchievementsApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'AchievementsApiError';
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

function throwAchievementsError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new AchievementsApiError(info.message, info.code);
}

export const achievementsQueryKey = ['achievements'] as const;

export async function fetchAchievements() {
  const { data, error } = await api.api.v1.achievements.get();
  if (error) throwAchievementsError(error);
  if (data && typeof data === 'object' && 'achievements' in data) {
    return data;
  }
  throwAchievementsError(data);
}

export type AchievementsView = NonNullable<Awaited<ReturnType<typeof fetchAchievements>>>;
export type AchievementView = AchievementsView['achievements'][number];

export function achievementsQueryOptions() {
  return queryOptions({
    queryKey: achievementsQueryKey,
    queryFn: fetchAchievements,
    staleTime: 15_000,
    retry: false,
  });
}

export function achievementsErrorMessage(error: unknown): string {
  if (error instanceof AchievementsApiError) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return 'Votre session a expiré. Reconnectez-vous.';
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
