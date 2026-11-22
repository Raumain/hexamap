export const CARD_DETAIL = {
  eyebrow: 'SALLE VI · LE CARTEL',
  back: 'Retour',
  loading: 'Chargement de la planche…',
  loadingSession: 'Chargement de votre session…',
  retry: 'Réessayer',
  cartelTitle: 'Cartel',
  categoryLabel: 'Catégorie',
  rarityLabel: 'Rareté',
  scoreLabel: 'Score',
  refLabel: 'Référence',
  acquiredLabel: 'Acquise le',
  sourceLabel: 'Provenance',
  stateLabel: 'État',
  placeTitle: 'Le lieu',
  placeEmpty: "Aucune donnée de référence n'accompagne cette planche.",
  populationLabel: 'Population',
  departementLabel: 'Département',
  regionLabel: 'Région',
  occurrencesLabel: 'Communes homonymes',
  coordinatesLabel: 'Coordonnées',
  reservesTitle: 'Réserves',
  reservesHint: "Ces rubriques seront renseignées lors d'une prochaine campagne d'inventaire.",
  reserveMarket: 'Cote du marché',
  reserveHolders: 'Détenteurs',
  reserveChronicle: 'Chronique du lieu',
  reservePending: 'À paraître',
  marketTitle: "Mise à l'offre",
  marketPriceLabel: 'Prix',
  marketPricePlaceholder: 'Prix en écus…',
  marketPriceInvalid: 'Entrez un prix entier entre 1 et 1 000 000.',
  marketSubmit: "Mettre à l'offre",
  marketPending: 'Mise à l’offre…',
  marketSuccess: 'Votre planche est à l’offre.',
  listedTitle: 'En vente',
  listedManage: 'Gérer mes ventes',
  lockedTitle: 'Planche verrouillée',
  lockedHint: 'Cette planche est engagée dans une vente en cours.',
  ownerLabel: 'Propriétaire',
  sellerLabel: 'Vendeur',
  anonymous: 'Anonyme',
  buy: 'Acquérir',
  buying: 'Achat en cours…',
  goCollection: 'Retour au cadastre',
} as const;

export const CARD_SOURCE_LABELS = {
  TICKET: 'Découverte au grattage',
  MARKET: 'Acquise au comptoir',
  REWARD: 'Récompense',
  CRAFT: 'Fondue à l’Atelier',
} as const;

export function stateLabel(locked: boolean, listed: boolean): string {
  if (listed) return 'En vente';
  if (locked) return 'Verrouillée';
  return 'Au cadastre';
}
