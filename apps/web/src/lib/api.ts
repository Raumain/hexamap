import { treaty } from '@elysia/eden';
import type { App } from '@hexamap/api/app';

// Origine de la page : les requêtes partent vers `<origine>/api/...`, donc toujours
// sur le même host et le même port que le front. En dev, Vite relaie `/api` vers l'API.
// Ne jamais passer une chaîne vide : Eden la préfixe par `https://`.
const apiBaseUrl = import.meta.env.VITE_API_URL || window.location.origin;

export const api = treaty<App>(apiBaseUrl, {
  fetch: { credentials: 'include' },
});
