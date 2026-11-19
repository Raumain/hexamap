export const ACHIEVEMENT_FAMILIES = [
  'SCRATCH',
  'COLLECTION',
  'TABLEAU',
  'MARKET',
  'SOCIAL',
  'ATTENDANCE',
] as const;

export type AchievementFamily = (typeof ACHIEVEMENT_FAMILIES)[number];

// Libellés français des familles, consommés par le serveur et par l'écran des médailles.
export const ACHIEVEMENT_FAMILY_LABELS: Record<AchievementFamily, string> = {
  SCRATCH: 'Grattage',
  COLLECTION: 'Collection',
  TABLEAU: 'La Planche',
  MARKET: 'Le Comptoir',
  SOCIAL: 'Social',
  ATTENDANCE: 'Assiduité',
};

export const ACHIEVEMENT_METRICS = [
  'ticketsScratched',
  'pepitesFound',
  'mythiqueFromTicket',
  'cardsOwned',
  'regionsOwned',
  'departementsOwned',
  'raritiesOwned',
  'uniqueRue',
  'tableauxCount',
  'bestMultiplierTenths',
  'bestTableauScore',
  'salesCount',
  'purchasesCount',
  'ecusEarned',
  'bestPurchase',
  'friendsAccepted',
  'profileComplete',
  'consecutiveDays',
] as const;

export type AchievementMetric = (typeof ACHIEVEMENT_METRICS)[number];

export interface AchievementDefinition {
  readonly key: string;
  readonly family: AchievementFamily;
  readonly metric: AchievementMetric;
  readonly threshold: number;
  readonly payout: number;
  readonly label: string;
  readonly description: string;
}

