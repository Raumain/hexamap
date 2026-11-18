import type { TableauSlot } from '@hexamap/shared';
import { TABLEAU_SLOT_LABELS, TABLEAU_SLOTS } from '@hexamap/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { AlignmentLinkList } from '../components/tableau/alignment-connector';
import { RarityBadge } from '../components/ui/rarity-badge';
import {
  linksLabel,
  MULTIPLIER_TIERS,
  multiplierLabel,
  rankLabel,
  TABLEAUX_LIST,
  tableauxCountLabel,
} from '../content/tableau';
import { CATEGORY_LABELS } from '../content/tickets';
import { useSession } from '../lib/session';
import { type TableauListItem, tableauErrorMessage, tableauxQueryOptions } from '../lib/tableaux';

const scoreFormatter = new Intl.NumberFormat('fr-FR');
const dateFormatter = new Intl.DateTimeFormat('fr-FR');

type SortKey = 'score' | 'multiplier' | 'recent';

const SORT_OPTIONS: ReadonlyArray<{ key: SortKey; label: string }> = [
  { key: 'score', label: TABLEAUX_LIST.sortScore },
  { key: 'multiplier', label: TABLEAUX_LIST.sortMultiplier },
  { key: 'recent', label: TABLEAUX_LIST.sortRecent },
];

const SLOT_TO_CARDS_KEY = {
  REGION: 'region',
  DEPARTEMENT: 'departement',
  COMMUNE: 'commune',
  RUE: 'rue',
} as const;

export const Route = createFileRoute('/tableaux')({
  component: TableauxPage,
});

function TableauxPage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-ink-secondary">{TABLEAUX_LIST.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-sign-ochre">
          {TABLEAUX_LIST.eyebrow}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">{TABLEAUX_LIST.title}</h1>
        <p className="text-ink-secondary">{TABLEAUX_LIST.subtitle}</p>
        <Link
          to="/tableau"
          className="inline-flex items-center justify-center rounded-md border-2 border-border bg-sign-blue px-4 py-2 text-sm font-medium text-ink-inverse shadow-tactile-sm transition-colors duration-150 hover:shadow-tactile"
        >
          {TABLEAUX_LIST.create}
        </Link>
      </header>
      <TableauxBody />
    </section>
  );
}

function TableauxBody() {
  const tableauxQuery = useQuery(tableauxQueryOptions);

  if (tableauxQuery.isPending) {
    return <p className="text-ink-secondary">{TABLEAUX_LIST.loading}</p>;
  }

  if (tableauxQuery.isError) {
    return (
      <div className="space-y-4 rounded-md border-2 border-border bg-surface shadow-tactile p-6">
        <FormError message={tableauErrorMessage(tableauxQuery.error)} />
        <Button onClick={() => void tableauxQuery.refetch()}>{TABLEAUX_LIST.retry}</Button>
      </div>
    );
  }

  const items = tableauxQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-md border-2 border-border bg-surface shadow-tactile p-10 text-center">
        <h2 className="text-xl font-semibold text-ink">{TABLEAUX_LIST.emptyTitle}</h2>
        <p className="mt-1 text-ink-secondary">{TABLEAUX_LIST.emptyDescription}</p>
        <Link
          to="/tableau"
          className="mt-6 inline-flex items-center justify-center rounded-md border-2 border-border bg-sign-blue px-4 py-2 text-sm font-medium text-ink-inverse shadow-tactile-sm transition-colors duration-150 hover:shadow-tactile"
        >
          {TABLEAUX_LIST.viewBuilder}
        </Link>
      </div>
    );
  }

  return <TableauxList items={items} />;
}

