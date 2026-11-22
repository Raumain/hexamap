import type { PushNotificationMessage } from '@hexamap/shared';
import webpush from 'web-push';
import { vapidConfig } from '../lib/vapid';

/** Ce dont le protocole a besoin pour joindre un navigateur : rien de plus. */
export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * - `SENT` : le service de push a accepté l'envoi ;
 * - `GONE` : `404` ou `410`, l'abonnement est mort et la ligne doit disparaître ;
 * - `FAILED` : tout le reste — panne passagère, clé invalide, réseau coupé. La ligne
 *   reste, un battement ultérieur réessaiera.
 */
export type PushSendOutcome = 'SENT' | 'GONE' | 'FAILED';

export type PushSender = (
  target: PushTarget,
  message: PushNotificationMessage,
) => Promise<PushSendOutcome>;

/** `web-push` lève un objet porteur d'un `statusCode` ; rien ne le type ainsi. */
function statusCodeOf(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const statusCode: unknown = Reflect.get(error, 'statusCode');
  return typeof statusCode === 'number' ? statusCode : null;
}

let configuredWith: string | null = null;

/**
 * L'implémentation réelle. Elle est remplaçable (`PushSender` est un type) parce
 * qu'aucun banc ne peut parler à un vrai service de push : les spécifications
 * injectent un émetteur qui rend `SENT`, `GONE` ou `FAILED` à volonté.
 */
export const webPushSender: PushSender = async (target, message) => {
  const vapid = vapidConfig();
  if (vapid === null) return 'FAILED';

  const fingerprint = `${vapid.subject}|${vapid.publicKey}`;
  if (configuredWith !== fingerprint) {
    // `setVapidDetails` valide la paire et lève si elle est illisible : une paire
    // mal collée éteint l'envoi, elle ne casse pas le battement.
    try {
      webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
    } catch {
      return 'FAILED';
    }
    configuredWith = fingerprint;
  }

  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(message),
      // Une charge qui attend une heure ne vaut plus la peine d'être annoncée :
      // le service de push peut la jeter au-delà.
      { TTL: 3_600, urgency: 'normal' },
    );
    return 'SENT';
  } catch (error) {
    const statusCode = statusCodeOf(error);
    if (statusCode === 404 || statusCode === 410) return 'GONE';
    return 'FAILED';
  }
};
