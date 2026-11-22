import { db } from '../db';
import { env } from '../env';
import { pushEnabled } from '../lib/vapid';
import { runPushSweep } from './push';
import { webPushSender } from './push-sender';

export interface PushScheduler {
  stop(): void;
}

/**
 * Le battement de La Sonnette (`.docs/01-architecture.md` §4.10).
 *
 * - **60 s**, réglable par `PUSH_SWEEP_INTERVAL_MS` ;
 * - **un seul détenteur** : `pg_try_advisory_lock` dans `runPushSweep` exclut les
 *   autres processus, un drapeau local exclut les chevauchements du processus
 *   courant ;
 * - **aucun démarrage sans clés VAPID** : la fonctionnalité est éteinte proprement,
 *   pas en erreur au boot.
 *
 * Le battement n'est jamais démarré par `app.ts` : les spécifications importent
 * l'application et n'ont pas à faire tourner une horloge. Seul `index.ts`, qui
 * connaît le cycle de vie du processus, l'appelle.
 */
export function startPushScheduler(): PushScheduler | null {
  if (!pushEnabled()) return null;

  const intervalMs = env.PUSH_SWEEP_INTERVAL_MS;
  let running = false;

  const beat = async (): Promise<void> => {
    if (running) return;
    running = true;

    try {
      const result = await runPushSweep({ db, sender: webPushSender });

      if (result.locked && (result.sent > 0 || result.purged > 0)) {
        console.log(
          `[push] battement : ${result.scanned} lue(s), ${result.sent} envoyée(s), ${result.purged} purgée(s)`,
        );
      }
    } catch (error) {
      // Un battement en échec ne tue pas le processus et n'arrête pas la boucle :
      // la base est peut-être momentanément indisponible, le suivant réessaiera.
      console.error('[push] battement en échec', error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => {
    void beat();
  }, intervalMs);

  return {
    stop(): void {
      clearInterval(timer);
    },
  };
}
