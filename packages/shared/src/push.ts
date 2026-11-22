/**
 * La Sonnette — domaine pur de la poussée (`.docs/01-architecture.md` §4.10,
 * `.docs/02-database.md` §4.12).
 *
 * Ce module ne connaît ni base, ni réseau, ni horloge implicite : tout instant est
 * passé en argument, tout verdict est une valeur. C'est ce qui rend la décision
 * vérifiable dans `packages/spec` sans Docker au-delà de la base, et ce qui empêche
 * l'API et le navigateur de diverger sur les heures calmes ou la forme d'un
 * point de terminaison.
 */

/** Une entrée Workbox par méthode : les cinq que le service worker doit couvrir. */
export const PUSH_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type PushHttpMethod = (typeof PUSH_HTTP_METHODS)[number];

/** Plage par défaut : 22 h → 8 h UTC, celle qui passe minuit. */
export const PUSH_DEFAULT_QUIET_START = 22;
export const PUSH_DEFAULT_QUIET_END = 8;

/** iOS ne pousse qu'à partir de 16.4, et seulement pour une PWA installée. */
export const PUSH_IOS_MIN_MAJOR = 16;
export const PUSH_IOS_MIN_MINOR = 4;

/**
 * Le seul message que le serveur pousse. Aucun autre événement — vente, médaille,
 * troc — ne sort d'ici : ceux-là restent dans Le Guichet.
 */
export interface PushNotificationMessage {
  title: string;
  body: string;
  url: string;
  tag: string;
}

export const PUSH_NOTIFICATION: PushNotificationMessage = {
  title: 'Vos charges sont revenues',
  body: 'Votre carnet a repris une charge. Revenez gratter un ticket au Relevé.',
  url: '/',
  tag: 'hexamap-charges',
};

export function pushNotificationMessage(): PushNotificationMessage {
  return { ...PUSH_NOTIFICATION };
}

/* ── Point de terminaison : la garde SSRF ─────────────────────────────────── */

export type PushEndpointRejection =
  | 'PUSH_ENDPOINT_MALFORMED'
  | 'PUSH_ENDPOINT_NOT_HTTPS'
  | 'PUSH_ENDPOINT_PRIVATE_HOST'
  | 'PUSH_ENDPOINT_UNRESOLVED';

export interface PushEndpointAccepted {
  ok: true;
  /** L'adresse telle qu'elle sera stockée. */
  endpoint: string;
  host: string;
}

export interface PushEndpointRefused {
  ok: false;
  code: PushEndpointRejection;
  message: string;
}

export type PushEndpointVerdict = PushEndpointAccepted | PushEndpointRefused;

const ENDPOINT_MESSAGES: Record<PushEndpointRejection, string> = {
  PUSH_ENDPOINT_MALFORMED: "L'adresse de notification est illisible.",
  PUSH_ENDPOINT_NOT_HTTPS: "L'adresse de notification doit être en HTTPS.",
  PUSH_ENDPOINT_PRIVATE_HOST:
    "L'adresse de notification désigne un hôte interne : elle est refusée.",
  PUSH_ENDPOINT_UNRESOLVED: "L'adresse de notification ne se résout pas.",
};

export { ENDPOINT_MESSAGES as PUSH_ENDPOINT_MESSAGES };

function refuse(code: PushEndpointRejection): PushEndpointRefused {
  return { ok: false, code, message: ENDPOINT_MESSAGES[code] };
}

function stripBrackets(host: string): string {
  return host.replace(/^\[/, '').replace(/\]$/, '');
}

