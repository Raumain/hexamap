/**
 * Erreur applicative transportant un statut HTTP et un code machine stable.
 * Les routes l'attrapent pour construire une réponse `{ code, message }` typée.
 */
export class HttpError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 500 | 503,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}
