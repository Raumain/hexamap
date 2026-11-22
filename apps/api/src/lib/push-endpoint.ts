import { lookup } from 'node:dns/promises';
import {
  classifyPushEndpoint,
  isIpLiteral,
  isPrivateAddress,
  PUSH_ENDPOINT_MESSAGES,
} from '@hexamap/shared';
import { HttpError } from './http-error';

/**
 * Résolution injectable : la seule couche qui touche au réseau. Les spécifications
 * passent une fonction factice, jamais un vrai DNS — un banc ne dépend pas d'un
 * serveur de noms qu'il ne contrôle pas.
 */
export type PushHostResolver = (host: string) => Promise<readonly string[]>;

const dnsResolver: PushHostResolver = async (host) => {
  const records = await lookup(host, { all: true, verbatim: true });
  return records.map((record) => record.address);
};

function refuse(code: keyof typeof PUSH_ENDPOINT_MESSAGES): HttpError {
  return new HttpError(400, code, PUSH_ENDPOINT_MESSAGES[code]);
}

/**
 * Valide un point de terminaison **avant tout stockage** (`.docs/02-database.md`
 * §4.12) :
 *
 * 1. `https` obligatoire, hôte absolu, littéral privé refusé — c'est le domaine pur ;
 * 2. un nom est ensuite **résolu**, et refusé s'il ne résout pas ou si l'une de ses
 *    adresses est privée. Un nom qui pointe vers `127.0.0.1` est le cas d'école :
 *    sans cette seconde garde, `https://interne.exemple.fr/push` contournerait la
 *    première.
 *
 * Limite assumée : le DNS est résolu au moment de l'abonnement, pas au moment de
 * l'envoi. Une réassociation DNS ultérieure (rebinding) n'est pas détectée. La
 * borner demanderait d'épingler l'adresse et d'ouvrir la connexion sur elle, ce que
 * `web-push` ne permet pas.
 */
export async function requirePublicPushEndpoint(
  endpoint: string,
  options?: { resolve?: PushHostResolver },
): Promise<string> {
  const verdict = classifyPushEndpoint(endpoint);
  if (!verdict.ok) {
    throw new HttpError(400, verdict.code, verdict.message);
  }

  if (isIpLiteral(verdict.host)) return verdict.endpoint;

  const resolve = options?.resolve ?? dnsResolver;

  let addresses: readonly string[];
  try {
    addresses = await resolve(verdict.host);
  } catch {
    throw refuse('PUSH_ENDPOINT_UNRESOLVED');
  }

  if (addresses.length === 0) throw refuse('PUSH_ENDPOINT_UNRESOLVED');

  if (addresses.some((address) => isPrivateAddress(address))) {
    throw refuse('PUSH_ENDPOINT_PRIVATE_HOST');
  }

  return verdict.endpoint;
}
