import { ACHIEVEMENT_PAYOUT_TOTAL } from '@hexamap/shared';

const numberFormatter = new Intl.NumberFormat('fr-FR');

export const ACHIEVEMENTS_ROOM = {
  eyebrow: 'Le registre des primes',
  title: 'Les Médailles',
  subtitle:
    'Chaque médaille verse des écus une seule fois, dès que son seuil est atteint. Rien ne se reprend, rien ne se rejoue.',
  loadingSession: 'Chargement de votre session…',
  loading: 'Chargement des médailles…',
  retry: 'Réessayer',
  errorTitle: 'Impossible de charger les médailles.',
  summaryTitle: 'Synthèse des primes',
  stateEarned: 'Obtenue',
  stateInProgress: 'En cours',
  stateUpcoming: 'À venir',
  payoutLabel: 'Prime',
  progressLabel: 'Progression',
  earnedOn: 'Obtenue le',
  suspended:
    'Les primes sont momentanément suspendues. Les médailles restent visibles ; les écus seront versés dès leur réactivation.',
  emptyFamily: 'Aucune médaille dans cette famille.',
} as const;

export type AchievementState = 'EARNED' | 'IN_PROGRESS' | 'UPCOMING';

export const ACHIEVEMENT_STATE_LABELS: Record<AchievementState, string> = {
  EARNED: ACHIEVEMENTS_ROOM.stateEarned,
  IN_PROGRESS: ACHIEVEMENTS_ROOM.stateInProgress,
  UPCOMING: ACHIEVEMENTS_ROOM.stateUpcoming,
};

export function achievementState(achievement: {
  progress: number | null;
  earnedAt: string | null;
}): AchievementState {
  if (achievement.earnedAt !== null) return 'EARNED';
  if (achievement.progress === null) return 'UPCOMING';
  return 'IN_PROGRESS';
}

export function ecusLabel(amount: number): string {
  return `${numberFormatter.format(amount)} ${amount === 1 ? 'écu' : 'écus'}`;
}

export function payoutSummaryLabel(earned: number): string {
  return `${numberFormatter.format(earned)} écus gagnés sur ${numberFormatter.format(ACHIEVEMENT_PAYOUT_TOTAL)}`;
}

export function earnedCountLabel(earned: number, total: number): string {
  const earnedText = earned === 1 ? '1 médaille obtenue' : `${earned} médailles obtenues`;
  return `${earnedText} sur ${total}`;
}

export function progressLabel(progress: number, threshold: number): string {
  return `${numberFormatter.format(progress)} / ${numberFormatter.format(threshold)}`;
}
