/**
 * Code postal d'une commune — la règle du « principal ».
 *
 * `geo.api.gouv.fr` publie `codesPostaux` en tableau, dans un ordre qui n'est pas
 * documenté, et ne désigne aucun code comme principal. Le produit en retient donc
 * **un seul** : le premier code à cinq chiffres non vide du tableau, sans tri ni
 * préférence pour un code plus petit. L'ordre de la source est conservé, pour
 * qu'un réimport ne fasse pas changer la valeur d'une carte déjà possédée.
 *
 * Le tableau complet n'est pas stocké : une commune porte une colonne, pas une
 * liste (`ref_communes.code_postal`).
 */

export const POSTAL_CODE_PATTERN = /^\d{5}$/;

/** Premier code à cinq chiffres du tableau, sinon `null`. */
export function principalPostalCode(codesPostaux: unknown): string | null {
  if (!Array.isArray(codesPostaux)) return null;
  for (const entry of codesPostaux) {
    if (typeof entry === 'string' && POSTAL_CODE_PATTERN.test(entry)) return entry;
  }
  return null;
}
