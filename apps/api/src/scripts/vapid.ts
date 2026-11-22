import { generateVAPIDKeys } from 'web-push';

/**
 * Génère une paire VAPID et l'imprime sur la sortie standard.
 *
 *   docker compose --profile tools run --rm dev bun run --cwd apps/api vapid:generate
 *
 * **Aucun fichier n'est écrit.** L'exploitant copie les deux valeurs dans le
 * magasin de secrets de son déploiement (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
 * Les clés ne vont jamais en base, jamais dans le dépôt, jamais dans un fichier
 * commité : une clé privée commitée est une clé compromise, et faire tourner la
 * paire invalide tous les abonnements existants.
 *
 * La clé publique est celle que le navigateur reçoit ; la privée ne sort du
 * processus que par cette commande et par l'envoi.
 */
const keys = generateVAPIDKeys();

console.log('Paire VAPID générée. Déposez ces deux valeurs dans le magasin de secrets :\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('\nVAPID_SUBJECT est facultatif : `mailto:` de l’exploitant, ou une URL de contact.');
