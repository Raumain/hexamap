import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Transport de courriel du dépôt.
 *
 * Aucun prestataire n'existe ici : le message est journalisé et conservé en
 * mémoire (borne de 50), ce qui suffit à la vérification Better Auth et à la
 * spec. Quand `MAIL_OUTBOX_DIR` est défini, il est **aussi** écrit tel quel dans
 * ce répertoire, un fichier JSON par message, permissions 600 : un opérateur ou
 * le banc peut alors ouvrir le lien. Aucun appel réseau, aucune dépendance,
 * aucun secret dans le journal — seul le destinataire y figure.
 */

export interface CapturedMail {
  to: string;
  url: string;
  capturedAt: string;
}

/** Sujet fixe : un seul type de message existe, la vérification d'adresse. */
const VERIFICATION_SUBJECT = 'Vérifiez votre adresse électronique';

/** Le répertoire d'écriture, ou `null` quand aucun transport n'est configuré. */
function outboxDir(): string | null {
  const dir = process.env.MAIL_OUTBOX_DIR?.trim();
  return dir !== undefined && dir.length > 0 ? dir : null;
}

/** Vrai si et seulement si `MAIL_OUTBOX_DIR` est défini et non vide. */
export function mailTransportConfigured(): boolean {
  return outboxDir() !== null;
}

/** Borne dure : un processus de test ne doit pas accumuler indéfiniment. */
const MAX_CAPTURED = 50;

const captured: CapturedMail[] = [];

export async function sendVerificationMail({
  to,
  url,
}: {
  to: string;
  url: string;
}): Promise<void> {
  const capturedAt = new Date().toISOString();
  const dir = outboxDir();

  if (dir === null) {
    console.log(`[courriel] vérification pour ${to} — lien capturé, aucun transport configuré.`);
  } else {
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${crypto.randomUUID()}.json`);
    await writeFile(
      file,
      `${JSON.stringify({ to, url, subject: VERIFICATION_SUBJECT, sentAt: capturedAt }, null, 2)}\n`,
      { mode: 0o600 },
    );
    console.log(`[courriel] vérification pour ${to} — message écrit dans ${file}.`);
  }

  captured.push({ to, url, capturedAt });
  if (captured.length > MAX_CAPTURED) {
    captured.splice(0, captured.length - MAX_CAPTURED);
  }
}

/** Vide la boîte et rend les messages accumulés depuis le dernier appel. */
export function drainCapturedMail(): CapturedMail[] {
  return captured.splice(0, captured.length);
}
