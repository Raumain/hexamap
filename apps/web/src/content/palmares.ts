const pointsFormatter = new Intl.NumberFormat('fr-FR');

export const PALMARES = {
  eyebrow: 'CLASSEMENT HEBDOMADAIRE',
  title: 'Le Palmarès',
  subtitle:
    'Les meilleurs tableaux de la semaine, classés par score figé au moment de la soumission.',
  loadingSession: 'Chargement de votre session…',
  loading: 'Chargement du classement…',
  retry: 'Réessayer',
  emptyTitle: 'Aucun tableau classé cette semaine.',
  emptyDescription: 'Composez une planche pour ouvrir le classement de la semaine.',
  currentWeek: 'Semaine en cours',
  pastWeek: 'Semaine close',
  pointsSuffix: 'pts',
  cardsLabel: 'Cartels du tableau',
  rankPrefix: 'Rang',
} as const;

/** « Semaine 2026-W47 · en cours » — la semaine vient du serveur, jamais du navigateur. */
export function palmaresWeekLabel(week: string, current: boolean): string {
  return `Semaine ${week} · ${current ? PALMARES.currentWeek : PALMARES.pastWeek}`;
}

export function palmaresCountLabel(count: number): string {
  return count === 1 ? '1 tableau classé' : `${count} tableaux classés`;
}

export function palmaresPoints(score: number): string {
  return `${pointsFormatter.format(score)} ${PALMARES.pointsSuffix}`;
}
