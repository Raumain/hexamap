import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { RevealedCell } from '../components/revealed-cell';
import { ScratchCell } from '../components/scratch-cell';
import {
  cellLabel,
  lockedCellLabel,
  PANEL_CONTENT,
  revealAnnouncement,
  STATUS_LABELS,
  scrapesLabel,
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
    return <p className="text-ink-secondary">{TICKET.loadingSession}</p>;
  }
  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  if (ticketQuery.isPending) {
    return <LoadingGrid />;
  }

  if (ticketQuery.isError) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{TICKET.title}</h1>
        <FormError message={ticketErrorMessage(ticketQuery.error)} />
        <Button onClick={() => void ticketQuery.refetch()}>{TICKET.retry}</Button>
      </section>
    );
  }

  const ticket = ticketQuery.data ?? null;

  if (!ticket) {
    return (
      <section className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{TICKET.title}</h1>
          <p className="text-ink-secondary">{TICKET.emptyTitle}</p>
          <p className="text-sm text-ink-muted">{TICKET.emptyDescription}</p>
        </div>
        <FormError message={createMutation.error ? createMutation.error.message : null} />
        <Button isPending={createMutation.isPending} onClick={() => createMutation.mutate()}>
          {TICKET.getTicket}
        </Button>
      </section>
    );
  }

  if (ticket.id !== ticketId) {
    return (
      <section className="space-y-4">
        <h1 className="text-3xl font-bold tracking-tight">{TICKET.title}</h1>
        <p className="text-ink-secondary">{TICKET.notCurrent}</p>
        <Link
          to="/tickets/$ticketId"
          params={{ ticketId: ticket.id }}
          className="inline-flex items-center justify-center rounded-md border-2 border-border bg-sign-blue px-4 py-2 text-sm font-medium text-ink-inverse shadow-tactile-sm transition-colors duration-150 hover:shadow-tactile"
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

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-sign-ochre">Ticket</p>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{TICKET.title}</h1>
        <p className="text-ink-secondary">{TICKET.subtitle}</p>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-sm border-2 border-border bg-surface px-3 py-1 font-mono text-sm tabular-nums text-ink shadow-tactile-sm">
          {scrapesLabel(ticket.scrapesRemaining)}
        </span>
        <StatusBadge status={ticket.status} />
        {ticket.renovationPending ? (
          <span className="rounded-sm border border-border bg-muted px-3 py-1 text-xs text-ink-secondary">
            {TICKET.renovationPending}
          </span>
        ) : null}
        {ticket.treasureFound ? (
          <span className="rounded-sm border border-sign-gold bg-amber-100 px-3 py-1 text-xs text-sign-ochre">
            {TICKET.treasureFound}
          </span>
        ) : null}
      </div>

      <FormError message={mutation.error ? mutation.error.message : null} />

      <fieldset className="grid grid-cols-4 gap-3" aria-label={TICKET.gridAriaLabel}>
        {ticket.cells.map((cell) => {
          if (cell.revealed) {
            return <RevealedCell key={cell.index} cell={cell} />;
          }
          if (isScratchable) {
            return (
              <ScratchCell
                key={cell.index}
                index={cell.index}
                label={cellLabel(cell.index)}
                pending={mutation.isPending && mutation.variables?.cellIndex === cell.index}
                onReveal={handleReveal}
              />
            );
          }
          return <LockedCell key={cell.index} index={cell.index} />;
        })}
      </fieldset>

      <p className="text-sm text-ink-muted">{TICKET.keyboardHint}</p>

      {ticket.status === 'EXHAUSTED' ? (
        <div className="rounded-md border-2 border-border bg-surface shadow-tactile p-6">
          <h2 className="text-lg font-semibold text-ink">{TICKET.exhaustedTitle}</h2>
          <p className="mt-1 text-sm text-ink-secondary">{TICKET.exhaustedDescription}</p>
          <FormError message={createMutation.error ? createMutation.error.message : null} />
          <Button
            className="mt-4"
            isPending={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {TICKET.newTicket}
          </Button>
        </div>
      ) : null}

      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </section>
  );
}

function cellDisplayName(cell: TicketCell): string {
  if (cell.kind === 'STATION' || cell.kind === 'BELVEDERE' || cell.kind === 'RENOVATION') {
    return PANEL_CONTENT[cell.kind].label;
  }
  return cell.nom ?? 'carte';
}

function StatusBadge({ status }: { status: Ticket['status'] }) {
  const active = status === 'ACTIVE';
  return (
    <span
      className={[
        'rounded-sm border px-3 py-1 text-xs',
        active
          ? 'border-sign-gold/50 bg-amber-100 text-sign-ochre'
          : 'border-border bg-surface text-ink-secondary',
      ].join(' ')}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function LockedCell({ index }: { index: number }) {
  return (
    <div className="relative flex aspect-square items-center justify-center rounded-sm border-2 border-border bg-muted opacity-60">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-6 w-6 text-ink-muted"
      >
        <rect x="4" y="11" width="16" height="10" rx="2" />
        <path d="M8 11V7a4 4 0 0 1 8 0v4" />
      </svg>
      <span className="sr-only">{lockedCellLabel(index)}</span>
    </div>
  );
}

function LoadingGrid() {
  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <div className="h-4 w-32 rounded-sm bg-muted" />
        <div className="h-8 w-2/3 rounded-sm bg-muted" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[...Array(16).keys()].map((index) => (
          <div key={index} className="aspect-square rounded-sm bg-muted" />
        ))}
      </div>
    </section>
  );
}
