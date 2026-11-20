import { PACKS } from '@hexamap/shared';
import { useMutation } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { PackCard } from '../components/shop/pack-card';
import { BOUTIQUE } from '../content/boutique';
import { priceLabel } from '../content/market';
import { useSession } from '../lib/session';
import { checkoutErrorMessage, createCheckout } from '../lib/shop';

export const Route = createFileRoute('/boutique/')({
  // L'API renvoie l'acheteur sur `/boutique?session_id=…` : la salle lit ce
  // paramètre pour rediriger vers la page de succès, jamais comme preuve de
  // paiement.
  validateSearch: (search: Record<string, unknown>) => ({
    session_id: typeof search.session_id === 'string' ? search.session_id : undefined,
  }),
  component: BoutiquePage,
});

function BoutiquePage() {
  const { session_id: sessionId } = Route.useSearch();
  const session = useSession();

  const checkout = useMutation({
    mutationFn: createCheckout,
    onSuccess: ({ url }) => {
      window.location.assign(url);
    },
  });

  if (session.isPending) {
    return <p className="text-sm text-vellum/70">{BOUTIQUE.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  if (sessionId) {
    return <Navigate to="/boutique/succes" search={{ session_id: sessionId }} replace />;
  }

  const balance = session.data.user.currency ?? 0;
  const pendingKey = checkout.isPending ? checkout.variables : undefined;

  return (
    <section>
      <header>
        <p className="salon-eyebrow">{BOUTIQUE.eyebrow}</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {BOUTIQUE.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 text-[15px] leading-relaxed text-vellum/70">{BOUTIQUE.subtitle}</p>
      </header>

      <div className="mt-8 flex flex-wrap items-baseline justify-between gap-3 rounded-sheet border border-veil bg-cabinet-sunk px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/55">
          {BOUTIQUE.balanceLabel}
        </span>
        <span className="font-display text-xl tabular-nums text-brass">{priceLabel(balance)}</span>
      </div>

      <ul className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {PACKS.map((pack) => (
          <li key={pack.key} className="flex">
            <PackCard
              pack={pack}
              pending={pendingKey === pack.key}
              disabled={checkout.isPending}
              onBuy={(packKey) => checkout.mutate(packKey)}
            />
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[13px] leading-relaxed text-vellum/60">
        En achetant un pack, vous acceptez les{' '}
        <Link
          to="/cgv"
          className="text-brass underline decoration-brass/40 underline-offset-2 hover:decoration-brass"
        >
          conditions générales de vente
        </Link>
        . La{' '}
        <Link
          to="/confidentialite"
          className="text-brass underline decoration-brass/40 underline-offset-2 hover:decoration-brass"
        >
          politique de confidentialité
        </Link>{' '}
        décrit les données traitées, dont celles confiées au prestataire de paiement.
      </p>

      <div aria-live="polite" className="mt-6 min-h-6">
        {checkout.error ? (
          <p role="alert" className="text-sm text-danger">
            {checkoutErrorMessage(checkout.error)}
          </p>
        ) : null}
        {checkout.isPending ? (
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
            {BOUTIQUE.redirecting}
          </p>
        ) : null}
      </div>
    </section>
  );
}
