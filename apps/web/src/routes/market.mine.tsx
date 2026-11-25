import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { CardPicker } from '../components/card-picker';
import { Card } from '../components/ui/Card';
import { CardLink, cardLinkLabel } from '../components/ui/card-link';
import { RarityBadge } from '../components/ui/rarity-badge';
import { SessionUnavailable } from '../components/ui/session-unavailable';
import { CURRENCY, LISTING_STATUS_LABELS, MARKET_MINE } from '../content/market';
import { CATEGORY_LABELS } from '../content/tickets';
import {
  collectionErrorMessage,
  collectionQueryKey,
  collectionQueryOptions,
} from '../lib/collection';
import type { MarketListing } from '../lib/market';
import {
  cancelListing,
  createListing,
  marketErrorMessage,
  marketListingsQueryKey,
  myListingsQueryKey,
  myListingsQueryOptions,
} from '../lib/market';
import { useSessionState } from '../lib/session';
import { collectionStatsQueryKey } from '../lib/tickets';

const scoreFormatter = new Intl.NumberFormat('fr-FR');
const dateFormatter = new Intl.DateTimeFormat('fr-FR');

const fieldClass =
  'h-10 w-full rounded-[2px] border border-veil bg-cabinet-sunk px-3 text-[13px] text-vellum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass';

const outlineButtonClass =
  'inline-flex min-h-9 items-center justify-center rounded-[2px] border border-brass/50 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale disabled:cursor-not-allowed disabled:opacity-40';

const primaryButtonClass =
  'inline-flex min-h-10 items-center justify-center rounded-[2px] border border-brass bg-brass px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-cabinet transition-colors duration-150 hover:bg-brass-pale disabled:cursor-not-allowed disabled:opacity-60';

const STATUS_CHIP_STYLES: Record<MarketListing['status'], string> = {
  OPEN: 'border-verdigris/50 text-verdigris',
  SOLD: 'border-brass/50 text-brass',
  CANCELLED: 'border-veil text-vellum/55',
};

export const Route = createFileRoute('/market/mine')({
  component: MarketMinePage,
});

function MarketMinePage() {
  const session = useSessionState();

  if (session.status === 'loading') {
    return <p className="text-sm text-vellum/70">{MARKET_MINE.loadingSession}</p>;
  }

  if (session.status === 'unavailable') {
    return <SessionUnavailable onRetry={session.retry} />;
  }

  if (session.status === 'anonymous') {
    return <Navigate to="/login" />;
  }

  return (
    <section>
      <header>
        <p className="salon-eyebrow">SALLE V · MES OFFRES</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {MARKET_MINE.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 text-[15px] leading-relaxed text-vellum/70">{MARKET_MINE.subtitle}</p>
      </header>

      <div className="mt-8 space-y-10">
        <SellForm />
        <MyListings />
      </div>
    </section>
  );
}

function SellForm() {
  const queryClient = useQueryClient();
  const collectionQuery = useQuery(collectionQueryOptions);
  const [cardId, setCardId] = useState('');
  const [price, setPrice] = useState('');

  // Les cartes verrouillées sont déjà en vente : le tiroir ne les propose pas.
  const collectionItems = collectionQuery.data?.items;
  const unlocked = useMemo(
    () => (collectionItems ?? []).filter((card) => !card.locked),
    [collectionItems],
  );

  const parsedPrice = price === '' ? Number.NaN : Number.parseInt(price, 10);
  const priceValid = Number.isInteger(parsedPrice) && parsedPrice >= 1 && parsedPrice <= 1_000_000;
  const priceError = price !== '' && !priceValid ? MARKET_MINE.priceInvalid : null;
  const formValid = cardId !== '' && priceValid;

  const createMutation = useMutation({
    mutationFn: createListing,
    onSuccess: () => {
      setCardId('');
      setPrice('');
      void queryClient.invalidateQueries({ queryKey: myListingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: marketListingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionStatsQueryKey });
    },
  });

  if (collectionQuery.isPending) {
    return <p className="text-sm text-vellum/70">{MARKET_MINE.loading}</p>;
  }

  if (collectionQuery.isError) {
    return (
      <section className="space-y-4 rounded-sheet border border-veil bg-cabinet-raised p-5 md:p-7">
        <h2 className="font-display text-2xl font-semibold text-vellum">{MARKET_MINE.sellTitle}</h2>
        <div role="alert" className="text-sm text-danger">
          {collectionErrorMessage(collectionQuery.error)}
        </div>
        <button
          type="button"
          onClick={() => void collectionQuery.refetch()}
          className={outlineButtonClass}
        >
          {MARKET_MINE.retry}
        </button>
      </section>
    );
  }

  if (unlocked.length === 0) {
    return (
      <section className="space-y-4 rounded-sheet border border-veil bg-cabinet-raised p-5 md:p-7">
        <h2 className="font-display text-2xl font-semibold text-vellum">{MARKET_MINE.sellTitle}</h2>
        <p className="text-sm leading-relaxed text-vellum/70">
          {MARKET_MINE.noUnlockedCards}{' '}
          <Link
            to="/collection"
            className="text-brass transition-colors duration-150 hover:text-brass-pale"
          >
            {MARKET_MINE.seeCollection}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-sheet border border-veil bg-cabinet-raised p-5 md:p-7">
      <h2 className="font-display text-2xl font-semibold text-vellum">{MARKET_MINE.sellTitle}</h2>

      <div className="space-y-4">
        <CardPicker cards={unlocked} value={cardId} onChange={setCardId} />

        <div className="space-y-1.5">
          <label
            htmlFor="sell-price"
            className="block font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/60"
          >
            {MARKET_MINE.priceLabel}
          </label>
          <input
            id="sell-price"
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            placeholder={MARKET_MINE.pricePlaceholder}
            value={price}
            aria-invalid={priceError ? true : undefined}
            aria-errormessage={priceError ? 'sell-price-error' : undefined}
            aria-describedby={priceError ? 'sell-price-error' : undefined}
            onChange={(event) => setPrice(event.target.value)}
            className={`${fieldClass} ${priceError ? 'border-danger' : ''}`}
          />
          {priceError ? (
            <p id="sell-price-error" className="text-sm text-danger">
              {priceError}
            </p>
          ) : null}
        </div>

        {createMutation.error ? (
          <div role="alert" className="text-sm text-danger">
            {marketErrorMessage(createMutation.error)}
          </div>
        ) : null}

        <button
          type="button"
          disabled={!formValid || createMutation.isPending}
          aria-busy={createMutation.isPending || undefined}
          onClick={() => createMutation.mutate({ userCardId: cardId, price: parsedPrice })}
          className={primaryButtonClass}
        >
          {MARKET_MINE.sellSubmit}
        </button>
      </div>
    </section>
  );
}

function MyListings() {
  const queryClient = useQueryClient();
  const myListingsQuery = useQuery(myListingsQueryOptions);

  const cancelMutation = useMutation({
    mutationFn: cancelListing,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: myListingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: marketListingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionStatsQueryKey });
    },
  });

  if (myListingsQuery.isPending) {
    return <p className="text-sm text-vellum/70">{MARKET_MINE.loading}</p>;
  }

  if (myListingsQuery.isError) {
    return (
      <div className="space-y-4 rounded-sheet border border-veil bg-cabinet-raised p-6">
        <div role="alert" className="text-sm text-danger">
          {marketErrorMessage(myListingsQuery.error)}
        </div>
        <button
          type="button"
          onClick={() => void myListingsQuery.refetch()}
          className={outlineButtonClass}
        >
          {MARKET_MINE.retry}
        </button>
      </div>
    );
  }

  const items = myListingsQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="border-y border-veil px-4 py-16 text-center">
        <p className="font-display text-lg italic text-vellum/60">{MARKET_MINE.emptyTitle}</p>
        <p className="mt-2 font-display text-base italic text-vellum/60">
          {MARKET_MINE.emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-semibold text-vellum">
        {MARKET_MINE.listingsTitle}
      </h2>

      {cancelMutation.error ? (
        <div role="alert" className="text-sm text-danger">
          {marketErrorMessage(cancelMutation.error)}
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((listing) => (
          <MyListingCard
            key={listing.id}
            listing={listing}
            cancelPending={cancelMutation.isPending && cancelMutation.variables === listing.id}
            onCancel={() => cancelMutation.mutate(listing.id)}
          />
        ))}
      </ul>
    </section>
  );
}

