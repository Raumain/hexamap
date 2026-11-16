import { queryOptions } from '@tanstack/react-query';
import { api } from './api';

export const ticketQueryKey = ['tickets', 'current'] as const;
export const collectionStatsQueryKey = ['collection', 'stats'] as const;

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export function isApiErrorValue(value: unknown): value is { code: string; message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

export class TicketApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'TicketApiError';
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

function throwTicketError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new TicketApiError(info.message, info.code);
}

export async function fetchCurrentTicket() {
  const { data, error } = await api.api.v1.tickets.current.get();
  if (error) {
    if (error.status === 404) return null;
    throwTicketError(error);
  }
  if (data && typeof data === 'object' && 'ticket' in data) return data.ticket;
  throwTicketError(data);
}

export async function createTicket() {
  const { data, error } = await api.api.v1.tickets.post();
  if (error) throwTicketError(error);
  if (data && typeof data === 'object' && 'ticket' in data) return data.ticket;
  throwTicketError(data);
}

export async function scratchTicketCell(ticketId: string, cellIndex: number) {
  const { data, error } = await api.api.v1.tickets({ id: ticketId }).scratch.post({ cellIndex });
  if (error) throwTicketError(error);
  if (data && typeof data === 'object' && 'ticket' in data) return data;
  throwTicketError(data);
}

export const currentTicketQueryOptions = queryOptions({
  queryKey: ticketQueryKey,
  queryFn: fetchCurrentTicket,
  staleTime: 15_000,
  retry: false,
});

export type Ticket = NonNullable<Awaited<ReturnType<typeof fetchCurrentTicket>>>;
export type TicketCell = Ticket['cells'][number];
export type ScratchResult = Awaited<ReturnType<typeof scratchTicketCell>>;

export function ticketErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