/** Quatre octets, ou `null` si la chaîne n'est pas une IPv4 pointée. */
function parseIpv4(value: string): [number, number, number, number] | null {
  const parts = value.split('.');
  const [a, b, c, d] = parts;
  if (
    parts.length !== 4 ||
    a === undefined ||
    b === undefined ||
    c === undefined ||
    d === undefined
  ) {
    return null;
  }

  const octets: number[] = [];
  for (const part of parts) {
    if (!/^[0-9]{1,3}$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    octets.push(octet);
  }

  const [first, second, third, fourth] = octets;
  if (first === undefined || second === undefined || third === undefined || fourth === undefined) {
    return null;
  }
  return [first, second, third, fourth];
}

/**
 * Boucle locale, lien-local, RFC 1918, CGNAT, bancs d'essai et multicast.
 * Une adresse publique quelconque rend `false`.
 */
function isPrivateIpv4(octets: [number, number, number, number]): boolean {
  const [a, b] = octets;

  if (a === 0) return true; // « cette machine »
  if (a === 10) return true; // RFC 1918
  if (a === 127) return true; // boucle locale
  if (a === 169 && b === 254) return true; // lien-local
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC 1918
  if (a === 192 && b === 168) return true; // RFC 1918
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // bancs d'essai
  if (a >= 224) return true; // multicast et réservé

  return false;
}

function isPrivateIpv6(value: string): boolean {
  if (value === '::' || value === '::1') return true;

  // Adresse IPv4 encapsulée : `::ffff:192.168.1.1`.
  const mapped = /^::ffff:([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)$/.exec(value);
  if (mapped?.[1] !== undefined) return isPrivateAddress(mapped[1]);

  const head = value.split(':')[0] ?? '';
  if (head.startsWith('fc') || head.startsWith('fd')) return true; // fc00::/7, unique local
  if (/^fe[89ab]/.test(head)) return true; // fe80::/10, lien-local
  if (head.startsWith('ff')) return true; // multicast

  return false;
}

/** Une adresse littérale privée. Un nom d'hôte rend `false` : voir `isPrivateHostname`. */
export function isPrivateAddress(address: string): boolean {
  const normalized = stripBrackets(address.trim().toLowerCase());
  // Une zone d'interface (`fe80::1%eth0`) ne change pas la nature de l'adresse.
  const withoutZone = normalized.split('%')[0] ?? normalized;

  const ipv4 = parseIpv4(withoutZone);
  if (ipv4 !== null) return isPrivateIpv4(ipv4);

  if (withoutZone.includes(':')) return isPrivateIpv6(withoutZone);

  return false;
}

/** Une adresse littérale privée, ou un nom qui désigne la machine locale. */
export function isPrivateHostname(host: string): boolean {
  const normalized = stripBrackets(host.trim().toLowerCase()).replace(/\.$/, '');
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true;
  return isPrivateAddress(normalized);
}

/**
 * Vrai pour une IPv4 ou une IPv6 littérale. Un littéral n'a rien à résoudre :
 * `classifyPushEndpoint` l'a déjà jugé, la couche API n'appelle donc pas le DNS.
 */
export function isIpLiteral(host: string): boolean {
  const normalized = stripBrackets(host.trim());
  if (parseIpv4(normalized) !== null) return true;
  return normalized.includes(':');
}

/**
 * Verdict purement syntaxique : protocole, forme, hôte littéral. La résolution DNS
 * d'un nom est faite par l'API (`apps/api/src/lib/push-endpoint.ts`), seule couche
 * autorisée à toucher au réseau.
 *
 * L'analyse est écrite à la main plutôt qu'avec `URL` : `packages/shared` ne
 * compile qu'avec `lib: ["ES2023"]`, sans les globales du DOM ni de Node, et
 * `URL` n'en fait pas partie. La grammaire acceptée est volontairement étroite —
 * schéma, `://`, autorité, puis le reste ignoré.
 */
export function classifyPushEndpoint(raw: string): PushEndpointVerdict {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return refuse('PUSH_ENDPOINT_MALFORMED');

  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)/i.exec(trimmed);
  const scheme = match?.[1];
  const authority = match?.[2];
  if (scheme === undefined || authority === undefined || authority.length === 0) {
    return refuse('PUSH_ENDPOINT_MALFORMED');
  }

  if (scheme.toLowerCase() !== 'https') return refuse('PUSH_ENDPOINT_NOT_HTTPS');

  const host = hostOfAuthority(authority);
  if (host === null) return refuse('PUSH_ENDPOINT_MALFORMED');
  if (isPrivateHostname(host)) return refuse('PUSH_ENDPOINT_PRIVATE_HOST');

  return { ok: true, endpoint: trimmed, host };
}

/**
 * Extrait l'hôte d'une autorité `[user:pass@]host[:port]`. Un littéral IPv6 nu
 * (`::1`) n'est pas valide dans une URL, mais il est traité comme tel plutôt que
 * d'être rejeté pour une mauvaise raison.
 */
function hostOfAuthority(authority: string): string | null {
  const at = authority.lastIndexOf('@');
  const hostAndPort = at === -1 ? authority : authority.slice(at + 1);
  if (hostAndPort.length === 0) return null;

  if (hostAndPort.startsWith('[')) {
    const close = hostAndPort.indexOf(']');
    if (close <= 1) return null;
    return hostAndPort.slice(1, close);
  }

  const colon = hostAndPort.indexOf(':');
  const host = colon === -1 ? hostAndPort : hostAndPort.slice(0, colon);

  return host.length === 0 ? null : host;
}

/* ── Heures calmes et décision d'envoi ────────────────────────────────────── */

/** Jour UTC au format `YYYY-MM-DD`, la seule forme que porte `last_sent_on`. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

/**
 * `quietStart === quietEnd` désactive la plage. Une plage qui passe minuit
 * (`22 → 8`) se lit comme deux intervalles : `[22, 24[` et `[0, 8[`.
 */
export function isQuietHour(hour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart === quietEnd) return false;

  const normalized = ((Math.trunc(hour) % 24) + 24) % 24;

  if (quietStart < quietEnd) return normalized >= quietStart && normalized < quietEnd;
  return normalized >= quietStart || normalized < quietEnd;
}

