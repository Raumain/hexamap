import { useRouterState } from '@tanstack/react-router';
import { useEffect } from 'react';
import { applySeoHead, currentOrigin, type SeoDescriptor, seoForPath } from '../lib/seo';

/**
 * Applique un descripteur au `document.head` au montage et à chaque changement
 * de valeur. `null` ne fait rien : la vitrine publie son propre descripteur une
 * fois le profil chargé, et la racine ne doit pas le lui disputer.
 */
export function useSeoHead(descriptor: SeoDescriptor | null): void {
  const title = descriptor?.title ?? null;
  const description = descriptor?.description ?? null;
  const canonical = descriptor?.canonical ?? null;
  const robots = descriptor?.robots ?? null;

  useEffect(() => {
    if (title === null || description === null || robots === null) {
      return;
    }
    applySeoHead({ title, description, canonical, robots });
  }, [title, description, canonical, robots]);
}

/**
 * Les métadonnées de la route courante, montées **une seule fois** par la
 * racine. Les titres et les directives d'indexation vivent dans `lib/seo.ts` :
 * une route n'a rien à déclarer, et une salle oubliée ne peut pas hériter d'un
 * `index` par accident — la table est explicite, et le repli est `noindex`.
 *
 * Rend `null` : ce composant n'ajoute aucun nœud au document.
 */
export function RouteSeoHead() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  useSeoHead(seoForPath(pathname, currentOrigin()));
  return null;
}
