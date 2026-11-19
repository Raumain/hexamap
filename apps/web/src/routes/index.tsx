import type { Category, Rarity } from '@hexamap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate, useNavigate } from '@tanstack/react-router';
import { Button } from '../components/button';
import { ChargesMeter } from '../components/charges-meter';
import { FormError } from '../components/form-error';
import { Card } from '../components/ui/Card';
import { CHARGES, scrapesLabel, TICKET } from '../content/tickets';
import { chargesQueryKey, chargesQueryOptions } from '../lib/charges';
import { useSession } from '../lib/session';
import {
  createTicket,
  currentTicketQueryOptions,
  TicketApiError,
  ticketErrorMessage,
  ticketQueryKey,
} from '../lib/tickets';
import { useChargeCountdown } from '../lib/use-charge-countdown';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

const plateLinkClass =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] bg-brass px-5 font-mono text-[11px] uppercase tracking-[0.14em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale';

interface PlatePreview {
  type: Category;
  rarity: Rarity;
  name: string;
  score: number;
  refCode: string;
  offsetClass: string;
}

const PLATE_PREVIEWS: PlatePreview[] = [
  {
    type: 'REGION',
    rarity: 'RARE',
    name: 'Bretagne',
    score: 750,
    refCode: '53',
    offsetClass: 'sm:-translate-y-2',
  },
  {
    type: 'DEPARTEMENT',
    rarity: 'EPIQUE',
    name: 'Finistère',
    score: 1250,
    refCode: '29',
    offsetClass: 'sm:translate-y-2',
  },
  {
    type: 'COMMUNE',
    rarity: 'MYTHIQUE',
    name: 'Lyon',
    score: 3600,
    refCode: '69123',
    offsetClass: 'sm:-translate-y-2',
  },
  {
    type: 'RUE',
    rarity: 'RARE',
    name: 'Rue des Lices',
    score: 1000,
    refCode: '—',
    offsetClass: 'sm:translate-y-2',
  },
];

const CABINET_FACTS: { label: string; value: string }[] = [
  { label: 'Régions', value: '18' },
  { label: 'Départements', value: '101' },
  { label: 'Communes', value: '34 900' },
];

function DashboardPage() {
  const session = useSession();

  if (session.isPending) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-vellum/65">
        Chargement de votre session…
      </p>
    );
  }

  const user = session.data?.user ?? undefined;
  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-12">
      <header>
        <p className="salon-eyebrow">SALLE I · LE RELEVÉ</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          Le relevé topographique
        </h1>
        <div className="brass-rule mt-5 w-24" />
      </header>

      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p className="max-w-xl text-[15px] leading-relaxed text-vellum/75">
            Chaque bordereau porte seize cases de carbone et quatre coups de grattoir : sous la
            poussière, une pépite, deux lieux jumelés et dix routes communales. Grattez, et le
            relevé prend forme — un département, une commune, une rue, bientôt une planche à
            épingler dans votre cadastre.
          </p>
          <h2 className="mt-5 font-display text-lg italic text-vellum/80">
            Bienvenue, {user.pseudo}.
          </h2>
          <div className="mt-7">
            <CurrentTicketCta />
          </div>
          <Link
            to="/collection"
            className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/65 transition-colors duration-150 hover:text-brass"
          >
            Consulter le cadastre
          </Link>
        </div>

        <div className="grid grid-cols-2 justify-items-center gap-4">
          {PLATE_PREVIEWS.map((plate) => (
            <div
              key={`${plate.type}-${plate.name}`}
              className={`w-full max-w-[240px] transition-transform duration-150 ${plate.offsetClass}`}
            >
              <Card
                type={plate.type}
                rarity={plate.rarity}
                name={plate.name}
                score={plate.score}
                refCode={plate.refCode}
              />
            </div>
          ))}
        </div>
      </div>

      <dl className="grid divide-y divide-veil overflow-hidden rounded-sheet border border-veil bg-cabinet-raised sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {CABINET_FACTS.map((fact) => (
          <div key={fact.label} className="p-6">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
              {fact.label}
            </dt>
            <dd className="mt-2 font-display text-3xl font-semibold tabular-nums text-vellum">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function CurrentTicketCta() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ticketQuery = useQuery(currentTicketQueryOptions);
  const chargesQuery = useQuery(chargesQueryOptions);
  const charges = chargesQuery.data ?? null;
  // Un seul tic pour la salle : le carnet et le bouton lisent le même solde dérivé.
  const countdown = useChargeCountdown(
    charges?.charges ?? 0,
    charges?.nextChargeAt ?? null,
    charges?.cap ?? 0,
    charges?.regenMs ?? 0,
  );

  const createMutation = useMutation({
    mutationFn: () => createTicket(),
    onSuccess: (ticket) => {
      queryClient.setQueryData(ticketQueryKey, ticket);
      void queryClient.invalidateQueries({ queryKey: chargesQueryKey });
      void navigate({ to: '/tickets/$ticketId', params: { ticketId: ticket.id } });
    },
    onError: (error) => {
      // La seule resynchronisation du carnet : la mutation, en succès comme en échec.
      void queryClient.invalidateQueries({ queryKey: chargesQueryKey });
      if (error instanceof TicketApiError && error.code === 'TICKET_ALREADY_ACTIVE') {
        void queryClient.invalidateQueries({ queryKey: ticketQueryKey });
      }
    },
  });

  if (ticketQuery.isPending) {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-vellum/65">
        Chargement de votre ticket…
      </p>
    );
  }

  const ticket = ticketQuery.data ?? null;

  if (ticket) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-[15px] leading-relaxed text-vellum/75">Votre ticket est en cours.</p>
          <p className="mt-1 font-mono text-[11px] tabular-nums text-vellum/65">
            {scrapesLabel(ticket.scrapesRemaining)}
          </p>
        </div>
        <Link
          to="/tickets/$ticketId"
          params={{ ticketId: ticket.id }}
          className={`${plateLinkClass} w-full sm:w-auto sm:self-start`}
        >
          Reprendre mon ticket
        </Link>
      </div>
    );
  }

  if (ticketQuery.isError) {
    return (
      <div className="rounded-sheet border border-veil bg-cabinet-raised p-5">
        <FormError message={ticketErrorMessage(ticketQuery.error)} />
        <Button variant="secondary" className="mt-4" onClick={() => void ticketQuery.refetch()}>
          {TICKET.retry}
        </Button>
      </div>
    );
  }

  const noCharge = charges !== null && countdown.charges === 0;

  return (
    <div className="flex flex-col gap-4">
      {charges === null ? null : (
        <ChargesMeter
          charges={countdown.charges}
          cap={charges.cap}
          nextChargeAt={countdown.nextChargeAt}
        />
      )}
      <div>
        <p className="text-[15px] leading-relaxed text-vellum/75">
          Aucun ticket actif pour le moment.
        </p>
        <p className="mt-1 font-mono text-[11px] text-vellum/65">
          Grattez pour découvrir vos cartes.
        </p>
        {createMutation.error ? (
          <div className="mt-3">
            <FormError message={createMutation.error.message} />
          </div>
        ) : null}
      </div>
      <Button
        className="w-full sm:w-auto sm:self-start"
        isPending={createMutation.isPending}
        disabled={noCharge}
        aria-label={noCharge ? `${TICKET.getTicket} — ${CHARGES.empty}` : undefined}
        onClick={() => createMutation.mutate()}
      >
        {TICKET.getTicket}
      </Button>
      {noCharge ? (
        <p className="font-mono text-[11px] text-oxide">{CHARGES.disabledReason}</p>
      ) : null}
    </div>
  );
}
