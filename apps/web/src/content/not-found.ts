/**
 * Textes de la page « salle introuvable ».
 *
 * Une seule source pour les deux points de montage (routeur et route racine),
 * dans le vocabulaire du cabinet : on ne « navigue pas vers une page 404 », on
 * cherche une pièce qui n'existe pas dans le plan.
 */

export const NOT_FOUND = {
  eyebrow: 'Le cabinet',
  title: 'Cette salle n’existe pas',
  subtitle:
    'Le plan que vous avez suivi ne mène à aucune pièce du cabinet : la référence a été rangée ailleurs, ou le tiroir est vide.',
  hint: 'Vérifiez l’adresse, ou revenez au Seuil pour reprendre la visite.',
  action: 'Revenir au Seuil',
  /** Nom lisible de la page pour les technologies d’assistance. */
  documentTitle: 'Salle introuvable — Hexamap',
} as const;
