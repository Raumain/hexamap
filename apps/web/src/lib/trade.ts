import { queryOptions } from '@tanstack/react-query';
import { api } from './api';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class TradeApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'TradeApiError';
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

function throwTradeError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new TradeApiError(info.message, info.code);
}

export type TradeBox = 'received' | 'sent';

export const tradeOffersQueryKey = (box: TradeBox) => ['trades', box] as const;

export async function fetchTradeOffers(box: TradeBox) {
  const { data, error } = await api.api.v1.trades.get({ query: { box } });
  if (error) throwTradeError(error);
  if (data && typeof data === 'object' && 'offers' in data) {
    return data.offers;
  }
  throwTradeError(data);
}

export type TradeOffers = NonNullable<Awaited<ReturnType<typeof fetchTradeOffers>>>;
export type TradeOffer = TradeOffers[number];

export function tradeOffersQueryOptions(box: TradeBox) {
  return queryOptions({
    queryKey: tradeOffersQueryKey(box),
    queryFn: () => fetchTradeOffers(box),
    staleTime: 10_000,
    retry: false,
  });
}

export async function proposeTrade(input: { offeredCardId: string; requestedCardId: string }) {
  const { data, error } = await api.api.v1.trades.post(input);
  if (error) throwTradeError(error);
  if (data && typeof data === 'object' && 'offer' in data) return data.offer;
  throwTradeError(data);
}

export const friendTradeCardsQueryKey = (friendId: string) =>
  ['trades', 'friends', friendId, 'cards'] as const;

export async function fetchFriendTradeCards(friendId: string) {
  const { data, error } = await api.api.v1.trades.friends({ friendId }).cards.get();
  if (error) throwTradeError(error);
  if (data && typeof data === 'object' && 'cards' in data) return data.cards;
  throwTradeError(data);
}

export type FriendTradeCards = NonNullable<Awaited<ReturnType<typeof fetchFriendTradeCards>>>;

export function friendTradeCardsQueryOptions(friendId: string) {
  return queryOptions({
    queryKey: friendTradeCardsQueryKey(friendId),
    queryFn: () => fetchFriendTradeCards(friendId),
    staleTime: 10_000,
    retry: false,
  });
}

export async function acceptTrade(offerId: string) {
  const { data, error } = await api.api.v1.trades({ id: offerId }).accept.post();
  if (error) throwTradeError(error);
  if (data && typeof data === 'object' && 'offer' in data) return data.offer;
  throwTradeError(data);
}

export async function declineTrade(offerId: string) {
  const { data, error } = await api.api.v1.trades({ id: offerId }).decline.post();
  if (error) throwTradeError(error);
  if (data && typeof data === 'object' && 'offer' in data) return data.offer;
  throwTradeError(data);
}

export async function cancelTrade(offerId: string) {
  const { data, error } = await api.api.v1.trades({ id: offerId }).cancel.post();
  if (error) throwTradeError(error);
  if (data && typeof data === 'object' && 'offer' in data) return data.offer;
  throwTradeError(data);
}

export function tradeErrorMessage(error: unknown): string {
  if (error instanceof TradeApiError) {
    switch (error.code) {
      case 'TRADE_SELF_OFFER':
        return 'Choisissez une autre carte : celle-ci ne peut pas être échangée contre elle-même.';
      case 'CARD_NOT_OWNED':
        return 'Cette carte ne vous appartient pas.';
      case 'CARD_LOCKED':
        return 'Une des deux cartes est en vente : retirez-la du Comptoir avant de l’échanger.';
      case 'CARD_ALREADY_IN_TRADE':
        return 'Une des deux cartes est déjà engagée dans une offre d’échange.';
      case 'CARD_IN_TRADE':
        return 'Cette carte est engagée dans un troc : annulez l’offre avant de la mettre en vente.';
      case 'TRADE_OFFER_NOT_FOUND':
        return 'Cette offre est introuvable.';
      case 'TRADE_OFFER_NOT_PENDING':
        return 'Cette offre n’est plus en attente : elle a déjà été traitée.';
      case 'TRADE_OFFER_EXPIRED':
        return 'Cette offre a expiré.';
      case 'TRADE_CARD_MOVED':
        return 'Une des cartes a changé de main depuis la proposition.';
      case 'NOT_TRADE_RECEIVER':
        return 'Cette offre ne vous est pas adressée.';
      case 'NOT_TRADE_PROPOSER':
        return 'Seul l’auteur de l’offre peut l’annuler.';
      case 'FRIEND_REQUIRED':
        return 'Seule une amitié acceptée ouvre la collection d’un autre joueur.';
      case 'FRIEND_SELF':
        return 'Votre propre collection se lit au Cadastre.';
      case 'USER_NOT_FOUND':
        return 'Ce joueur est introuvable.';
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}
