import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { RevealedCell } from '../components/revealed-cell';
import { ScratchCell } from '../components/scratch-cell';
import { Card } from '../components/ui/Card';
import {
  CATEGORY_LABELS,
  lockedCellLabel,
  PANEL_CONTENT,
  revealAnnouncement,
  STATUS_LABELS,
  TICKET,
} from '../content/tickets';
import { useSession } from '../lib/session';
import {
  collectionStatsQueryKey,
  createTicket,
  currentTicketQueryOptions,
  scratchTicketCell,
  type Ticket,
  TicketApiError,
  type TicketCell,
  ticketErrorMessage,
  ticketQueryKey,
} from '../lib/tickets';

export const Route = createFileRoute('/tickets/$ticketId')({
  component: TicketPage,
});

const scoreFormatter = new Intl.NumberFormat('fr-FR');

function TicketPage() {
  const { ticketId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useSession();
  const ticketQuery = useQuery(currentTicketQueryOptions);
  const firedCells = useRef(new Set<number>());
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (variables: { ticketId: string; cellIndex: number }) =>
      scratchTicketCell(variables.ticketId, variables.cellIndex),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(ticketQueryKey, data.ticket);
      void queryClient.invalidateQueries({ queryKey: collectionStatsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ticketQueryKey });
      const primary = data.revealed.find((cell) => cell.index === variables.cellIndex);
      if (primary) {
        setAnnouncement(revealAnnouncement(variables.cellIndex, cellDisplayName(primary)));
      }
    },
    onError: (_error, variables) => {
      firedCells.current.delete(variables.cellIndex);
    },
  });

  const createMutation = useMutation({
    mutationFn: () => createTicket(),
    onSuccess: (ticket) => {
      queryClient.setQueryData(ticketQueryKey, ticket);
      void navigate({ to: '/tickets/$ticketId', params: { ticketId: ticket.id } });
    },
    onError: (error) => {
      if (error instanceof TicketApiError && error.code === 'TICKET_ALREADY_ACTIVE') {
        void queryClient.invalidateQueries({ queryKey: ticketQueryKey });
      }
    },
  });

  if (session.isPending) {
    return <p className="text-vellum/70">{TICKET.loadingSession}</p>;
  }
  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  if (ticketQuery.isPending) {
    return <LoadingBoard />;
  }

  if (ticketQuery.isError) {
    return (
      <section className="space-y-4">
        <header className="space-y-3">
          <p className="salon-eyebrow">Salle I · Le relevé</p>
          <h1 className="font-display text-3xl text-vellum">Le relevé topographique</h1>
          <div className="brass-rule w-24" />
        </header>
        <FormError message={ticketErrorMessage(ticketQuery.error)} />
        <Button onClick={() => void ticketQuery.refetch()}>{TICKET.retry}</Button>
      </section>
    );
  }

  const ticket = ticketQuery.data ?? null;

  if (!ticket) {
    return (
      <section className="space-y-6">
        <header className="space-y-3">
          <p className="salon-eyebrow">Salle I · Le relevé</p>
          <h1 className="font-display text-3xl text-vellum sm:text-4xl">Le relevé topographique</h1>
          <div className="brass-rule w-24" />
        </header>
        <div className="vellum mx-auto w-full max-w-2xl rounded-sheet p-6">
          <h2 className="font-display text-2xl text-ink">{TICKET.emptyTitle}</h2>
          <p className="mt-2 text-sm text-ink-soft">{TICKET.emptyDescription}</p>
          <FormError message={createMutation.error ? createMutation.error.message : null} />
          <Button
            className="mt-5 border-2 border-brass bg-brass text-cabinet shadow-brass hover:bg-brass-pale"
            isPending={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {TICKET.getTicket}
          </Button>
        </div>
      </section>
    );
  }

  if (ticket.id !== ticketId) {
    return (
      <section className="space-y-4">
        <header className="space-y-3">
          <p className="salon-eyebrow">Salle I · Le relevé</p>
          <h1 className="font-display text-3xl text-vellum sm:text-4xl">Le relevé topographique</h1>
          <div className="brass-rule w-24" />
        </header>
        <p className="text-vellum/70">{TICKET.notCurrent}</p>
        <Link
          to="/tickets/$ticketId"
          params={{ ticketId: ticket.id }}
          className="inline-flex items-center justify-center rounded-sm border-2 border-brass bg-brass px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale"
        >
          {TICKET.goToCurrent}
        </Link>
      </section>
    );
  }

  const handleReveal = (cellIndex: number) => {
    if (firedCells.current.has(cellIndex)) return;
    firedCells.current.add(cellIndex);
    mutation.mutate({ ticketId, cellIndex });
  };

  const isScratchable = ticket.status === 'ACTIVE' && ticket.scrapesRemaining > 0;
  const revealedCells = ticket.cells.filter((cell) => cell.revealed);
  const remaining = ticket.scrapesRemaining;
  const pinsLabel = remaining === 1 ? '1 coup restant' : `${remaining} coups restants`;
  const treasure = ticket.cells.find((cell) => cell.revealed && cell.kind === 'TREASURE');
  const treasureCard = treasure && treasure.kind === 'TREASURE' ? treasure.card : null;

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <p className="salon-eyebrow">Salle I · Le relevé</p>
        <h1 className="font-display text-3xl text-vellum sm:text-4xl">Le relevé topographique</h1>
        <div className="brass-rule w-24" />
        <p className="max-w-xl text-sm leading-relaxed text-vellum/70">{TICKET.subtitle}</p>
      </header>

      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-vellum/60">
          Bordereau {ticket.id.slice(0, 8).toUpperCase()}
        </span>
        <span className="flex items-center gap-2" role="img" aria-label={pinsLabel}>
          {[0, 1, 2, 3].map((pin) => (
            <span
              key={pin}
              aria-hidden="true"
              className={[
                'h-2 w-2 rounded-full',
                pin < remaining ? 'bg-brass shadow-brass' : 'border border-brass/35',
              ].join(' ')}
            />
          ))}
        </span>
      </div>

      <FormError message={mutation.error ? mutation.error.message : null} />

      <div className="mx-auto w-full max-w-2xl rounded-sheet border border-veil bg-cabinet-raised p-4 shadow-lifted md:p-6">
        <div className="vellum rounded-sheet p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
              Grille topographique
            </p>
            <StatusBadge status={ticket.status} />
          </div>

          <fieldset
            className="grid grid-cols-4 gap-2 overscroll-none md:gap-3"
            aria-label={TICKET.gridAriaLabel}
          >
            {ticket.cells.map((cell) => {
              if (cell.revealed) {
                return <RevealedCell key={cell.index} cell={cell} />;
              }
              if (isScratchable) {
                return (
                  <ScratchCell
                    key={cell.index}
                    index={cell.index}
                    pending={mutation.isPending && mutation.variables?.cellIndex === cell.index}
                    onReveal={handleReveal}
                  />
                );
              }
              return <LockedCell key={cell.index} index={cell.index} />;
            })}
          </fieldset>

          <p className="mt-3 text-[10px] leading-relaxed text-ink-faint">{TICKET.keyboardHint}</p>
        </div>

        {ticket.renovationPending ? (
          <p className="mt-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.14em] text-brass/80">
            {TICKET.renovationPending}
          </p>
        ) : null}

        {ticket.treasureFound && !treasureCard ? (
          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-brass">
            {TICKET.treasureFound}
          </p>
        ) : null}

        <div className="brass-rule my-4" />

        <div>
          <p className="salon-eyebrow">Carnet de bord</p>
          {revealedCells.length > 0 ? (
            <ul className="mt-2">
              {revealedCells.map((cell) => (
                <li
                  key={cell.index}
                  className="flex items-baseline justify-between gap-3 border-b border-veil/50 py-1.5"
                >
                  <span className="font-mono text-[11px] text-vellum/75">
                    <span className="text-vellum/55">R{cell.index + 1}</span>
                    {' · '}
                    {logEntry(cell)}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-brass">
                    {logDistance(cell)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-vellum/55">
              Aucune case relevée pour l’instant.
            </p>
          )}
        </div>
      </div>

      {ticket.status === 'EXHAUSTED' ? (
        <div className="vellum mx-auto w-full max-w-2xl rounded-sheet p-6">
          <h2 className="font-display text-2xl text-ink">Ce bordereau est soldé.</h2>
          <p className="mt-2 text-sm text-ink-soft">{TICKET.exhaustedDescription}</p>
          <FormError message={createMutation.error ? createMutation.error.message : null} />
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Button
              className="border-2 border-brass bg-brass text-cabinet shadow-brass hover:bg-brass-pale"
              isPending={createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {TICKET.newTicket}
            </Button>
            <Link
              to="/collection"
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-deep underline decoration-brass/40 underline-offset-4 transition-colors duration-150 hover:text-ink"
            >
              Consulter la collection
            </Link>
          </div>
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>

      {ticket.treasureFound && treasureCard ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Pépite découverte"
          className="fixed inset-0 z-50 grid place-items-center bg-cabinet/85 p-6"
        >
          <div className="w-full max-w-sm text-center">
            <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-brass">
              Découverte
            </p>
            <Card
              type={treasureCard.category}
              rarity={treasureCard.rarity}
              name={treasureCard.nom || 'Pépite'}
              score={treasureCard.score}
              className="enter-plate mx-auto mt-5 w-52"
            />
            <p className="mt-5 font-display text-lg text-vellum">{treasureCard.nom}</p>
            <Link
              to="/collection"
              className="mt-5 inline-flex items-center justify-center rounded-sm border-2 border-brass bg-brass px-4 py-2 font-mono text-[11px] uppercase tracking-[0.2em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale"
            >
              Ranger dans le cadastre
            </Link>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function cellDisplayName(cell: TicketCell): string {
  if (cell.kind === 'STATION' || cell.kind === 'BELVEDERE' || cell.kind === 'RENOVATION') {
    return PANEL_CONTENT[cell.kind].label;
  }
  return cell.nom ?? 'carte';
}

function logEntry(cell: TicketCell): string {
  if (cell.kind === 'STATION' || cell.kind === 'BELVEDERE' || cell.kind === 'RENOVATION') {
    return PANEL_CONTENT[cell.kind].label;
  }
  const card = cell.card;
  if (!card) return 'Carte';
  return `${CATEGORY_LABELS[card.category]} · ${scoreFormatter.format(card.score)} pts`;
}

function logDistance(cell: TicketCell): string {
  const distance = cell.distance;
  if (typeof distance !== 'number') return '—';
  return distance === 0 ? 'Pépite' : `${distance} pas`;
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const active = status === 'ACTIVE';
  return (
    <span
      className={[
        'shrink-0 rounded-[2px] border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.2em]',
        active
          ? 'border-brass/50 bg-brass/10 text-brass-deep'
          : 'border-ink/20 bg-ink/5 text-ink-faint',
      ].join(' ')}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function LockedCell({ index }: { index: number }) {
  return (
    <div className="relative flex aspect-square items-center justify-center rounded-[2px] border border-dashed border-ink/20 bg-ink/[0.03]">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-5 w-5 text-ink-faint"
      >
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span className="sr-only">{lockedCellLabel(index)}</span>
    </div>
  );
}

function LoadingBoard() {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-28 rounded-[2px] bg-veil/40" />
        <div className="h-8 w-2/3 rounded-[2px] bg-veil/30" />
        <div className="brass-rule w-24" />
      </div>
      <div className="mx-auto w-full max-w-2xl rounded-sheet border border-veil bg-cabinet-raised p-4 shadow-lifted md:p-6">
        <div className="vellum rounded-sheet p-4 md:p-5">
          <div className="grid grid-cols-4 gap-2 md:gap-3">
            {[...Array(16).keys()].map((index) => (
              <div key={index} className="aspect-square rounded-[2px] bg-ink/[0.06]" />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
