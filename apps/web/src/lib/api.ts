import { treaty } from '@elysia/eden';
import type { App } from '@hexamap/api/app';

// Origine de la page : les requêtes partent vers `<origine>/api/...`, donc toujours
// sur le même host et le même port que le front (localhost ou IP LAN). En dev, Vite
// relaie ensuite `/api` vers l'API dans le réseau Docker.
// Ne jamais passer une chaîne vide : Eden la préfixe par `https://`, ce qui donne
// `https://api/v1/health` — `api` deviendrait le nom de domaine.
export const api = treaty<App>(window.location.origin);
