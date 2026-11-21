import { SESSION } from '../../content/session';
import { outlineButtonClass } from './button-classes';

/**
 * Un échec de vérification de session n'est pas une déconnexion. Ce panneau
 * remplace la redirection vers Le Seuil tant que les retries sont épuisés.
 */
export function SessionUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="space-y-4 rounded-sheet border border-oxide/40 bg-cabinet-raised p-6"
    >
      <p className="font-display text-lg tracking-tight text-vellum">{SESSION.unavailableTitle}</p>
      <p className="max-w-prose text-sm leading-relaxed text-vellum/70">
        {SESSION.unavailableHint}
      </p>
      <button type="button" className={outlineButtonClass} onClick={onRetry}>
        {SESSION.retry}
      </button>
    </div>
  );
}
