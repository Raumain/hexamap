import { useEffect, useState } from 'react';
import {
  applyPwaUpdate,
  dismissPwaUpdate,
  isPwaUpdateWaiting,
  subscribeToPwaUpdate,
} from '../../lib/pwa';

/**
 * Invitation à recharger quand une nouvelle version est prête.
 * `skipWaiting` et `clientsClaim` restent désactivés : c'est le joueur qui décide.
 */
export function PwaUpdatePrompt() {
  const [visible, setVisible] = useState(isPwaUpdateWaiting);

  useEffect(() => subscribeToPwaUpdate(() => setVisible(isPwaUpdateWaiting())), []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 z-40 left-[max(1rem,env(safe-area-inset-left))] right-[max(1rem,env(safe-area-inset-right))] pb-[env(safe-area-inset-bottom)] md:left-auto md:right-6 md:bottom-6 md:w-80">
      <div
        role="status"
        aria-live="polite"
        className="rounded-md border border-brass/40 bg-cabinet-raised p-4 shadow-lg"
      >
        <p className="font-display text-[15px] font-semibold leading-tight text-vellum">
          Nouvelle version disponible
        </p>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/60">
          Le cabinet sera rechargé
        </p>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={applyPwaUpdate}
            className="flex-1 touch-manipulation rounded-sm border border-brass/60 bg-brass px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cabinet"
          >
            Recharger
          </button>
          <button
            type="button"
            onClick={dismissPwaUpdate}
            className="touch-manipulation rounded-sm border border-vellum-edge px-3 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/70"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
