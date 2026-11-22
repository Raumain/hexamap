export const PLAYER_PROFILE = {
  eyebrow: 'SALLE VII · LA VITRINE',
  back: 'Retour',
  loading: 'Chargement de la vitrine…',
  loadingSession: 'Chargement de votre session…',
  retry: 'Réessayer',
  memberSinceLabel: 'Membre depuis',
  cardsLabel: 'Planches',
  completenessTitle: 'Complétude',
  bestTableauTitle: 'Meilleur tableau',
  bestTableauEmpty: 'Aucun tableau composé pour le moment.',
  medalsTitle: 'Médailles',
  medalsEmpty: 'Aucune médaille obtenue pour le moment.',
  listingsLabel: 'Annonces ouvertes',
  friendsLabel: 'Amis',
  bioEmpty: 'Aucune biographie.',
  friendAdd: 'Ajouter en ami',
  friendPending: 'Demande envoyée',
  friendAccept: 'Accepter la demande',
  friendFriends: 'Amis',
  friendUnavailable: 'Indisponible',
  pts: 'pts',
  bestTableauCardsLabel: 'Les quatre planches',
  bestTableauSlotEmpty: 'Emplacement vide',
} as const;

export function bestTableauLinksLabel(links: number): string {
  if (links <= 0) return 'Aucun lien d’alignement';
  return links === 1 ? '1 lien d’alignement' : `${links} liens d’alignement`;
}
