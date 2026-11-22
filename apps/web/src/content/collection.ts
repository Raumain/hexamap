export const COLLECTION = {
  eyebrow: 'Collection',
  title: 'Ma collection',
  subtitle: 'Retrouvez toutes vos cartes, triez-les et filtrez-les.',
  loadingSession: 'Chargement de votre session…',
  loading: 'Chargement de votre collection…',
  errorTitle: 'Impossible de charger votre collection.',
  retry: 'Réessayer',
  emptyTitle: 'Votre collection est vide.',
  emptyDescription: 'Grattez un ticket pour découvrir vos premières cartes.',
  goHome: 'Ouvrir un ticket',
  searchLabel: 'Recherche',
  searchPlaceholder: 'Rechercher une carte…',
  rarityLabel: 'Rareté',
  categoryLabel: 'Catégorie',
  allValues: 'Toutes',
  scrollAriaLabel: 'Liste des cartes de votre collection',
  locked: 'Verrouillée',
  columns: {
    nom: 'Carte',
    category: 'Catégorie',
    rarity: 'Rareté',
    score: 'Score',
    acquiredAt: 'Acquise le',
    state: 'État',
  },
} as const;

export function cardsShownLabel(shown: number, total: number): string {
  const shownText = shown === 1 ? '1 carte affichée' : `${shown} cartes affichées`;
  const totalText = total === 1 ? '1 carte' : `${total} cartes`;
  return `${shownText} sur ${totalText}`;
}

export function collectionTotalLabel(total: number): string {
  return total === 1 ? '1 carte au total' : `${total} cartes au total`;
}

export const COLLECTION_FILTERS = {
  summary: 'Filtres',
  categorie: 'Catégorie',
  rarete: 'Rareté',
  departement: 'Département',
  recherche: 'Recherche',
  departementAll: 'Tous les départements',
  departementHint:
    'Seules les cartes de département et de commune portent un département : les régions et les rues sont écartées par ce filtre.',
  recherchePlaceholder: 'Nom ou code de carte',
  reset: 'Réinitialiser les filtres',
} as const;

export const COLLECTION_FILTERED_EMPTY = {
  title: 'Aucune carte ne correspond à ces filtres',
  description: 'Modifiez ou réinitialisez les filtres pour retrouver votre collection.',
} as const;

/** Le compte filtré dit la même chose que le compte brut, sur le total de la collection. */
export function filteredCardsLabel(shown: number, total: number): string {
  return cardsShownLabel(shown, total);
}
