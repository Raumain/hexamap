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
