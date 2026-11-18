import { RARITY_LABELS } from '@hexamap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { TextField } from '../components/text-field';
import { RarityBadge } from '../components/ui/rarity-badge';
import {
  LISTING_STATUS_LABELS,
  LISTING_STATUS_STYLES,
  MARKET_MINE,
  priceLabel,
} from '../content/market';
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
import { useSession } from '../lib/session';
import { collectionStatsQueryKey } from '../lib/tickets';

const scoreFormatter = new Intl.NumberFormat('fr-FR');
const dateFormatter = new Intl.DateTimeFormat('fr-FR');

export const Route = createFileRoute('/market/mine')({
  component: MarketMinePage,
});

function MarketMinePage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-ink-secondary">{MARKET_MINE.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-sign-ochre">
          {MARKET_MINE.eyebrow}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">{MARKET_MINE.title}</h1>
        <p className="text-ink-secondary">{MARKET_MINE.subtitle}</p>
      </header>
      <SellForm />
      <MyListings />
    </section>
  );
}

function SellForm() {
  const queryClient = useQueryClient();
  const collectionQuery = useQuery(collectionQueryOptions);
  const [cardId, setCardId] = useState('');
  const [price, setPrice] = useState('');

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
    return <p className="text-ink-secondary">{MARKET_MINE.loading}</p>;
  }

  if (collectionQuery.isError) {
    return (
      <section className="space-y-4 rounded-sm border-2 border-border bg-surface shadow-tactile p-6">
        <h2 className="text-xl font-semibold text-ink">{MARKET_MINE.sellTitle}</h2>
        <FormError message={collectionErrorMessage(collectionQuery.error)} />
        <Button onClick={() => void collectionQuery.refetch()}>{MARKET_MINE.retry}</Button>
      </section>
    );
  }

  const unlocked = (collectionQuery.data?.items ?? []).filter((card) => !card.locked);

  if (unlocked.length === 0) {
    return (
      <section className="space-y-4 rounded-sm border-2 border-border bg-surface shadow-tactile p-6">
        <h2 className="text-xl font-semibold text-ink">{MARKET_MINE.sellTitle}</h2>
        <p className="text-ink-secondary">
          {MARKET_MINE.noUnlockedCards}{' '}
          <Link
            to="/collection"
            className="text-sign-ochre transition-colors duration-150 hover:text-sign-ochre"
          >
            {MARKET_MINE.seeCollection}
          </Link>
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-sm border-2 border-border bg-surface shadow-tactile p-6">
      <h2 className="text-xl font-semibold text-ink">{MARKET_MINE.sellTitle}</h2>

      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="sell-card" className="text-sm font-medium text-ink">
            {MARKET_MINE.cardLabel}
          </label>
          <select
            id="sell-card"
            value={cardId}
            onChange={(event) => setCardId(event.target.value)}
            className="rounded-sm border-2 border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sign-blue"
          >
            <option value="">{MARKET_MINE.selectCard}</option>
            {unlocked.map((card) => (
              <option key={card.id} value={card.id}>
                {card.nom} — {RARITY_LABELS[card.rarity]} — {scoreFormatter.format(card.score)} pts
              </option>
            ))}
          </select>
        </div>

        <TextField
          label={MARKET_MINE.priceLabel}
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder={MARKET_MINE.pricePlaceholder}
          value={price}
          error={priceError ?? undefined}
          onChange={(event) => setPrice(event.target.value)}
        />

        {createMutation.error ? (
          <FormError message={marketErrorMessage(createMutation.error)} />
        ) : null}

        <Button
          isPending={createMutation.isPending}
          disabled={!formValid}
          onClick={() => createMutation.mutate({ userCardId: cardId, price: parsedPrice })}
        >
          {MARKET_MINE.sellSubmit}
        </Button>
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
    return <p className="text-ink-secondary">{MARKET_MINE.loading}</p>;
  }

  if (myListingsQuery.isError) {
    return (
      <div className="space-y-4 rounded-md border-2 border-border bg-surface shadow-tactile p-6">
        <FormError message={marketErrorMessage(myListingsQuery.error)} />
        <Button onClick={() => void myListingsQuery.refetch()}>{MARKET_MINE.retry}</Button>
      </div>
    );
  }

  const items = myListingsQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-md border-2 border-border bg-surface shadow-tactile p-10 text-center">
        <h2 className="text-xl font-semibold text-ink">{MARKET_MINE.emptyTitle}</h2>
        <p className="mt-1 text-ink-secondary">{MARKET_MINE.emptyDescription}</p>
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-ink">{MARKET_MINE.listingsTitle}</h2>

      {cancelMutation.error ? (
        <FormError message={marketErrorMessage(cancelMutation.error)} />
      ) : null}

      <ul className="space-y-4">
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
    <li className="rounded-sm border-2 border-border bg-surface shadow-tactile p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-ink">{listing.card.nom}</h3>
          <p className="mt-1 text-sm text-ink-secondary">
            {CATEGORY_LABELS[listing.card.category]} · {listing.card.refCode}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <RarityBadge rarity={listing.card.rarity} />
            <span className="text-sm text-ink-secondary">
              {MARKET_MINE.scoreLabel} :{' '}
              <span className="font-mono font-semibold tabular-nums text-ink">
                {scoreFormatter.format(listing.card.score)}
              </span>
            </span>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-mono font-bold tabular-nums text-sign-ochre">
            {priceLabel(listing.price)}
          </p>
          <p className="mt-1 font-mono text-xs tabular-nums text-ink-muted">
            {dateFormatter.format(new Date(listing.createdAt))}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <StatusBadge status={listing.status} />
        {listing.status === 'OPEN' ? (
          <Button variant="ghost" isPending={cancelPending} onClick={onCancel}>
            {MARKET_MINE.cancel}
          </Button>
        ) : null}
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: MarketListing['status'] }) {
  return (
    <span
      className={`inline-flex w-fit rounded-sm border px-2 py-0.5 text-xs font-medium ${LISTING_STATUS_STYLES[status]}`}
    >
      {LISTING_STATUS_LABELS[status]}
    </span>
  );
}
