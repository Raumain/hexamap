const multiplierFormatter = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export const TABLEAU = {
  eyebrow: 'Tableau',
  title: 'Constructeur de combos',
  subtitle:
    'Assemblez une région, un département, une commune et une rue pour débloquer un multiplicateur de score.',
  loadingSession: 'Chargement de votre session…',
  loading: 'Chargement de votre collection…',
  retry: 'Réessayer',
  collectionError: 'Impossible de charger votre collection.',
  emptyCollectionTitle: 'Votre collection est vide.',
  emptyCollectionDescription: 'Grattez un ticket pour découvrir vos premières cartes.',
  slotChoose: 'Choisir une carte',
  slotModify: 'Modifier',
  slotEmpty: 'Aucune carte sélectionnée.',
  drawerClose: 'Fermer',
  searchLabel: 'Recherche',
  searchPlaceholder: 'Rechercher une carte…',
  noResults: 'Aucune carte éligible pour cet emplacement.',
  usedElsewhere: 'Déjà placée',
  multiplierTitle: 'Multiplicateur',
  linksTitle: 'Liens géographiques',
  scoreTitle: 'Détail du score',
  subTotal: 'Sous-total',
  multiplierLine: 'Multiplicateur',
  totalLine: 'Total',
  incompleteHint: 'Complétez les 4 emplacements pour connaître le score final.',
  nameLabel: 'Nom du tableau (optionnel)',
  namePlaceholder: 'Mon combo régional…',
  save: 'Enregistrer le tableau',
  recalculating: 'Recalcul…',
  successEyebrow: 'Tableau enregistré',
  successTitle: 'Votre tableau est prêt !',
  createAnother: 'Créer un autre tableau',
} as const;

export interface MultiplierTier {
  title: string;
  hint: string;
  badgeClass: string;
  panelClass: string;
  surfaceClass: string;
}

/**
 * Palier visuel indexé par le nombre de liens validés (0..3).
 * La valeur du multiplicateur n'est JAMAIS lue ici : elle vient de
 * `evaluateTableauAlignment` / `alignmentMultiplier` dans `@hexamap/shared`.
 */
export const MULTIPLIER_TIERS: readonly [
  MultiplierTier,
  MultiplierTier,
  MultiplierTier,
  MultiplierTier,
] = [
  {
    title: 'Aucun lien',
    hint: 'Reliez vos cartes pour augmenter le multiplicateur.',
    badgeClass: 'border-slate-600 bg-slate-800 text-slate-300',
    panelClass: 'border-slate-800 bg-slate-900/60',
    surfaceClass: 'text-slate-400',
  },
  {
    title: 'Premier lien',
    hint: 'Une première connexion géographique validée.',
    badgeClass: 'border-sky-600 bg-sky-900/60 text-sky-300',
    panelClass: 'border-sky-700/60 bg-sky-900/20',
    surfaceClass: 'text-sky-300',
  },
  {
    title: 'Deux liens',
    hint: 'Deux connexions validées, le multiplicateur grimpe.',
    badgeClass: 'border-violet-600 bg-violet-900/60 text-violet-300',
    panelClass: 'border-violet-700/60 bg-violet-900/20',
    surfaceClass: 'text-violet-300',
  },
  {
    title: 'Combo géographique complet',
    hint: 'Les quatre cartes forment un ensemble parfait.',
    badgeClass: 'border-amber-400 bg-amber-400/10 text-amber-300',
    panelClass:
      'border-amber-400/60 bg-amber-400/10 ring-2 ring-amber-400/60 shadow-[0_0_50px_-12px_rgba(251,191,36,0.8)] scale-[1.02]',
    surfaceClass: 'text-amber-300',
  },
];

/** Le multiplicateur affiché vient de la valeur calculée, jamais d'une table. */
export function multiplierLabel(multiplier: number): string {
  return `×${multiplierFormatter.format(multiplier)}`;
}

export function linksLabel(links: number): string {
  return links === 1 ? '1 lien' : `${links} liens`;
}

export function multiplierAnnouncement(multiplier: number, links: number): string {
  const linksText = links === 1 ? '1 lien géographique' : `${links} liens géographiques`;
  return `Multiplicateur ${multiplierLabel(multiplier)} — ${linksText} sur 3`;
}

export function drawerTitleLabel(slotLabel: string): string {
  return `Choisir une carte — ${slotLabel}`;
}

export function resultsLabel(count: number): string {
  return count === 1 ? '1 carte éligible' : `${count} cartes éligibles`;
}

export function removeCardAria(cardName: string): string {
  return `Retirer la carte ${cardName}`;
}

export const TABLEAUX_LIST = {
  eyebrow: 'Mes tableaux',
  title: 'Mes tableaux',
  subtitle:
    'Retrouvez tous vos combos régionaux et comparez leurs scores, multiplicateurs et dates.',
  loadingSession: 'Chargement de votre session…',
  loading: 'Chargement de vos tableaux…',
  retry: 'Réessayer',
  emptyTitle: 'Aucun tableau pour le moment.',
  emptyDescription: 'Assemblez votre premier combo pour le retrouver ici.',
  create: 'Créer un tableau',
  viewBuilder: 'Voir le constructeur',
  viewList: 'Voir mes tableaux',
  sortLabel: 'Trier par',
  sortScore: 'Score total',
  sortMultiplier: 'Multiplicateur',
  sortRecent: 'Plus récents',
  scoreLabel: 'Score total',
  unnamed: 'Tableau sans nom',
  incomplete: 'Incomplet',
  emptySlot: 'Emplacement vide',
  linksTitle: 'Liens géographiques',
  linkValid: 'Lien validé',
  linkInvalid: 'Lien non validé',
} as const;

export function rankLabel(rank: number): string {
  return `#${rank}`;
}

export function tableauxCountLabel(count: number): string {
  return count === 1 ? '1 tableau' : `${count} tableaux`;
}
