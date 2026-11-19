const priceFormatter = new Intl.NumberFormat('fr-FR');

export const CURRENCY = {
  label: 'Bourse',
  unit: 'écus',
} as const;

export function priceLabel(price: number): string {
  return `${priceFormatter.format(price)} ${CURRENCY.unit}`;
}

export function balanceLabel(balance: number): string {
  return priceLabel(balance);
}

export function listingsCountLabel(shown: number, total: number): string {
  const shownText = shown === 1 ? '1 annonce affichée' : `${shown} annonces affichées`;
  const totalText = total === 1 ? '1 annonce' : `${total} annonces`;
  return `${shownText} sur ${totalText}`;
}

export const MARKET = {
  eyebrow: 'Marché',
  title: 'Hôtel des ventes',
  subtitle: 'Achetez et vendez des cartes à prix fixe pour compléter votre collection.',
  loadingSession: 'Chargement de votre session…',
  loading: 'Chargement des annonces…',
  retry: 'Réessayer',
  errorTitle: 'Impossible de charger le marché.',
  emptyTitle: 'Aucune annonce en vente.',
  emptyDescription: 'Revenez plus tard, ou mettez vos propres cartes en vente.',
  categoryLabel: 'Catégorie',
  rarityLabel: 'Rareté',
  allValues: 'Toutes',
  buy: 'Acheter',
  buying: 'Achat…',
  ownListing: 'Votre annonce',
  previous: 'Précédent',
  next: 'Suivant',
  sellerLabel: 'Vendeur',
  sellerAnonymous: 'Anonyme',
  scoreLabel: 'Score',
  manageMine: 'Gérer mes ventes',
} as const;

export const MARKET_MINE = {
  eyebrow: 'Mes ventes',
  title: 'Mes ventes',
  subtitle: 'Mettez vos cartes en vente et suivez vos annonces.',
  loadingSession: 'Chargement de votre session…',
  loading: 'Chargement de vos annonces…',
  retry: 'Réessayer',
  emptyTitle: 'Aucune annonce pour le moment.',
  emptyDescription: 'Mettez une carte en vente pour la retrouver ici.',
  sellTitle: 'Mettre une carte en vente',
  sellSubmit: 'Mettre en vente',
  cardLabel: 'Carte',
  priceLabel: 'Prix',
  pricePlaceholder: 'Prix en crédits…',
  cancel: 'Annuler la vente',
  noUnlockedCards: "Vous n'avez aucune carte disponible à la vente.",
  selectCard: 'Choisir une carte…',
  seeCollection: 'Voir ma collection',
  listingsTitle: 'Mes annonces',
  scoreLabel: 'Score',
  priceInvalid: 'Entrez un prix entier entre 1 et 1 000 000.',
} as const;

export const LISTING_STATUS_LABELS: Record<'OPEN' | 'SOLD' | 'CANCELLED', string> = {
  OPEN: 'En vente',
  SOLD: 'Vendu',
  CANCELLED: 'Annulé',
};

export const LISTING_STATUS_STYLES: Record<'OPEN' | 'SOLD' | 'CANCELLED', string> = {
  OPEN: 'border-verdigris/50 text-verdigris',
  SOLD: 'border-brass/50 text-brass',
  CANCELLED: 'border-veil text-vellum/55',
};
