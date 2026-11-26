import { app } from './app';
import { env } from './env';
import { startPushScheduler } from './services/push-scheduler';

app.listen(env.PORT);

// La Sonnette : le seul travail périodique du runtime. `null` sans paire VAPID —
// la fonctionnalité est éteinte, le processus démarre quand même. Le planificateur
// n'est jamais monté par `app.ts`, sinon chaque spécification ferait tourner une
// horloge.
const scheduler = startPushScheduler();

function shutdown(): void {
  scheduler?.stop();
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

console.log(`[hexamap] API prête sur http://localhost:${env.PORT}`);
