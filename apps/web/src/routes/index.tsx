import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { scrapesLabel, TICKET } from '../content/tickets';
import { useSession } from '../lib/session';
import {
  createTicket,
  currentTicketQueryOptions,
  TicketApiError,
  ticketErrorMessage,
  ticketQueryKey,
} from '../lib/tickets';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-ink-secondary">Chargement de votre session…</p>;
  }

  const user = session.data?.user ?? undefined;
  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-sign-ochre">
          Tableau de bord
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Bienvenue, {user.pseudo}.</h1>
      </div>

      <div className="rounded-md border-2 border-border bg-surface shadow-tactile p-6">
        <CurrentTicketCta />
      </div>
    </section>
  );
}

function CurrentTicketCta() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ticketQuery = useQuery(currentTicketQueryOptions);

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

  if (ticketQuery.isPending) {
    return <p className="text-ink-secondary">Chargement de votre ticket…</p>;
  }

  const ticket = ticketQuery.data ?? null;

  if (ticket) {
    return (
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-ink-secondary">Votre ticket est en cours.</p>
          <p className="mt-1 text-sm text-ink-secondary">{scrapesLabel(ticket.scrapesRemaining)}</p>
        </div>
        <Link
          to="/tickets/$ticketId"
          params={{ ticketId: ticket.id }}
          className="inline-flex items-center justify-center rounded-md border-2 border-border bg-sign-blue px-4 py-2 text-sm font-medium text-ink-inverse shadow-tactile-sm transition-colors duration-150 hover:shadow-tactile"
        >
          Reprendre mon ticket
        </Link>
      </div>
    );
  }

  if (ticketQuery.isError) {
    return (
      <div className="rounded-md border-2 border-border bg-surface shadow-tactile p-6">
        <FormError message={ticketErrorMessage(ticketQuery.error)} />
        <Button className="mt-4" onClick={() => void ticketQuery.refetch()}>
          {TICKET.retry}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-ink-secondary">Aucun ticket actif pour le moment.</p>
        <p className="mt-1 text-sm text-ink-secondary">Grattez pour découvrir vos cartes.</p>
        <FormError message={createMutation.error ? createMutation.error.message : null} />
      </div>
      <Button isPending={createMutation.isPending} onClick={() => createMutation.mutate()}>
        Obtenir un ticket
      </Button>
    </div>
  );
}
