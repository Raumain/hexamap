const integerFr = new Intl.NumberFormat('fr-FR');
const decimalFr = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** La copie de la salle. Aucun libellé de rareté : ils viennent de `RARITY_LABELS`. */
export const RARETE = {
  eyebrow: 'Le barème',
  title: 'Les Raretés',
  subtitle:
    'Pourquoi une commune est « Peu commune », pourquoi une rue peut valoir plus qu’une métropole : les six paliers, leurs seuils et les deux formules, tels que le serveur les applique.',
  tiers: {
    heading: 'Les six paliers',
    intro:
      'Chaque case grattée tire d’abord une catégorie, puis un palier de rareté, puis une carte au hasard dans ce palier. Les six poids ci-dessous se partagent le tirage.',
    columns: { rarity: 'Palier', weight: 'Chance au tirage' },
    total: 'Total',
    totalNote:
      'La somme des six paliers fait exactement 100 % : aucune part du tirage n’est perdue.',
  },
  categories: {
    heading: 'Les quatre catégories',
    intro:
      'Avant le palier, c’est la catégorie qui est tirée. Une rue sort plus souvent qu’une région, mais elle ne vaut pas la même chose.',
    columns: { category: 'Catégorie', weight: 'Chance au tirage' },
  },
  commune: {
    heading: 'Une commune : sa population',
    intro:
      'La rareté d’une commune est lue dans sa population municipale INSEE. Elle ne change jamais : un village reste un village.',
    columns: { rarity: 'Palier', range: 'Population municipale' },
  },
  rue: {
    heading: 'Une rue : le nombre de communes',
    intro:
      'La rareté d’une rue est lue dans le nombre de communes qui portent ce nom de voie. Plus le nom est rare, plus la carte vaut cher.',
    columns: { rarity: 'Palier', range: 'Communes portant ce nom' },
  },
  formulas: {
    heading: 'Les deux formules',
    intro:
      'Le score d’une carte est calculé par le serveur au moment où elle est découverte. Il n’est jamais recalculé par le navigateur.',
    communeLabel: 'Score d’une commune',
    communeFormula: '100 × log₁₀(max(P, 10))²',
    communeNote: 'P est la population, avec un plancher à 10 habitants.',
    rueLabel: 'Score d’une rue',
    rueFormula: '3 000 ÷ (1 + log₁₀(max(N, 1)))',
    rueNote: 'N est le nombre de communes qui portent ce nom de voie.',
    rounding: 'Le résultat est arrondi à l’entier le plus proche.',
  },
  examples: {
    heading: 'Les exemples du barème',
    intro: 'Quelques valeurs de référence, telles qu’elles sortent des deux formules.',
    communeTitle: 'Une commune',
    rueTitle: 'Une rue',
  },
  inverted: {
    heading: 'La rareté inversée des rues',
  },
} as const;

export function weightLabel(weight: number): string {
  return `${decimalFr.format(weight)} %`;
}

export function pointsLabel(points: number): string {
  return `${integerFr.format(points)} pts`;
}

export function populationLabel(population: number): string {
  return population === 1 ? '1 habitant' : `${integerFr.format(population)} habitants`;
}

export function communesLabel(count: number): string {
  return count === 1 ? '1 commune' : `${integerFr.format(count)} communes`;
}

/** « moins de 1 000 habitants », « 1 000 à 4 999 habitants », « 250 000 et plus ». */
export function populationRangeLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'toutes les populations';
  if (min === null && max !== null) return `moins de ${populationLabel(max + 1)}`;
  if (min !== null && max === null) return `${populationLabel(min)} et plus`;
  if (min !== null && max !== null && min === max) return populationLabel(min);
  if (min !== null && max !== null) {
    return `${integerFr.format(min)} à ${populationLabel(max)}`;
  }
  return 'population inconnue';
}

/** « plus de 500 communes », « 100 à 500 communes », « 1 commune ». */
export function communesRangeLabel(min: number | null, max: number | null): string {
  if (min === null && max === null) return 'toutes les communes';
  if (min === null && max !== null) return `au plus ${communesLabel(max)}`;
  if (min !== null && max === null) return `plus de ${communesLabel(min - 1)}`;
  if (min !== null && max !== null && min === max) return communesLabel(min);
  if (min !== null && max !== null) {
    return `${integerFr.format(min)} à ${communesLabel(max)}`;
  }
  return 'nombre de communes inconnu';
}

/**
 * Le paragraphe de `.docs/01-architecture.md` §2.7. Les deux scores sont lus
 * dans `RUE_SCORE_EXAMPLES`, jamais écrits à la main.
 */
export function rueInvertedParagraph(singleCommuneScore: number, widespreadScore: number): string {
  return [
    `Une rue qui n’existe que dans une seule commune vaut ${pointsLabel(singleCommuneScore)}, le sommet du barème.`,
    `La même voie, présente dans dix mille communes, n’en vaut plus que ${pointsLabel(widespreadScore)}.`,
    'Plus un nom de voie est rare, plus la carte qu’il donne vaut cher : c’est la rareté inversée des rues, et elle fait d’un village à rue unique un tableau qui rivalise avec une métropole.',
  ].join(' ');
}
