import { env } from '../env';

export interface VapidConfig {
  publicKey: string;
  privateKey: string;
  subject: string;
}

/**
 * Le sujet VAPID est l'identité de contact que le service de push utilise s'il doit
 * joindre l'émetteur. Il n'a pas à être un secret, mais il doit exister.
 */
const DEFAULT_SUBJECT = 'mailto:sonnette@hexamap.fr';

function read(name: 'VAPID_PUBLIC_KEY' | 'VAPID_PRIVATE_KEY' | 'VAPID_SUBJECT'): string {
  // `process.env` d'abord, `env` ensuite : le schéma Zod de `env.ts` documente la
  // forme et refuse une valeur vide au démarrage, mais la lecture **effective** a
  // lieu à l'appel. C'est ce qui permet à la sonnette de s'éteindre proprement
  // quand la paire est absente, sans faire échouer le boot, et au banc d'exercer
  // les deux états dans le même processus.
  return (process.env[name] ?? env[name] ?? '').trim();
}

/**
 * Les clés VAPID vivent **uniquement** dans l'environnement. Elles ne sont jamais
 * en base, jamais dans le dépôt, jamais dans un fichier commité. L'exploitant les
 * génère une fois avec `bun run --cwd apps/api vapid:generate` et les dépose dans
 * le magasin de secrets du déploiement.
 *
 * Paire absente, l'une ou l'autre vide : la sonnette est **éteinte**, et aucune
 * exception n'est levée.
 */
export function vapidConfig(): VapidConfig | null {
  const publicKey = read('VAPID_PUBLIC_KEY');
  const privateKey = read('VAPID_PRIVATE_KEY');

  if (publicKey.length === 0 || privateKey.length === 0) return null;

  const subject = read('VAPID_SUBJECT') || DEFAULT_SUBJECT;

  return { publicKey, privateKey, subject };
}

export function pushEnabled(): boolean {
  return vapidConfig() !== null;
}
