import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Rend un overlay dans `document.body` : aucun ancêtre transformé ne peut
 * redéfinir son bloc conteneur. Le SPA est rendu côté navigateur uniquement,
 * `document.body` existe donc dès le premier rendu ; si un prérendu était
 * introduit, l'hôte devrait être résolu dans un `useEffect`.
 */
export function OverlayPortal({ children }: { children: ReactNode }) {
  return createPortal(children, document.body);
}
