import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AppShell } from '../components/layout/app-shell';
import { RouteSeoHead } from '../components/seo-head';
import { NotFound } from '../components/ui/not-found';

export const Route = createRootRoute({
  component: RootLayout,
  // Une salle inconnue comme un `throw notFound()` de route aboutissent ici : le
  // routeur n'a pas d'autre point de montage pour une correspondance absente.
  // Le composant est rendu **dans** l'`Outlet` ci-dessous, donc sans coquille.
  notFoundComponent: NotFound,
});

function RootLayout() {
  return (
    <>
      {/* Titre, description, canonique et directives d'indexation de la route
          courante (`lib/seo.ts`). Rendu hors de `<main>`, il ne produit aucun
          nœud : il n'écrit que dans `document.head`. */}
      <RouteSeoHead />
      <AppShell>
        <Outlet />
      </AppShell>
    </>
  );
}
