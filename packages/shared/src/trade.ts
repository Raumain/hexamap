/**
 * Le troc — contrat partagé, sans dépendance, sans entrée-sortie.
 *
 * Une offre échange **une** carte contre **une** carte : aucune monnaie, aucun
 * lot, aucun prix. Ce module ne porte que les règles que le serveur et le
 * navigateur doivent lire de la même façon : les cinq statuts, les transitions
 * autorisées et la durée de vie d'une offre.
 */

export const TRADE_STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'] as const;

export type TradeStatus = (typeof TRADE_STATUSES)[number];

/** Le seul état ouvert : une carte n'est engagée que tant que l'offre l'est. */
export const TRADE_OPEN_STATUS = 'PENDING' as const satisfies TradeStatus;

/**
 * Sept jours. Un troc est une conversation, pas une enchère : trop court, il
 * n'a pas le temps d'être lu ; trop long, il immobilise une carte un mois.
 */
export const TRADE_OFFER_TTL_DAYS = 7;
export const TRADE_OFFER_TTL_MS = TRADE_OFFER_TTL_DAYS * 24 * 60 * 60 * 1000;

export class TradeStatusError extends Error {
  constructor(readonly value: unknown) {
    super(`Statut d'échange inconnu : ${String(value)}`);
    this.name = 'TradeStatusError';
  }
}

export function isTradeStatus(value: unknown): value is TradeStatus {
  return typeof value === 'string' && (TRADE_STATUSES as readonly string[]).includes(value);
}

export function assertTradeStatus(value: unknown): asserts value is TradeStatus {
  if (!isTradeStatus(value)) throw new TradeStatusError(value);
}

export function isOpenTrade(status: TradeStatus): boolean {
  return status === TRADE_OPEN_STATUS;
}

/**
 * Transitions admises. Un statut terminal ne se rouvre jamais : une offre
 * acceptée, refusée, annulée ou expirée reste dans son état, et une nouvelle
 * proposition est une nouvelle ligne.
 */
const ALLOWED_TRANSITIONS: Record<TradeStatus, readonly TradeStatus[]> = {
  PENDING: ['ACCEPTED', 'DECLINED', 'CANCELLED', 'EXPIRED'],
  ACCEPTED: [],
  DECLINED: [],
  CANCELLED: [],
  EXPIRED: [],
};

export function canTransitionTrade(from: TradeStatus, to: TradeStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Instant d'expiration d'une offre proposée à `from`, sans dérive d'horloge. */
export function tradeExpiresAt(from: Date): Date {
  return new Date(from.getTime() + TRADE_OFFER_TTL_MS);
}
