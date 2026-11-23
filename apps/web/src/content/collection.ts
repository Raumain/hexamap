import {
  CRAFT_THRESHOLD,
  nextCraftRarity,
  RARITY,
  RARITY_LABELS,
  type Rarity,
} from '@hexamap/shared';

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

/** Marque d'un groupe d'exemplaires : jamais affichée pour un groupe d'un seul. */
export function exemplairesMark(count: number): string {
  return `×${count}`;
}

export function exemplairesCountLabel(count: number): string {
  if (count === 0) return 'Aucun exemplaire';
  return count === 1 ? '1 exemplaire' : `${count} exemplaires`;
}

export function collectionGroupsLabel(
  shownCards: number,
  groups: number,
  totalCards: number,
): string {
  const groupsText = groups === 1 ? '1 groupe' : `${groups} groupes`;
  return `${cardsShownLabel(shownCards, totalCards)} · ${groupsText}`;
}

export const ATELIER = {
  title: "L'Atelier",
  emptyTitle: 'Aucune grappe à fusionner.',
  action: 'Fondre',
  confirmTitle: 'Confirmer la fusion',
  confirm: 'Confirmer la fusion',
  cancel: 'Annuler',
} as const;

/**
 * La règle de fusion, lue sur `packages/shared/src/atelier.ts` et jamais recopiée.
 * Le palier plafond et le palier jamais produit sont **calculés** : écrire « 3 »
 * ou « Mythique » en dur ici ferait diverger le texte de la règle.
 */
export function atelierRuleLabel(): string {
  const produced = RARITY.flatMap((rarity) => {
    const next = nextCraftRarity(rarity);
    return next === null ? [] : [next];
  });
  const top = produced.reduce<Rarity | null>((_, rarity) => rarity, null);
  const neverProduced = RARITY.filter(
    (rarity) => nextCraftRarity(rarity) === null && !produced.includes(rarity),
  ).reduce<Rarity | null>((_, rarity) => rarity, null);

  const topLabel = top === null ? '' : RARITY_LABELS[top];
  const neverLabel = neverProduced === null ? '' : RARITY_LABELS[neverProduced];
  return (
    `${CRAFT_THRESHOLD} exemplaires identiques d'une même carte donnent une carte du palier suivant. ` +
    `Le palier le plus haut que la fusion produit est ${topLabel} ; aucune carte ${neverLabel} n'en sort.`
  );
}

/** Ce qu'il faut réunir pour ouvrir une grappe, seuil compris. */
export function atelierEmptyHint(): string {
  return `Réunissez ${CRAFT_THRESHOLD} exemplaires de la même carte, dans la même rareté, pour ouvrir une grappe.`;
}

export function atelierResultLabel(
  nom: string,
  targetRarityLabel: string,
  score: number,
  count: number,
): string {
  const points = new Intl.NumberFormat('fr-FR').format(score);
  return `${count} × ${nom} → 1 carte ${targetRarityLabel} · ${points} pts`;
}

export function atelierSuccessMessage(nom: string, rarityLabel: string): string {
  return `Fusion réussie : une carte ${rarityLabel} de ${nom}.`;
}
