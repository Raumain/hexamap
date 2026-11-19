import {
  ACHIEVEMENT_FAMILIES,
  ACHIEVEMENT_FAMILY_LABELS,
  type AchievementFamily,
} from '@hexamap/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import {
  ACHIEVEMENT_STATE_LABELS,
  ACHIEVEMENTS_ROOM,
  type AchievementState,
  achievementState,
  earnedCountLabel,
  ecusLabel,
  payoutSummaryLabel,
  progressLabel,
} from '../content/achievements';
import type { AchievementView } from '../lib/achievements';
import { achievementsErrorMessage, achievementsQueryOptions } from '../lib/achievements';
import { sessionQueryKey, useSession } from '../lib/session';

const dateFormatter = new Intl.DateTimeFormat('fr-FR');

const STATE_CHIP_STYLES: Record<AchievementState, string> = {
  EARNED: 'border-brass/60 text-brass',
  IN_PROGRESS: 'border-verdigris/50 text-verdigris',
  UPCOMING: 'border-veil text-vellum/55',
};

const retryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale';

export const Route = createFileRoute('/achievements')({
  component: AchievementsPage,
});

function AchievementsPage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-sm text-vellum/70">{ACHIEVEMENTS_ROOM.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section>
      <header>
        <p className="salon-eyebrow">{ACHIEVEMENTS_ROOM.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {ACHIEVEMENTS_ROOM.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-vellum/70">
          {ACHIEVEMENTS_ROOM.subtitle}
        </p>
      </header>

      <AchievementsBoard />
    </section>
  );
}

function AchievementsBoard() {
  const query = useQuery(achievementsQueryOptions());
  const queryClient = useQueryClient();
  const total = query.data?.total;

  // Les médailles versent des écus côté serveur : une fois la réponse reçue, la
  // pastille de monnaie doit relire son solde. Une invalidation, jamais un fetch.
  useEffect(() => {
    if (total === undefined) return;
    void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
  }, [total, queryClient]);

  if (query.isPending) {
    return <p className="mt-8 text-sm text-vellum/70">{ACHIEVEMENTS_ROOM.loading}</p>;
  }

  if (query.isError) {
    return (
      <div className="mt-8 space-y-4 rounded-sheet border border-veil bg-cabinet-raised p-5 md:p-6">
        <h2 className="font-display text-xl font-semibold text-vellum">
          {ACHIEVEMENTS_ROOM.errorTitle}
        </h2>
        <div role="alert" className="text-sm text-danger">
          {achievementsErrorMessage(query.error)}
        </div>
        <button type="button" onClick={() => void query.refetch()} className={retryButtonClass}>
          {ACHIEVEMENTS_ROOM.retry}
        </button>
      </div>
    );
  }

  const view = query.data;
  const earnedCount = view.achievements.filter(
    (achievement) => achievement.earnedAt !== null,
  ).length;
  const families = ACHIEVEMENT_FAMILIES.map((family) => ({
    family,
    achievements: view.achievements.filter((achievement) => achievement.family === family),
  }));

  return (
    <div className="mt-8 space-y-10">
      {view.payoutsEnabled ? null : (
        <div
          role="status"
          className="rounded-sheet border border-brass/40 bg-cabinet-raised p-5 text-sm leading-relaxed text-vellum/80"
        >
          {ACHIEVEMENTS_ROOM.suspended}
        </div>
      )}

      <section
        aria-labelledby="achievement-summary"
        className="rounded-sheet border border-veil bg-cabinet-raised p-5 md:p-6"
      >
        <h2 id="achievement-summary" className="salon-eyebrow">
          {ACHIEVEMENTS_ROOM.summaryTitle}
        </h2>
        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
              {ACHIEVEMENTS_ROOM.payoutLabel}
            </dt>
            <dd className="mt-1 font-display text-lg leading-snug tabular-nums text-brass">
              {payoutSummaryLabel(view.total)}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
              {ACHIEVEMENTS_ROOM.stateEarned}
            </dt>
            <dd className="mt-1 font-display text-lg leading-snug tabular-nums text-vellum">
              {earnedCountLabel(earnedCount, view.achievements.length)}
            </dd>
          </div>
        </dl>
      </section>

      {families.map(({ family, achievements }) => (
        <FamilySection key={family} family={family} achievements={achievements} />
      ))}
    </div>
  );
}

interface FamilySectionProps {
  family: AchievementFamily;
  achievements: readonly AchievementView[];
}

function FamilySection({ family, achievements }: FamilySectionProps) {
  const headingId = `achievement-family-${family.toLowerCase()}`;
  const earnedCount = achievements.filter((achievement) => achievement.earnedAt !== null).length;

  return (
    <section aria-labelledby={headingId} className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-veil pb-2">
        <h2 id={headingId} className="font-display text-2xl font-semibold text-vellum">
          {ACHIEVEMENT_FAMILY_LABELS[family]}
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] tabular-nums text-vellum/55">
          {earnedCount} / {achievements.length}
        </p>
      </div>

      {achievements.length === 0 ? (
        <p className="text-sm text-vellum/60">{ACHIEVEMENTS_ROOM.emptyFamily}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {achievements.map((achievement) => (
            <AchievementCard key={achievement.key} achievement={achievement} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AchievementCard({ achievement }: { achievement: AchievementView }) {
  const state = achievementState(achievement);
  const progressValue = state === 'EARNED' ? achievement.threshold : achievement.progress;
  const percent =
    progressValue === null || achievement.threshold <= 0
      ? 0
      : Math.min(100, Math.max(0, Math.round((progressValue / achievement.threshold) * 100)));

  return (
    <li className="flex min-w-0 flex-col rounded-sheet border border-veil bg-cabinet-raised p-5">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 font-display text-lg leading-snug text-vellum">
          {achievement.label}
        </h3>
        <span
          className={`inline-flex shrink-0 items-center rounded-[2px] border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] ${STATE_CHIP_STYLES[state]}`}
        >
          {ACHIEVEMENT_STATE_LABELS[state]}
        </span>
      </div>

      <p className="mt-2 max-w-prose text-sm leading-relaxed text-vellum/70">
        {achievement.description}
      </p>

      <div className="mt-4 flex items-baseline justify-between gap-3 border-t border-veil pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
          {ACHIEVEMENTS_ROOM.payoutLabel}
        </span>
        <span className="font-display text-xl tabular-nums text-brass">
          {ecusLabel(achievement.payout)}
        </span>
      </div>

      {progressValue === null ? null : (
        <div className="mt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
              {ACHIEVEMENTS_ROOM.progressLabel}
            </span>
            <span className="font-mono text-[10px] tabular-nums text-vellum/70">
              {progressLabel(progressValue, achievement.threshold)}
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={achievement.threshold}
            aria-valuenow={progressValue}
            aria-label={`${achievement.label} : ${progressLabel(progressValue, achievement.threshold)}`}
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-cabinet-sunk"
          >
            <div className="h-full rounded-full bg-brass" style={{ width: `${percent}%` }} />
          </div>
        </div>
      )}

      {state === 'EARNED' && achievement.earnedAt ? (
        <p className="mt-3 font-mono text-[10px] tabular-nums text-vellum/55">
          {ACHIEVEMENTS_ROOM.earnedOn} {dateFormatter.format(new Date(achievement.earnedAt))}
        </p>
      ) : null}
    </li>
  );
}
