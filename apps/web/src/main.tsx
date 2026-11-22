import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRouter, RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { NotFound } from './components/ui/not-found';
import { registerPwa } from './lib/pwa';
import { parseSearch, stringifySearch } from './lib/search-params';
import { routeTree } from './routeTree.gen';
import './styles.css';

const queryClient = new QueryClient();

const router = createRouter({
  routeTree,
  defaultPreload: 'intent',
  // Le routeur n'a aucun composant de repli par défaut en français : sans cette
  // ligne, `throw notFound()` rendait la page anglaise de TanStack Router.
  defaultNotFoundComponent: NotFound,
  stringifySearch,
  parseSearch,
  context: { queryClient },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Élément #root introuvable');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

registerPwa();
