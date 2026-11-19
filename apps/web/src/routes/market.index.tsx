import type { Category, Rarity } from '@hexamap/shared';
import { CATEGORY, RARITY, RARITY_LABELS } from '@hexamap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Card } from '../components/ui/Card';
import { RarityBadge } from '../components/ui/rarity-badge';
import { CURRENCY, listingsCountLabel, MARKET } from '../content/market';
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

const selectClass =
  'h-10 rounded-[2px] border border-veil bg-cabinet-sunk px-3 text-[13px] text-vellum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass';

const outlineButtonClass =
  'inline-flex min-h-9 items-center justify-center rounded-[2px] border border-brass/50 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale disabled:cursor-not-allowed disabled:opacity-40';

const buyButtonClass =
  'inline-flex min-h-10 items-center justify-center rounded-[2px] border border-brass bg-brass px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-cabinet transition-colors duration-150 hover:bg-brass-pale disabled:cursor-not-allowed disabled:opacity-60';

export const Route = createFileRoute('/market/')({
  component: MarketPage,
});

function MarketPage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-sm text-vellum/70">{MARKET.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section>
      <header>
        <p className="salon-eyebrow">SALLE IV · LE COMPTOIR</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {MARKET.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 text-[15px] leading-relaxed text-vellum/70">{MARKET.subtitle}</p>
        <Link
          to="/market/mine"
          className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-brass transition-colors duration-150 hover:text-brass-pale"
        >
          {MARKET.manageMine}
          <span aria-hidden="true">→</span>
        </Link>
      </header>
      <div className="mt-8">
        <MarketBody userId={session.data.user.id} />
      </div>
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
    return <p className="text-sm text-vellum/70">{MARKET.loading}</p>;
  }

  if (listingsQuery.isError) {
    return (
      <div className="space-y-4 rounded-sheet border border-veil bg-cabinet-raised p-6">
        <div role="alert" className="text-sm text-danger">
          {marketErrorMessage(listingsQuery.error)}
        </div>
        <button
          type="button"
          onClick={() => void listingsQuery.refetch()}
          className={outlineButtonClass}
        >
          {MARKET.retry}
        </button>
      </div>
    );
  }

  const items = listingsQuery.data?.items ?? [];
  const total = listingsQuery.data?.total ?? 0;

  if (items.length === 0) {
    return (
      <div className="border-y border-veil px-4 py-16 text-center">
        <p className="font-display text-lg italic text-vellum/60">{MARKET.emptyTitle}</p>
        <p className="mt-2 font-display text-base italic text-vellum/60">
          {MARKET.emptyDescription}
        </p>
        <Link
          to="/market/mine"
          className="mt-6 inline-flex min-h-10 items-center justify-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale"
        >
          {MARKET.manageMine}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4 border-y border-veil py-3">
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

        <div className="flex flex-wrap items-center gap-3">
          <p className="font-mono text-[11px] text-vellum/60">
            {listingsCountLabel(items.length, total)}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={offset === 0}
              onClick={() => setOffset((current) => Math.max(0, current - limit))}
              className={outlineButtonClass}
            >
              {MARKET.previous}
            </button>
            <span className="font-mono text-[11px] tabular-nums text-vellum/60">
              {offset + 1}–{Math.min(offset + limit, total)} / {total}
            </span>
            <button
              type="button"
              disabled={offset + limit >= total}
              onClick={() => setOffset((current) => current + limit)}
              className={outlineButtonClass}
            >
              {MARKET.next}
            </button>
          </div>
        </div>
      </div>

      {buyMutation.error ? (
        <div role="alert" className="text-sm text-danger">
          {marketErrorMessage(buyMutation.error)}
        </div>
      ) : null}

      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
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
    <div className="flex items-center gap-2">
      <label
        htmlFor={id}
        className="font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/60"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectClass}
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
    <li className="group flex flex-col rounded-sheet border border-veil bg-cabinet-raised p-4 transition-colors duration-150 hover:border-brass/40">
      <div className="flex gap-4">
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

        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg leading-tight text-vellum">{listing.card.nom}</h2>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
            {CATEGORY_LABELS[listing.card.category]} · {listing.card.refCode}
          </p>
          <div className="mt-2">
            <RarityBadge rarity={listing.card.rarity} />
          </div>
          <p className="mt-2 font-mono text-[10px] tabular-nums text-vellum/60">
            {MARKET.scoreLabel} · {scoreFormatter.format(listing.card.score)}
          </p>
          <p className="mt-1 truncate font-mono text-[10px] text-vellum/60">
            {MARKET.sellerLabel} · {listing.seller.pseudo ?? MARKET.sellerAnonymous}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end justify-between gap-x-3 gap-y-2 border-t border-veil pt-3">
        <p className="flex items-baseline gap-1.5">
          <span className="font-display text-2xl tabular-nums text-brass">
            {scoreFormatter.format(listing.price)}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
            {CURRENCY.unit}
          </span>
        </p>

        {isOwn ? (
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55">
              {MARKET.ownListing}
            </span>
            <Link
              to="/market/mine"
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-brass transition-colors duration-150 hover:text-brass-pale"
            >
              {MARKET.manageMine}
            </Link>
          </div>
        ) : (
          <button
            type="button"
            onClick={onBuy}
            disabled={buyPending}
            aria-busy={buyPending || undefined}
            aria-label={`${MARKET.buy} ${listing.card.nom}`}
            className={buyButtonClass}
          >
            {MARKET.buy}
          </button>
        )}
      </div>
    </li>
  );
}
