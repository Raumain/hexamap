import { env } from '../env';

/**
 * Interrupteur de la suppression de compte.
 *
 * La variable est lue **à chaque appel**, jamais figée à l'import : la spec
 * exerce les deux états dans un même processus, et un déploiement doit pouvoir
 * allumer la suppression sans reconstruire l'image. Le défaut vient d'`env.ts`
 * (`false`), qui reste le seul propriétaire de la liste des réglages.
 */
export function accountDeletionEnabled(): boolean {
  const raw =
    process.env.ACCOUNT_DELETION_ENABLED ?? (env.ACCOUNT_DELETION_ENABLED ? 'true' : 'false');
  return raw === 'true';
}