export type PushDecisionReason =
  | 'SEND'
  | 'NO_CHARGE_DUE'
  | 'ALREADY_NOTIFIED'
  | 'DAILY_QUOTA'
  | 'QUIET_HOURS';

export interface PushDecisionInput {
  /** Solde de charges **stocké** en base, jamais le solde dérivé. */
  charges: number;
  lastRegenAt: Date;
  regenMs: number;
  now: Date;
  quietStart: number;
  quietEnd: number;
  /** `last_sent_on` de l'abonnement, `YYYY-MM-DD` UTC. */
  lastSentOn: string | null;
  /** `last_notified_charge_at` de l'abonnement. */
  lastNotifiedChargeAt: Date | null;
}

export interface PushDecision {
  send: boolean;
  reason: PushDecisionReason;
  /** Instant de la charge annoncée : `last_regen_at + SCRATCH_REGEN_MS`. */
  chargeAt: Date;
}

/**
 * L'ordre des gardes est le contrat :
 *
 * 1. un carnet non vide n'a rien à annoncer ;
 * 2. une charge pas encore échue non plus ;
 * 3. le **même** instant de charge ne s'annonce pas deux fois ;
 * 4. au plus un envoi par jour UTC et par abonnement ;
 * 5. les heures calmes **reportent** l'envoi — elles ne consomment aucun quota,
 *    puisque le quota n'est écrit qu'au moment d'un envoi réel.
 */
export function pushDecision(input: PushDecisionInput): PushDecision {
  const chargeAt = new Date(input.lastRegenAt.getTime() + input.regenMs);
  const verdict = (send: boolean, reason: PushDecisionReason): PushDecision => ({
    send,
    reason,
    chargeAt,
  });

  if (input.charges > 0) return verdict(false, 'NO_CHARGE_DUE');
  if (input.now.getTime() < chargeAt.getTime()) return verdict(false, 'NO_CHARGE_DUE');

  if (
    input.lastNotifiedChargeAt !== null &&
    chargeAt.getTime() <= input.lastNotifiedChargeAt.getTime()
  ) {
    return verdict(false, 'ALREADY_NOTIFIED');
  }

  if (input.lastSentOn !== null && input.lastSentOn === utcDay(input.now)) {
    return verdict(false, 'DAILY_QUOTA');
  }

  if (isQuietHour(input.now.getUTCHours(), input.quietStart, input.quietEnd)) {
    return verdict(false, 'QUIET_HOURS');
  }

  return verdict(true, 'SEND');
}

/* ── iOS : la poussée exige une PWA installée, en 16.4 ou plus ────────────── */

export function isIosUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/.test(userAgent);
}

export function iosVersion(userAgent: string): { major: number; minor: number } | null {
  const match = /OS (\d+)_(\d+)/.exec(userAgent);
  const major = match?.[1];
  const minor = match?.[2];
  if (major === undefined || minor === undefined) return null;
  return { major: Number(major), minor: Number(minor) };
}

export function iosSupportsPush(userAgent: string): boolean {
  const version = iosVersion(userAgent);
  if (version === null) return false;
  if (version.major > PUSH_IOS_MIN_MAJOR) return true;
  if (version.major < PUSH_IOS_MIN_MAJOR) return false;
  return version.minor >= PUSH_IOS_MIN_MINOR;
}

export interface PushEnvironment {
  userAgent: string;
  /** `display-mode: standalone`, ou `navigator.standalone` sur iOS. */
  standalone: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
}

/**
 * `ios-requires-install` couvre les deux refus d'iOS — version trop ancienne et
 * PWA non installée —, parce que la marche à suivre est la même et qu'un seul
 * message français suffit à la dire.
 */
export type PushSupport = 'available' | 'unsupported' | 'ios-requires-install';

export function pushSupport(environment: PushEnvironment): PushSupport {
  if (isIosUserAgent(environment.userAgent)) {
    if (!iosSupportsPush(environment.userAgent) || !environment.standalone) {
      return 'ios-requires-install';
    }
  }

  if (!environment.hasPushManager || !environment.hasNotification) return 'unsupported';

  return 'available';
}
