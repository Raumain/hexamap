/**
 * Domaine des notifications du Guichet (`.docs/02-database.md` §4.10).
 *
 * `kind` est une liste **fermée validée dans le code** : aucune contrainte `CHECK`
 * ne la porte en base, pour que la phase 40 puisse émettre `TRADE_*` sans migration.
 * `TRADE_OFFER`, `TRADE_ACCEPTED`, `TRADE_DECLINED` et `TRADE_EXPIRED` sont déclarés
 * ici et rendus par la salle, mais émis par la phase 40.
 */
export const NOTIFICATION_KINDS = [
  'FRIEND_REQUEST',
  'FRIEND_ACCEPTED',
  'ACHIEVEMENT',
  'MARKET_SOLD',
  'MARKET_BOUGHT',
  'TRADE_OFFER',
  'TRADE_ACCEPTED',
  'TRADE_DECLINED',
  'TRADE_EXPIRED',
] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

const NOTIFICATION_KIND_SET: ReadonlySet<string> = new Set(NOTIFICATION_KINDS);

export function isNotificationKind(value: unknown): value is NotificationKind {
  return typeof value === 'string' && NOTIFICATION_KIND_SET.has(value);
}

/**
 * Clé d'idempotence lisible : `<kind>:<référence>`.
 * `ACHIEVEMENT:<clé>`, `MARKET_SOLD:<listing>`, `FRIEND_REQUEST:<demandeur>`.
 * L'unicité `(user_id, dedupe_key)` porte le rejeu : deux émissions du même
 * événement au même destinataire n'écrivent qu'une ligne.
 */
export function notificationDedupeKey(kind: NotificationKind, ref: string): string {
  return `${kind}:${ref}`;
}

/** Rétention : au-delà, la notification est balayée à la lecture de la salle. */
export const NOTIFICATION_RETENTION_DAYS = 90;
export const NOTIFICATION_RETENTION_MS = NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000;
