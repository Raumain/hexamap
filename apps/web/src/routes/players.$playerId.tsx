import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Navigate, useRouter } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { outlineButtonClass } from '../components/ui/button-classes';
import { SessionUnavailable } from '../components/ui/session-unavailable';
import { PLAYER_PROFILE } from '../content/player-profile';
import { CATEGORY_LABELS } from '../content/tickets';
import {
  type PlayerProfile,
  playerProfileErrorMessage,
  playerProfileQueryOptions,
} from '../lib/player-profile';
import { useSessionState } from '../lib/session';

const scoreFormatter = new Intl.NumberFormat('fr-FR');
const multiplierFormatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const longDateFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const Route = createFileRoute('/players/$playerId')({
  component: PlayerProfilePage,
});

function PlayerProfilePage() {
  const { playerId } = Route.useParams();
  const session = useSessionState();

  if (session.status === 'loading') {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/70">
        {PLAYER_PROFILE.loadingSession}
      </p>
    );
  }

  if (session.status === 'unavailable') {
    return <SessionUnavailable onRetry={session.retry} />;
  }

  if (session.status === 'anonymous') {
    return <Navigate to="/login" />;
  }

  return <PlayerProfileView playerId={playerId} />;
}

function PlayerProfileView({ playerId }: { playerId: string }) {
  const router = useRouter();
  const profileQuery = useQuery(playerProfileQueryOptions(playerId));

  if (profileQuery.isPending) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/70">
        {PLAYER_PROFILE.loading}
      </p>
    );
  }

  if (profileQuery.isError) {
    return (
      <section className="space-y-5 rounded-sheet border border-veil bg-cabinet-raised p-6 md:p-8">
        <p role="alert" className="font-display text-lg text-vellum">
          {playerProfileErrorMessage(profileQuery.error)}
        </p>
        <button
          type="button"
          onClick={() => void profileQuery.refetch()}
          className={outlineButtonClass}
        >
          {PLAYER_PROFILE.retry}
        </button>
      </section>
    );
  }

  const player = profileQuery.data;
  const friendState = player.friendState;

  return (
    <section className="space-y-10">
      <header>
        <div className="flex items-start justify-between gap-4">
          <p className="salon-eyebrow">{PLAYER_PROFILE.eyebrow}</p>
          <button
            type="button"
            onClick={() => router.history.back()}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/65 transition-colors duration-150 hover:text-brass"
          >
            <span aria-hidden="true">←</span> {PLAYER_PROFILE.back}
          </button>
        </div>

        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {player.displayName}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 font-mono text-[10px] tabular-nums uppercase tracking-[0.18em] text-vellum/70">
          {PLAYER_PROFILE.memberSinceLabel} {memberSinceLabel(player.memberSince)}
        </p>
      </header>

      {player.bio ? (
        <section className="vellum rounded-sheet p-6 md:p-8">
          <p className="max-w-[68ch] font-display text-lg leading-relaxed text-ink">{player.bio}</p>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        <CountersSheet player={player} />
        <CompletenessSheet player={player} />
        <BestTableauSheet player={player} />
        <MedalsSheet player={player} />
      </div>

      {friendState !== null && friendState !== 'SELF' ? (
        <FriendControl state={friendState} />
      ) : null}
    </section>
  );
}

function memberSinceLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : longDateFormatter.format(date);
}

function Sheet({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-sheet border border-veil bg-cabinet-raised p-6 md:p-7">
      <h2 className="font-display text-xl text-vellum">{title}</h2>
      {children}
    </section>
  );
}

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sheet border border-veil bg-cabinet-raised p-4 md:p-5">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">{label}</p>
      <p className="mt-2 font-display text-3xl tabular-nums text-vellum">
        {scoreFormatter.format(value)}
      </p>
    </div>
  );
}

function CountersSheet({ player }: { player: PlayerProfile }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Counter label={PLAYER_PROFILE.listingsLabel} value={player.openListings} />
      <Counter label={PLAYER_PROFILE.friendsLabel} value={player.friendCount} />
    </div>
  );
}

function CompletenessSheet({ player }: { player: PlayerProfile }) {
  return (
    <Sheet title={PLAYER_PROFILE.completenessTitle}>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
        {PLAYER_PROFILE.cardsLabel} · {scoreFormatter.format(player.cardsOwned)}
      </p>

      <div className="mt-5 grid grid-cols-2 gap-3">
        {player.completeness.map((entry) => (
          <div key={entry.category} className="rounded-[2px] border border-veil-strong/60 p-3">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/60">
              {CATEGORY_LABELS[entry.category]}
            </p>
            <p className="mt-1 font-display text-lg tabular-nums text-vellum">
              {scoreFormatter.format(entry.owned)}
              <span className="text-vellum/45"> / {scoreFormatter.format(entry.total)}</span>
            </p>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

function BestTableauSheet({ player }: { player: PlayerProfile }) {
  const best = player.bestTableau;

  return (
    <Sheet title={PLAYER_PROFILE.bestTableauTitle}>
      {best === null ? (
        <p className="mt-4 font-display italic text-vellum/60">{PLAYER_PROFILE.bestTableauEmpty}</p>
      ) : (
        <div className="mt-5 space-y-3">
          <p className="font-display text-lg text-vellum">{best.name}</p>
          <p className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-display text-3xl tabular-nums text-brass">
              {scoreFormatter.format(best.score)}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/60">
              {PLAYER_PROFILE.pts}
            </span>
            <span className="font-mono text-[12px] tabular-nums text-vellum/70">
              ×{multiplierFormatter.format(best.multiplier)}
            </span>
          </p>
        </div>
      )}
    </Sheet>
  );
}

function MedalsSheet({ player }: { player: PlayerProfile }) {
  return (
    <Sheet title={PLAYER_PROFILE.medalsTitle}>
      {player.achievements.length === 0 ? (
        <p className="mt-4 font-display italic text-vellum/60">{PLAYER_PROFILE.medalsEmpty}</p>
      ) : (
        <ul className="mt-5 space-y-4">
          {player.achievements.map((key) => (
            <li key={key} className="space-y-2">
              <div aria-hidden="true" className="brass-rule w-10" />
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-vellum/80">
                {key}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function friendActionLabel(state: NonNullable<PlayerProfile['friendState']>): string {
  switch (state) {
    case 'PENDING_SENT':
      return PLAYER_PROFILE.friendPending;
    case 'PENDING_RECEIVED':
      return PLAYER_PROFILE.friendAccept;
    case 'FRIENDS':
      return PLAYER_PROFILE.friendFriends;
    default:
      return PLAYER_PROFILE.friendAdd;
  }
}

function FriendControl({ state }: { state: NonNullable<PlayerProfile['friendState']> }) {
  // Les routes d'amitié appartiennent à la phase 28 : le contrôle est nommé mais reste désarmé.
  return (
    <div>
      <button
        type="button"
        disabled
        title={PLAYER_PROFILE.friendUnavailable}
        className={outlineButtonClass}
      >
        {friendActionLabel(state)}
      </button>
    </div>
  );
}
