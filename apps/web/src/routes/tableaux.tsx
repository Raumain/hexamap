import type { Rarity, TableauSlot } from '@hexamap/shared';
import { TABLEAU_SLOT_LABELS, TABLEAU_SLOTS } from '@hexamap/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import {
  linksLabel,
  MULTIPLIER_TIERS,
  multiplierLabel,
  rankLabel,
  TABLEAUX_LIST,
  tableauxCountLabel,
} from '../content/tableau';
import { CATEGORY_LABELS, RARITY_LABELS, RARITY_STYLES } from '../content/tickets';
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
    return <p className="text-slate-400">{TABLEAUX_LIST.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">
          {TABLEAUX_LIST.eyebrow}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">{TABLEAUX_LIST.title}</h1>
        <p className="text-slate-400">{TABLEAUX_LIST.subtitle}</p>
        <Link
          to="/tableau"
          className="inline-flex items-center justify-center rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-300"
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
    return <p className="text-slate-400">{TABLEAUX_LIST.loading}</p>;
  }

  if (tableauxQuery.isError) {
    return (
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <FormError message={tableauErrorMessage(tableauxQuery.error)} />
        <Button onClick={() => void tableauxQuery.refetch()}>{TABLEAUX_LIST.retry}</Button>
      </div>
    );
  }

  const items = tableauxQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center">
        <h2 className="text-xl font-semibold text-slate-100">{TABLEAUX_LIST.emptyTitle}</h2>
        <p className="mt-1 text-slate-400">{TABLEAUX_LIST.emptyDescription}</p>
        <Link
          to="/tableau"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-300"
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
        <p className="text-sm text-slate-400">{tableauxCountLabel(sorted.length)}</p>
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
                className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  active
                    ? 'border-amber-400 bg-amber-400/10 text-amber-300'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
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
      className={`rounded-2xl border p-6 ${
        isFirst
          ? 'border-amber-400/60 bg-amber-400/5 ring-2 ring-amber-400/40'
          : 'border-slate-800 bg-slate-900/60'
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-sm font-bold tabular-nums ${
              isFirst
                ? 'border-amber-400 bg-amber-400 text-slate-950'
                : 'border-slate-700 bg-slate-800 text-slate-300'
            }`}
          >
            <span aria-hidden="true">{rankLabel(rank)}</span>
            <span className="sr-only">Rang {rank}</span>
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-100">
              {tableau.name || TABLEAUX_LIST.unnamed}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {dateFormatter.format(new Date(tableau.createdAt))}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {TABLEAUX_LIST.scoreLabel}
          </p>
          <p className="text-3xl font-bold tabular-nums text-amber-400">
            {scoreFormatter.format(tableau.total)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex rounded-full border px-2.5 py-1 text-sm font-bold tabular-nums ${
            tier.badgeClass
          } ${
            links === 3
              ? 'ring-2 ring-amber-400/60 shadow-[0_0_24px_-6px_rgba(251,191,36,0.7)]'
              : ''
          }`}
        >
          {multiplierLabel(tableau.alignment.multiplier)}
        </span>
        <span className="text-sm text-slate-300">{linksLabel(links)}</span>
        {tableau.complete ? null : (
          <span className="text-xs text-slate-500">{TABLEAUX_LIST.incomplete}</span>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TABLEAU_SLOTS.map((slot) => (
          <SlotCard key={slot} slot={slot} card={tableau.cards[SLOT_TO_CARDS_KEY[slot]]} />
        ))}
      </div>

      <div className="mt-5 border-t border-slate-800 pt-4">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {TABLEAUX_LIST.linksTitle}
        </p>
        <ul className="mt-2 space-y-1.5">
          {tableau.alignment.breakdown.map((link) => (
            <li key={link.key} className="flex items-start justify-between gap-2 text-sm">
              <span className="text-slate-300">{link.label}</span>
              <span
                aria-hidden="true"
                className={link.valid ? 'text-emerald-400' : 'text-slate-600'}
              >
                {link.valid ? '✓' : '✗'}
              </span>
              <span className="sr-only">
                {link.valid ? TABLEAUX_LIST.linkValid : TABLEAUX_LIST.linkInvalid}
              </span>
            </li>
          ))}
        </ul>
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
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">
        {TABLEAU_SLOT_LABELS[slot]}
      </p>
      {card ? (
        <>
          <p className="mt-1 truncate text-sm font-medium text-slate-100">{card.nom}</p>
          <p className="text-xs text-slate-400">
            {CATEGORY_LABELS[card.category]} · {card.refCode}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <RarityBadge rarity={card.rarity} />
            <span className="text-sm font-semibold tabular-nums text-slate-200">
              {scoreFormatter.format(card.score)}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{TABLEAUX_LIST.emptySlot}</p>
      )}
    </div>
  );
}

function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${RARITY_STYLES[rarity]}`}
    >
      {RARITY_LABELS[rarity]}
    </span>
  );
}
