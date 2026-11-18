import type { Category, Rarity } from '@hexamap/shared';
import { CATEGORY, RARITY, RARITY_LABELS } from '@hexamap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { Card } from '../components/ui/Card';
import { RarityBadge } from '../components/ui/rarity-badge';
import { listingsCountLabel, MARKET, priceLabel } from '../content/market';
import { CATEGORY_LABELS } from '../content/tickets';
import { collectionQueryKey } from '../lib/collection';
import type { MarketFilters, MarketListing } from '../lib/market';
import {
  buyListing,
  marketErrorMessage,
  marketListingsQueryKey,
  marketListingsQueryOptions,
  myListingsQueryKey,
} from '../lib/market';
import { sessionQueryKey, useSession } from '../lib/session';
import { tableauxListQueryKey } from '../lib/tableaux';
import { collectionStatsQueryKey } from '../lib/tickets';

const scoreFormatter = new Intl.NumberFormat('fr-FR');

export const Route = createFileRoute('/market/')({
  component: MarketPage,
});

function MarketPage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-ink-secondary">{MARKET.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-sign-ochre">
          {MARKET.eyebrow}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">{MARKET.title}</h1>
        <p className="text-ink-secondary">{MARKET.subtitle}</p>
      </header>
      <MarketBody userId={session.data.user.id} />
    </section>
  );
}

function MarketBody({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<Category | ''>('');
  const [rarity, setRarity] = useState<Rarity | ''>('');
  const [offset, setOffset] = useState(0);
  const limit = 20;

  const filters: MarketFilters = {
    category: category === '' ? undefined : category,
    rarity: rarity === '' ? undefined : rarity,
    limit,
    offset,
  };

  const listingsQuery = useQuery(marketListingsQueryOptions(filters));

  const buyMutation = useMutation({
    mutationFn: buyListing,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: marketListingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: myListingsQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionQueryKey });
      void queryClient.invalidateQueries({ queryKey: collectionStatsQueryKey });
      void queryClient.invalidateQueries({ queryKey: tableauxListQueryKey });
      void queryClient.invalidateQueries({ queryKey: sessionQueryKey });
    },
  });

  if (listingsQuery.isPending) {
    return <p className="text-ink-secondary">{MARKET.loading}</p>;
  }

  if (listingsQuery.isError) {
    return (
      <div className="space-y-4 rounded-md border-2 border-border bg-surface shadow-tactile p-6">
        <FormError message={marketErrorMessage(listingsQuery.error)} />
        <Button onClick={() => void listingsQuery.refetch()}>{MARKET.retry}</Button>
      </div>
    );
  }

  const items = listingsQuery.data?.items ?? [];
  const total = listingsQuery.data?.total ?? 0;

  if (items.length === 0) {
    return (
      <div className="rounded-md border-2 border-border bg-surface shadow-tactile p-10 text-center">
        <h2 className="text-xl font-semibold text-ink">{MARKET.emptyTitle}</h2>
        <p className="mt-1 text-ink-secondary">{MARKET.emptyDescription}</p>
        <Link
          to="/market/mine"
          className="mt-6 inline-flex items-center justify-center rounded-md border-2 border-border bg-sign-blue px-4 py-2 text-sm font-medium text-ink-inverse shadow-tactile-sm transition-colors duration-150 hover:shadow-tactile"
        >
          {MARKET.manageMine}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <FilterSelect
          id="category"
          label={MARKET.categoryLabel}
          value={category}
          onChange={(value) => {
            setCategory(CATEGORY.find((item) => item === value) ?? '');
            setOffset(0);
          }}
          options={CATEGORY.map((item) => ({ value: item, label: CATEGORY_LABELS[item] }))}
        />
        <FilterSelect
          id="rarity"
          label={MARKET.rarityLabel}
          value={rarity}
          onChange={(value) => {
            setRarity(RARITY.find((item) => item === value) ?? '');
            setOffset(0);
          }}
          options={RARITY.map((item) => ({ value: item, label: RARITY_LABELS[item] }))}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-secondary">
        <p>{listingsCountLabel(items.length, total)}</p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            disabled={offset === 0}
            onClick={() => setOffset((current) => Math.max(0, current - limit))}
          >
            {MARKET.previous}
          </Button>
          <Button
            variant="ghost"
            disabled={offset + limit >= total}
            onClick={() => setOffset((current) => current + limit)}
          >
            {MARKET.next}
          </Button>
        </div>
      </div>

      {buyMutation.error ? <FormError message={marketErrorMessage(buyMutation.error)} /> : null}

      <ul className="space-y-4">
        {items.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            isOwn={listing.seller.id === userId}
            buyPending={buyMutation.isPending && buyMutation.variables === listing.id}
            onBuy={() => buyMutation.mutate(listing.id)}
          />
        ))}
      </ul>
    </div>
  );
}

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}

function FilterSelect({ id, label, value, onChange, options }: FilterSelectProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-sm border-2 border-border bg-surface px-3 py-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sign-blue"
      >
        <option value="">{MARKET.allValues}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

interface ListingCardProps {
  listing: MarketListing;
  isOwn: boolean;
  buyPending: boolean;
  onBuy: () => void;
}

function ListingCard({ listing, isOwn, buyPending, onBuy }: ListingCardProps) {
  return (
    <li className="rounded-sm border-2 border-border bg-surface shadow-tactile p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Card
            type={listing.card.category}
            rarity={listing.card.rarity}
            name={listing.card.nom}
            score={listing.card.score}
            refCode={listing.card.refCode}
            blasonUrl={listing.card.blasonUrl}
            blasonCredit={listing.card.blasonCredit}
            variant="detailed"
            decorative
            className="w-24 shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">{listing.card.nom}</h2>
            <p className="mt-1 text-sm text-ink-secondary">
              {CATEGORY_LABELS[listing.card.category]} · {listing.card.refCode}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <RarityBadge rarity={listing.card.rarity} />
              <span className="text-sm text-ink-secondary">
                {MARKET.scoreLabel} :{' '}
                <span className="font-mono font-semibold tabular-nums text-ink">
                  {scoreFormatter.format(listing.card.score)}
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="text-right">
          <p className="text-sm font-mono font-bold tabular-nums text-sign-ochre">
            {priceLabel(listing.price)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-4">
        <p className="text-sm text-ink-secondary">
          {MARKET.sellerLabel} :{' '}
          <span className="text-ink">{listing.seller.pseudo ?? MARKET.sellerAnonymous}</span>
        </p>
        {isOwn ? (
          <div className="flex items-center gap-3">
            <Button disabled>{MARKET.ownListing}</Button>
            <Link
              to="/market/mine"
              className="text-sm text-ink transition-colors duration-150 hover:text-sign-ochre"
            >
              {MARKET.manageMine}
            </Link>
          </div>
        ) : (
          <Button
            isPending={buyPending}
            onClick={onBuy}
            aria-label={`${MARKET.buy} ${listing.card.nom}`}
          >
            {MARKET.buy}
          </Button>
        )}
      </div>
    </li>
  );
}
