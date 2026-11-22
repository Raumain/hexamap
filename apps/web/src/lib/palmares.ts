import type { Category } from '@hexamap/shared';
import { queryOptions } from '@tanstack/react-query';
import { api } from './api';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class PalmaresApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'PalmaresApiError';
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

function throwPalmaresError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new PalmaresApiError(info.message, info.code);
}

export interface PalmaresCard {
  cardId: string;
  category: Category;
  nom: string;
}

/**
 * Une ligne du classement telle que le serveur la rend. `rank` et `score` sont
 * ceux de `tableaux.score`, figé à la soumission : le navigateur ne les recalcule
 * jamais, et n'importe aucune formule de score. `yours` dit si le tableau
 * appartient au joueur courant : seule condition qui rende le Cartel lisible.
 */
export interface PalmaresEntry {
  rank: number;
  tableauId: string;
  name: string;
  score: number;
  createdAt: string;
  yours: boolean;
  player: { id: string; pseudo: string; profilePublic: boolean };
  cards: PalmaresCard[];
}

export interface Palmares {
  week: string;
  weekStart: string;
  weekEnd: string;
  current: boolean;
  total: number;
  items: PalmaresEntry[];
}

export const palmaresQueryKey = ['palmares', 'current'] as const;

export async function fetchPalmares(): Promise<Palmares> {
  const { data, error } = await api.api.v1.palmares.get();
  if (error) throwPalmaresError(error);
  if (data && typeof data === 'object' && 'items' in data) {
    return data;
  }
  throwPalmaresError(data);
}

export const palmaresQueryOptions = queryOptions({
  queryKey: palmaresQueryKey,
  queryFn: fetchPalmares,
  staleTime: 30_000,
  retry: false,
});

export function palmaresErrorMessage(error: unknown): string {
  if (error instanceof PalmaresApiError) {
    switch (error.code) {
      case 'UNAUTHORIZED':
        return 'Votre session a expiré. Reconnectez-vous pour lire le classement.';
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
