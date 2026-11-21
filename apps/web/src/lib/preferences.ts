/**
 * Préférences locales du joueur, gardées dans le navigateur.
 *
 * Ce sont des préférences d'affichage, jamais de l'état serveur : rien ici ne
 * décrit ce que le serveur sait du compte, aucun appel réseau ne les transporte,
 * et le service worker n'a rien à en mettre en cache — une préférence n'est pas
 * une réponse HTTP, elle n'entre donc dans aucun de ses itinéraires.
 *
 * Le stockage est lu et écrit de façon défensive : un navigateur qui refuse
 * `localStorage` (navigation privée de Safari, quota épuisé) rend la valeur par
 * défaut au lieu de faire échouer l'écran.
 */

/** Clé unique de la préférence de son du grattoir. */
export const SOUND_PREFERENCE_KEY = 'hexamap.scratch.sound';

/** Lit un drapeau stocké. Seuls `'true'` et `'false'` sont reconnus. */
export function readStoredFlag(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
    return fallback;
  } catch {
    return fallback;
  }
}

/** Écrit un drapeau stocké. Un stockage refusé laisse la préférence locale. */
export function writeStoredFlag(key: string, value: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // Stockage indisponible : la préférence ne survit pas à la visite.
  }
}
