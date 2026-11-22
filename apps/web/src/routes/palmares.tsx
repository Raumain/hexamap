import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { outlineButtonClass } from '../components/ui/button-classes';
import { SessionUnavailable } from '../components/ui/session-unavailable';
import {
  PALMARES,
  palmaresCountLabel,
  palmaresPoints,
  palmaresWeekLabel,
} from '../content/palmares';
import { CATEGORY_LABELS } from '../content/tickets';
import { type PalmaresEntry, palmaresErrorMessage, palmaresQueryOptions } from '../lib/palmares';
import { useSessionState } from '../lib/session';

const dayFormatter = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
});

const playerNameClass =
  'inline-flex min-h-11 items-center font-display text-lg text-brass transition-colors duration-150 hover:text-brass-pale';

const cardLabelClass =
  'inline-flex min-h-11 items-center gap-2 font-mono text-[11px] text-vellum/70 transition-colors duration-150 hover:text-brass';

export const Route = createFileRoute('/palmares')({
  component: PalmaresPage,
});

function PalmaresPage() {
  const session = useSessionState();

  return (
    <section className="space-y-10">
      <header>
        <p className="salon-eyebrow">{PALMARES.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-vellum md:text-5xl">
          {PALMARES.title}
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-vellum/70">{PALMARES.subtitle}</p>
        <div className="brass-rule mt-5 w-24" />
      </header>

      {session.status === 'loading' ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
          {PALMARES.loadingSession}
        </p>
      ) : session.status === 'unavailable' ? (
        <SessionUnavailable onRetry={session.retry} />
      ) : session.status === 'anonymous' ? (
        <Navigate to="/login" />
      ) : (
        <PalmaresBoard />
      )}
    </section>
  );
}

function PalmaresBoard() {
  const palmaresQuery = useQuery(palmaresQueryOptions);

  if (palmaresQuery.isPending) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
        {PALMARES.loading}
      </p>
    );
  }

  if (palmaresQuery.isError) {
    return (
      <section className="space-y-5 rounded-sheet border border-veil bg-cabinet-raised p-6 md:p-8">
        <p role="alert" className="font-display text-lg text-vellum">
          {palmaresErrorMessage(palmaresQuery.error)}
        </p>
        <button
          type="button"
          onClick={() => void palmaresQuery.refetch()}
          className={outlineButtonClass}
        >
          {PALMARES.retry}
        </button>
      </section>
    );
  }

  const palmares = palmaresQuery.data;

  if (palmares.items.length === 0) {
    return (
      <div className="rounded-sheet border border-veil bg-cabinet-raised p-10 text-center">
        <h2 className="font-display text-xl text-vellum">{PALMARES.emptyTitle}</h2>
        <p className="mt-2 text-sm text-vellum/65">{PALMARES.emptyDescription}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
          {palmaresWeekLabel(palmares.week, palmares.current)}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-brass/80">
          {palmaresCountLabel(palmares.total)}
        </p>
      </div>

      {/* L'ordre du DOM est le rang : aucun tri n'est appliqué côté navigateur. */}
      <ol className="rounded-sheet border border-veil bg-cabinet-raised">
        {palmares.items.map((entry) => (
          <PalmaresRow key={entry.tableauId} entry={entry} />
        ))}
      </ol>
    </div>
  );
}

function PalmaresRow({ entry }: { entry: PalmaresEntry }) {
  return (
    <li className="border-b border-veil px-4 py-4 last:border-b-0 md:px-6">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 items-center gap-3">
          <span className="font-mono text-[13px] tabular-nums text-brass">
            <span className="sr-only">
              {PALMARES.rankPrefix} {entry.rank}
            </span>
            <span aria-hidden="true">#{entry.rank}</span>
          </span>
          {entry.player.profilePublic ? (
            <Link
              to="/players/$playerId"
              params={{ playerId: entry.player.id }}
              className={playerNameClass}
            >
              {entry.player.pseudo}
            </Link>
          ) : (
            // Une vitrine privée répond 404 par dessein (`.docs/01-architecture.md` §2.9).
            <span className={playerNameClass}>{entry.player.pseudo}</span>
          )}
        </div>

        <p className="font-display text-2xl leading-none tabular-nums text-vellum">
          {palmaresPoints(entry.score)}
        </p>
      </div>

      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="min-w-0 font-display text-[15px] text-vellum/85">{entry.name}</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/50">
          {entryDateLabel(entry.createdAt)}
        </p>
      </div>

      <div className="mt-3 border-t border-veil-strong/50 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/55">
          {PALMARES.cardsLabel}
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {entry.cards.map((card) => (
            <li key={card.cardId}>
              {entry.yours ? (
                // Le Cartel est la salle du propriétaire : `/cards/:id` répond CARD_NOT_VISIBLE
                // sur la carte d'un autre joueur, donc seules nos cartes sont liées.
                <Link
                  to="/card/$cardId"
                  params={{ cardId: card.cardId }}
                  className={cardLabelClass}
                >
                  <span className="uppercase tracking-[0.12em] text-vellum/50">
                    {CATEGORY_LABELS[card.category]}
                  </span>
                  <span className="truncate">{card.nom}</span>
                </Link>
              ) : (
                <span className={cardLabelClass}>
                  <span className="uppercase tracking-[0.12em] text-vellum/50">
                    {CATEGORY_LABELS[card.category]}
                  </span>
                  <span className="truncate">{card.nom}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function entryDateLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dayFormatter.format(date);
}