// Catalogue unique des médailles : aucune prime ne se modifie depuis un écran d'administration.
export const ACHIEVEMENTS: readonly AchievementDefinition[] = [
  {
    key: 'SCRATCH_FIRST_TICKET',
    family: 'SCRATCH',
    metric: 'ticketsScratched',
    threshold: 1,
    payout: 100,
    label: 'Premier ticket gratté',
    description: 'Gratter votre premier ticket du Relevé Topographique.',
  },
  {
    key: 'SCRATCH_TICKETS_10',
    family: 'SCRATCH',
    metric: 'ticketsScratched',
    threshold: 10,
    payout: 250,
    label: 'Dix tickets grattés',
    description: 'Gratter dix tickets.',
  },
  {
    key: 'SCRATCH_TICKETS_50',
    family: 'SCRATCH',
    metric: 'ticketsScratched',
    threshold: 50,
    payout: 500,
    label: 'Cinquante tickets grattés',
    description: 'Gratter cinquante tickets.',
  },
  {
    key: 'SCRATCH_TICKETS_100',
    family: 'SCRATCH',
    metric: 'ticketsScratched',
    threshold: 100,
    payout: 1000,
    label: 'Cent tickets grattés',
    description: 'Gratter cent tickets.',
  },
  {
    key: 'SCRATCH_TICKETS_500',
    family: 'SCRATCH',
    metric: 'ticketsScratched',
    threshold: 500,
    payout: 2500,
    label: 'Cinq cents tickets grattés',
    description: 'Gratter cinq cents tickets.',
  },
  {
    key: 'SCRATCH_TICKETS_1000',
    family: 'SCRATCH',
    metric: 'ticketsScratched',
    threshold: 1000,
    payout: 5000,
    label: 'Mille tickets grattés',
    description: 'Gratter mille tickets.',
  },
  {
    key: 'SCRATCH_FIRST_PEPITE',
    family: 'SCRATCH',
    metric: 'pepitesFound',
    threshold: 1,
    payout: 150,
    label: 'Première Pépite',
    description: 'Découvrir votre première Pépite.',
  },
  {
    key: 'SCRATCH_PEPITES_10',
    family: 'SCRATCH',
    metric: 'pepitesFound',
    threshold: 10,
    payout: 750,
    label: 'Dix Pépites',
    description: 'Découvrir dix Pépites.',
  },
  {
    key: 'SCRATCH_MYTHIQUE',
    family: 'SCRATCH',
    metric: 'mythiqueFromTicket',
    threshold: 1,
    payout: 2000,
    label: "Une Mythique sortie d'un ticket",
    description: 'Tirer une carte Mythique depuis un ticket.',
  },
  {
    key: 'COLLECTION_CARDS_10',
    family: 'COLLECTION',
    metric: 'cardsOwned',
    threshold: 10,
    payout: 200,
    label: 'Dix cartes',
    description: 'Posséder dix cartes.',
  },
  {
    key: 'COLLECTION_CARDS_50',
    family: 'COLLECTION',
    metric: 'cardsOwned',
    threshold: 50,
    payout: 500,
    label: 'Cinquante cartes',
    description: 'Posséder cinquante cartes.',
  },
  {
    key: 'COLLECTION_CARDS_100',
    family: 'COLLECTION',
    metric: 'cardsOwned',
    threshold: 100,
    payout: 1200,
    label: 'Cent cartes',
    description: 'Posséder cent cartes.',
  },
  {
    key: 'COLLECTION_CARDS_500',
    family: 'COLLECTION',
    metric: 'cardsOwned',
    threshold: 500,
    payout: 4000,
    label: 'Cinq cents cartes',
    description: 'Posséder cinq cents cartes.',
  },
  {
    key: 'COLLECTION_REGIONS_18',
    family: 'COLLECTION',
    metric: 'regionsOwned',
    threshold: 18,
    payout: 3000,
    label: 'Les 18 régions',
    description: 'Réunir les dix-huit régions.',
  },
  {
    key: 'COLLECTION_DEPARTEMENTS_101',
    family: 'COLLECTION',
    metric: 'departementsOwned',
    threshold: 101,
    payout: 15000,
    label: 'Les 101 départements',
    description: 'Réunir les cent un départements.',
  },
  {
    key: 'COLLECTION_SIX_RARITIES',
    family: 'COLLECTION',
    metric: 'raritiesOwned',
    threshold: 6,
    payout: 1500,
    label: 'Une carte de chaque rareté',
    description: 'Posséder au moins une carte de chacun des six paliers de rareté.',
  },
  {
    key: 'COLLECTION_UNIQUE_RUE',
    family: 'COLLECTION',
    metric: 'uniqueRue',
    threshold: 1,
    payout: 2500,
    label: 'Une rue unique en France',
    description: 'Posséder une rue qui n’existe que dans une seule commune.',
  },
  {
    key: 'TABLEAU_FIRST',
    family: 'TABLEAU',
    metric: 'tableauxCount',
    threshold: 1,
    payout: 100,
    label: 'Premier tableau',
    description: 'Composer votre premier tableau.',
  },
  {
    key: 'TABLEAU_MULTIPLIER_15',
    family: 'TABLEAU',
    metric: 'bestMultiplierTenths',
    threshold: 15,
    payout: 200,
    label: 'Multiplicateur ×1,5',
    description: 'Atteindre un multiplicateur d’alignement de ×1,5.',
  },
  {
    key: 'TABLEAU_MULTIPLIER_25',
    family: 'TABLEAU',
    metric: 'bestMultiplierTenths',
    threshold: 25,
    payout: 500,
    label: 'Multiplicateur ×2,5',
    description: 'Atteindre un multiplicateur d’alignement de ×2,5.',
  },
  {
    key: 'TABLEAU_MULTIPLIER_50',
    family: 'TABLEAU',
    metric: 'bestMultiplierTenths',
    threshold: 50,
    payout: 1500,
    label: 'Multiplicateur ×5',
    description: 'Atteindre le combo complet, un multiplicateur de ×5.',
  },
  {
    key: 'TABLEAU_SCORE_5000',
    family: 'TABLEAU',
    metric: 'bestTableauScore',
    threshold: 5000,
    payout: 500,
    label: 'Tableau à 5 000 points',
    description: 'Faire scorer un tableau à 5 000 points.',
  },
  {
    key: 'TABLEAU_SCORE_10000',
    family: 'TABLEAU',
    metric: 'bestTableauScore',
    threshold: 10000,
    payout: 1500,
    label: 'Tableau à 10 000 points',
    description: 'Faire scorer un tableau à 10 000 points.',
  },
  {
    key: 'TABLEAU_SCORE_15000',
    family: 'TABLEAU',
    metric: 'bestTableauScore',
    threshold: 15000,
    payout: 4000,
    label: 'Tableau à 15 000 points',
    description: 'Faire scorer un tableau à 15 000 points.',
  },
  {
    key: 'MARKET_FIRST_SALE',
    family: 'MARKET',
    metric: 'salesCount',
    threshold: 1,
    payout: 150,
    label: 'Première vente',
    description: 'Vendre votre première carte au Comptoir.',
  },
  {
    key: 'MARKET_FIRST_PURCHASE',
    family: 'MARKET',
    metric: 'purchasesCount',
    threshold: 1,
    payout: 150,
    label: 'Premier achat',
    description: 'Acheter votre première carte au Comptoir.',
  },
  {
    key: 'MARKET_SALES_10',
    family: 'MARKET',
    metric: 'salesCount',
    threshold: 10,
    payout: 500,
    label: 'Dix ventes',
    description: 'Vendre dix cartes.',
  },
  {
    key: 'MARKET_SALES_100',
    family: 'MARKET',
    metric: 'salesCount',
    threshold: 100,
    payout: 3000,
    label: 'Cent ventes',
    description: 'Vendre cent cartes.',
  },
  {
    key: 'MARKET_ECUS_EARNED_10000',
    family: 'MARKET',
    metric: 'ecusEarned',
    threshold: 10000,
    payout: 2000,
    label: '10 000 écus gagnés en ventes',
    description: 'Gagner 10 000 écus de ventes au Comptoir.',
  },
  {
    key: 'MARKET_PURCHASE_1000',
    family: 'MARKET',
    metric: 'bestPurchase',
    threshold: 1000,
    payout: 300,
    label: 'Un achat à 1 000 écus',
    description: 'Acheter une carte pour 1 000 écus.',
  },
  {
    key: 'SOCIAL_FIRST_FRIEND',
    family: 'SOCIAL',
    metric: 'friendsAccepted',
    threshold: 1,
    payout: 100,
    label: 'Premier ami',
    description: 'Compter votre premier ami accepté.',
  },
  {
    key: 'SOCIAL_FRIENDS_10',
    family: 'SOCIAL',
    metric: 'friendsAccepted',
    threshold: 10,
    payout: 500,
    label: 'Dix amis',
    description: 'Compter dix amis.',
  },
  {
    key: 'SOCIAL_FRIENDS_50',
    family: 'SOCIAL',
    metric: 'friendsAccepted',
    threshold: 50,
    payout: 2000,
    label: 'Cinquante amis',
    description: 'Compter cinquante amis.',
  },
  {
    key: 'SOCIAL_FRIENDS_100',
    family: 'SOCIAL',
    metric: 'friendsAccepted',
    threshold: 100,
    payout: 5000,
    label: 'Cent amis',
    description: 'Compter cent amis.',
  },
  {
    key: 'SOCIAL_PROFILE_COMPLETE',
    family: 'SOCIAL',
    metric: 'profileComplete',
    threshold: 1,
    payout: 100,
    label: 'Profil public complet',
    description: 'Renseigner votre profil public.',
  },
  {
    key: 'ATTENDANCE_7_DAYS',
    family: 'ATTENDANCE',
    metric: 'consecutiveDays',
    threshold: 7,
    payout: 700,
    label: 'Sept jours consécutifs',
    description: 'Revenir sept jours consécutifs.',
  },
  {
    key: 'ATTENDANCE_30_DAYS',
    family: 'ATTENDANCE',
    metric: 'consecutiveDays',
    threshold: 30,
    payout: 3000,
    label: 'Trente jours consécutifs',
    description: 'Revenir trente jours consécutifs.',
  },
];

