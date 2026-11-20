import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { BOUTIQUE_SUCCESS } from '../content/boutique';
import { priceLabel } from '../content/market';
import { sessionQueryOptions } from '../lib/session';
import { checkoutErrorMessage, shopOrderQueryOptions } from '../lib/shop';

const outlineButtonClass =
  'mt-4 inline-flex min-h-11 touch-manipulation items-center justify-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale disabled:cursor-not-allowed disabled:opacity-40';

export const Route = createFileRoute('/boutique/succes')({
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === 'string' ? search.session_id : undefined,
  }),
  component: BoutiqueSuccessPage,
});

function BoutiqueSuccessPage() {
  const { session_id: sessionId } = Route.useSearch();

  // Cinq relectures à deux secondes : le webhook a le temps d'arriver, puis la
  // page cesse d'interroger d'elle-même. Aucun crédit n'est écrit côté client.
  const order = useQuery({
    ...shopOrderQueryOptions(sessionId ?? ''),
    enabled: Boolean(sessionId),
    refetchInterval: (query) =>
      query.state.data?.status === 'PENDING' && query.state.dataUpdateCount < 6 ? 2_000 : false,
  });

  // Le solde se relit quand le crédit est confirmé : l'observateur s'active à
  // cet instant, sans `useEffect` ni écriture locale.
  const session = useQuery({
    ...sessionQueryOptions,
    enabled: order.data?.status === 'CREDITED',
    staleTime: 0,
  });

  const balance = session.data?.user?.currency ?? 0;

  return (
    <section>
      <header>
        <p className="salon-eyebrow">{BOUTIQUE_SUCCESS.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {BOUTIQUE_SUCCESS.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
      </header>

      <div className="mt-8 rounded-sheet border border-veil bg-cabinet-raised p-6">
        {!sessionId ? (
          <p role="status" className="text-sm text-vellum/80">
            {BOUTIQUE_SUCCESS.missingSession}
          </p>
        ) : order.isPending ? (
          <p className="text-sm text-vellum/70">{BOUTIQUE_SUCCESS.loading}</p>
        ) : order.isError ? (
          <p role="alert" className="text-sm text-danger">
            {checkoutErrorMessage(order.error)}
          </p>
        ) : order.data.status === 'CREDITED' ? (
          <>
            <p role="status" className="font-mono text-[10px] uppercase tracking-[0.16em] text-ok">
              {BOUTIQUE_SUCCESS.credited}
            </p>
            <p className="mt-2 font-display text-3xl tabular-nums text-brass">
              {priceLabel(order.data.ecus ?? 0)}
            </p>
            <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/55">
              {BOUTIQUE_SUCCESS.newBalance}
            </p>
            <p className="mt-1 font-display text-xl tabular-nums text-vellum/80">
              {priceLabel(balance)}
            </p>
          </>
        ) : (
          <>
            <p role="status" className="text-sm text-vellum/80">
              {BOUTIQUE_SUCCESS.pending}
            </p>
            <p className="mt-2 text-[13px] leading-relaxed text-vellum/60">
              {BOUTIQUE_SUCCESS.pendingDetail}
            </p>
          </>
        )}

        {sessionId && (order.isError || (order.data && order.data.status === 'PENDING')) ? (
          <button type="button" onClick={() => void order.refetch()} className={outlineButtonClass}>
            {BOUTIQUE_SUCCESS.refresh}
          </button>
        ) : null}

        {order.data?.status !== 'CREDITED' ? (
          <div>
            <Link to="/boutique" search={{ session_id: undefined }} className={outlineButtonClass}>
              {BOUTIQUE_SUCCESS.backToShop}
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