function TableauxList({ items }: { items: TableauListItem[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('score');

  const sorted = useMemo(() => {
    const list = [...items];
    switch (sortKey) {
      case 'multiplier':
        list.sort((a, b) => b.alignment.multiplier - a.alignment.multiplier || b.total - a.total);
        break;
      case 'recent':
        list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        break;
      case 'score':
        list.sort((a, b) => b.total - a.total);
        break;
    }
    return list;
  }, [items, sortKey]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-ink-secondary">{tableauxCountLabel(sorted.length)}</p>
        <fieldset className="flex flex-wrap gap-2 border-0 p-0">
          <legend className="sr-only">{TABLEAUX_LIST.sortLabel}</legend>
          {SORT_OPTIONS.map((option) => {
            const active = sortKey === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                onClick={() => setSortKey(option.key)}
                className={`rounded-sm border px-3 py-1.5 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-sign-blue ${
                  active
                    ? 'border-sign-gold bg-amber-100 text-sign-ochre'
                    : 'border-border bg-surface text-ink-secondary hover:bg-muted'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </fieldset>
      </div>

      <ul className="space-y-4">
        {sorted.map((tableau, index) => (
          <TableauCard key={tableau.id} tableau={tableau} rank={index + 1} />
        ))}
      </ul>
    </div>
  );
}

function TableauCard({ tableau, rank }: { tableau: TableauListItem; rank: number }) {
  const links = tableau.alignment.links;
  const tier = MULTIPLIER_TIERS[links] ?? MULTIPLIER_TIERS[0];
  const isFirst = rank === 1;

  return (
    <li
      className={`rounded-sm border-2 p-6 ${
        isFirst
          ? 'border-sign-gold/60 bg-paper ring-2 ring-sign-gold/40'
          : 'border-border bg-surface shadow-tactile'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-8 min-w-8 items-center justify-center rounded-sm border px-2 font-mono text-sm font-bold tabular-nums ${
              isFirst
                ? 'border-sign-gold bg-sign-gold text-ink-inverse'
                : 'border-border bg-muted text-ink-secondary'
            }`}
          >
            <span aria-hidden="true">{rankLabel(rank)}</span>
            <span className="sr-only">Rang {rank}</span>
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink">
              {tableau.name || TABLEAUX_LIST.unnamed}
            </h2>
            <p className="mt-1 text-sm text-ink-secondary">
              {dateFormatter.format(new Date(tableau.createdAt))}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
            {TABLEAUX_LIST.scoreLabel}
          </p>
          <p className="text-3xl font-mono font-bold tabular-nums text-sign-ochre">
            {scoreFormatter.format(tableau.total)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-sm border px-2.5 py-1 font-mono text-sm font-bold tabular-nums ${
            tier.badgeClass
          } ${links === 3 ? 'ring-2 ring-sign-gold' : ''}`}
        >
          {multiplierLabel(tableau.alignment.multiplier)}
        </span>
        <span className="text-sm text-ink-secondary">{linksLabel(links)}</span>
        {tableau.complete ? null : (
          <span className="text-xs text-ink-muted">{TABLEAUX_LIST.incomplete}</span>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TABLEAU_SLOTS.map((slot) => (
          <SlotCard key={slot} slot={slot} card={tableau.cards[SLOT_TO_CARDS_KEY[slot]]} />
        ))}
      </div>

      <div className="mt-5 border-t-2 border-border pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          {TABLEAUX_LIST.linksTitle}
        </p>
        <AlignmentLinkList breakdown={tableau.alignment.breakdown} className="mt-2" />
      </div>
    </li>
  );
}

interface SlotCardProps {
  slot: TableauSlot;
  card: TableauListItem['cards']['region'];
}

function SlotCard({ slot, card }: SlotCardProps) {
  return (
    <div className="rounded-md border border-border bg-muted p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-sign-ochre">
        {TABLEAU_SLOT_LABELS[slot]}
      </p>
      {card ? (
        <>
          <p className="mt-1 truncate text-sm font-medium text-ink">{card.nom}</p>
          <p className="text-xs text-ink-secondary">
            {CATEGORY_LABELS[card.category]} · {card.refCode}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <RarityBadge rarity={card.rarity} />
            <span className="text-sm font-semibold tabular-nums text-ink">
              {scoreFormatter.format(card.score)}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-ink-muted">{TABLEAUX_LIST.emptySlot}</p>
      )}
    </div>
  );
}
