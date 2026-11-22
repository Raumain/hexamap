import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AppShell } from '../components/layout/app-shell';
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
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