interface MyListingCardProps {
  listing: MarketListing;
  cancelPending: boolean;
  onCancel: () => void;
}

function MyListingCard({ listing, cancelPending, onCancel }: MyListingCardProps) {
  return (
    <li className="group flex flex-col rounded-sheet border border-veil bg-cabinet-raised p-4 transition-colors duration-150 hover:border-brass/40">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-4">
          <CardLink
            cardId={listing.card.id}
            label={cardLinkLabel(listing.card.nom)}
            className="w-[132px] shrink-0"
          >
            <Card
              type={listing.card.category}
              rarity={listing.card.rarity}
              name={listing.card.nom}
              score={listing.card.score}
              refCode={listing.card.refCode}
              blasonUrl={listing.card.blasonUrl}
              blasonCredit={listing.card.blasonCredit}
              variant="compact"
              className="w-[132px] shrink-0"
            />
          </CardLink>

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg leading-tight text-vellum">{listing.card.nom}</h3>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
              {CATEGORY_LABELS[listing.card.category]} · {listing.card.refCode}
            </p>
            <div className="mt-2">
              <RarityBadge rarity={listing.card.rarity} />
            </div>
            <p className="mt-2 font-mono text-[10px] tabular-nums text-vellum/60">
              {MARKET_MINE.scoreLabel} · {scoreFormatter.format(listing.card.score)}
            </p>
          </div>
        </div>

        <StatusChip status={listing.status} />
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-veil pt-3">
        <div className="flex items-baseline gap-2">
          <span className="font-display text-2xl tabular-nums text-brass">
            {scoreFormatter.format(listing.price)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
            {CURRENCY.unit}
          </span>
          <span className="font-mono text-[10px] tabular-nums text-vellum/55">
            {dateFormatter.format(new Date(listing.createdAt))}
          </span>
        </div>

        {listing.status === 'OPEN' ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={cancelPending}
            aria-busy={cancelPending || undefined}
            className={outlineButtonClass}
          >
            {MARKET_MINE.cancel}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function StatusChip({ status }: { status: MarketListing['status'] }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-[2px] border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] ${STATUS_CHIP_STYLES[status]}`}
    >
      {LISTING_STATUS_LABELS[status]}
    </span>
  );
}