export const ACHIEVEMENT_PAYOUT_TOTAL = ACHIEVEMENTS.reduce(
  (total, achievement) => total + achievement.payout,
  0,
);

// Une métrique `null` signifie « inconnue » : la médaille concernée reste verrouillée.
export type AchievementMetrics = { readonly [M in AchievementMetric]: number | null };

export function achievementsByFamily(): ReadonlyArray<{
  family: AchievementFamily;
  label: string;
  achievements: readonly AchievementDefinition[];
}> {
  return ACHIEVEMENT_FAMILIES.map((family) => ({
    family,
    label: ACHIEVEMENT_FAMILY_LABELS[family],
    achievements: ACHIEVEMENTS.filter((achievement) => achievement.family === family),
  }));
}

export function achievementProgress(metrics: AchievementMetrics): Record<string, number | null> {
  const progress: Record<string, number | null> = {};
  for (const achievement of ACHIEVEMENTS) {
    progress[achievement.key] = metrics[achievement.metric];
  }
  return progress;
}

export function newlyEarned(
  metrics: AchievementMetrics,
  unlocked: ReadonlySet<string>,
): AchievementDefinition[] {
  return ACHIEVEMENTS.filter((achievement) => {
    if (unlocked.has(achievement.key)) return false;
    const value = metrics[achievement.metric];
    return value !== null && value >= achievement.threshold;
  });
}

/** Seules les amitiés ACCEPTED comptent (Archi §2.9) ; PENDING et DECLINED sont ignorées. */
export function countAcceptedFriends(statuses: readonly string[]): number {
  return statuses.filter((status) => status === 'ACCEPTED').length;
}
