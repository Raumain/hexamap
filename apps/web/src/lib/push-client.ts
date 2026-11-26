import { type PushSupport, pushSupport } from '@hexamap/shared';
import { queryOptions } from '@tanstack/react-query';
import { api } from './api';

/**
 * Le client de La Sonnette. Le serveur décide **toujours** : ce module ne fait
 * qu'enregistrer un abonnement, le retirer, et lire les préférences. Aucune boucle
 * de sondage — la poussée arrive par le service worker, jamais par une requête.
 */

export interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

export interface PushPreferences {
  quietStart: number;
  quietEnd: number;
}

export class PushApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'PushApiError';
    this.code = code;
  }
}

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

function isApiErrorValue(value: unknown): value is { code: string; message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    typeof value.code === 'string' &&
    'message' in value &&
    typeof value.message === 'string'
  );
}

function toApiError(value: unknown): PushApiError {
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const body = value.value;
    if (isApiErrorValue(body)) return new PushApiError(body.message, body.code);
  }
  if (isApiErrorValue(value)) return new PushApiError(value.message, value.code);
  return new PushApiError(FALLBACK_MESSAGE, null);
}

export async function fetchPushConfig(): Promise<PushConfig> {
  const { data, error } = await api.api.v1.push.config.get();
  if (error) throw toApiError(error);
  return data;
}

export async function fetchPushPreferences(): Promise<PushPreferences> {
  const { data, error } = await api.api.v1.push.preferences.get();
  if (error) throw toApiError(error);
  return data;
}

export async function savePushPreferences(input: PushPreferences): Promise<PushPreferences> {
  const { data, error } = await api.api.v1.push.preferences.put(input);
  if (error) throw toApiError(error);
  return data;
}

export const pushConfigQueryKey = ['push', 'config'] as const;
export const pushPreferencesQueryKey = ['push', 'preferences'] as const;

export function pushConfigQueryOptions() {
  return queryOptions({
    queryKey: pushConfigQueryKey,
    queryFn: fetchPushConfig,
    staleTime: 60_000,
  });
}

export function pushPreferencesQueryOptions() {
  return queryOptions({
    queryKey: pushPreferencesQueryKey,
    queryFn: fetchPushPreferences,
    staleTime: 60_000,
  });
}

/* ── L'état réel du navigateur ───────────────────────────────────────────── */

export interface PushEnvironmentState {
  support: PushSupport;
  permission: NotificationPermission | 'unsupported';
}

export function detectPushEnvironment(): PushEnvironmentState {
  const hasNotification = 'Notification' in window;
  const hasPushManager = 'serviceWorker' in navigator && 'PushManager' in window;

  const environment = {
    userAgent: navigator.userAgent,
    standalone:
      window.matchMedia('(display-mode: standalone)').matches ||
      Reflect.get(navigator, 'standalone') === true,
    hasPushManager,
    hasNotification,
  };

  return {
    support: pushSupport(environment),
    permission: hasNotification ? Notification.permission : 'unsupported',
  };
}

/**
 * L'abonnement **du navigateur**, pas celui de la base : il peut exister une ligne
 * serveur sans abonnement local (autre navigateur) et l'inverse. L'écran montre
 * l'état local, seule chose que le joueur puisse observer.
 */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null;

  const registration = await navigator.serviceWorker.getRegistration();
  if (registration === undefined) return null;

  return registration.pushManager.getSubscription();
}

/** `base64url` → octets : `applicationServerKey` n'accepte rien d'autre. */
export function decodeApplicationServerKey(key: string): Uint8Array<ArrayBuffer> {
  const normalized = key.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = window.atob(padded);

  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export async function subscribeToPush(): Promise<void> {
  const config = await fetchPushConfig();

  if (!config.enabled || config.publicKey === null) {
    throw new PushApiError('La Sonnette n’est pas configurée sur ce serveur.', 'PUSH_DISABLED');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new PushApiError(
      'Les notifications sont refusées pour ce site.',
      'PUSH_PERMISSION_DENIED',
    );
  }

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: decodeApplicationServerKey(config.publicKey),
  });

  const keys = subscription.toJSON().keys;

  const { error } = await api.api.v1.push.subscription.post({
    endpoint: subscription.endpoint,
    keys: { p256dh: keys?.p256dh ?? '', auth: keys?.auth ?? '' },
  });

  if (error) {
    // La ligne serveur n'a pas été écrite : l'abonnement local ne sert à rien.
    await subscription.unsubscribe();
    throw toApiError(error);
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await currentSubscription();
  if (subscription === null) return;

  // Le serveur d'abord : sans son endpoint, la ligne ne serait plus retrouvable.
  const { error } = await api.api.v1.push.subscription.delete({ endpoint: subscription.endpoint });
  if (error) throw toApiError(error);

  await subscription.unsubscribe();
}
