import type { TableauSlot } from '@hexamap/shared';
import { TABLEAU_SLOT_LABELS, TABLEAU_SLOTS } from '@hexamap/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
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
import { CATEGORY_META, type CategoryMeta } from '../lib/category-theme';
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

const SLOT_META: Record<TableauSlot, CategoryMeta> = {
  REGION: CATEGORY_META.REGION,
  DEPARTEMENT: CATEGORY_META.DEPARTEMENT,
  COMMUNE: CATEGORY_META.COMMUNE,
  RUE: CATEGORY_META.RUE,
};

export const Route = createFileRoute('/tableaux')({
  component: TableauxPage,
});

function TableauxPage() {
  const session = useSession();

  return (
    <section className="space-y-10">
      <header>
        <p className="salon-eyebrow">SALLE III · LES PLANCHES</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-vellum md:text-5xl">
          Les planches
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-vellum/70">
          {TABLEAUX_LIST.subtitle}
        </p>
        <div className="brass-rule mt-5 w-24" />
        <Link
          to="/tableau"
          className="mt-6 inline-flex items-center justify-center rounded-[2px] border border-brass-deep bg-brass px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale"
        >
          {TABLEAUX_LIST.create}
        </Link>
      </header>

      {session.isPending ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
          {TABLEAUX_LIST.loadingSession}
        </p>
      ) : !session.data?.user ? (
        <Navigate to="/login" />
      ) : (
        <TableauxBody />
      )}
    </section>
  );
}

function TableauxBody() {
  const tableauxQuery = useQuery(tableauxQueryOptions);

  if (tableauxQuery.isPending) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
        {TABLEAUX_LIST.loading}
      </p>
    );
  }

  if (tableauxQuery.isError) {
    return (
      <div className="space-y-4 rounded-sheet border border-oxide/40 bg-cabinet-raised p-6">
        <FormError message={tableauErrorMessage(tableauxQuery.error)} />
        <button
          type="button"
          onClick={() => void tableauxQuery.refetch()}
          className="inline-flex items-center justify-center rounded-[2px] border border-veil px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/70 transition-colors duration-150 hover:border-brass/40 hover:text-brass"
        >
          {TABLEAUX_LIST.retry}
        </button>
      </div>
    );
  }

  const items = tableauxQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-sheet border border-veil bg-cabinet-raised p-10 text-center">
        <h2 className="font-display text-xl text-vellum">{TABLEAUX_LIST.emptyTitle}</h2>
        <p className="mt-2 text-sm text-vellum/65">{TABLEAUX_LIST.emptyDescription}</p>
        <Link
          to="/tableau"
          className="mt-6 inline-flex items-center justify-center rounded-[2px] border border-brass-deep bg-brass px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale"
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
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
          {tableauxCountLabel(sorted.length)}
        </p>
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
                className={`rounded-[2px] border px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] transition-colors duration-150 ${
                  active
                    ? 'border-brass bg-brass/10 text-brass'
                    : 'border-veil text-vellum/60 hover:border-brass/40 hover:text-vellum/70'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </fieldset>
      </div>

      <ul className="space-y-3">
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
    <li className="rounded-sheet border border-veil bg-cabinet-raised p-4 transition-colors duration-150 hover:border-brass/40">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={`shrink-0 font-mono text-[11px] tabular-nums ${
              isFirst ? 'text-brass' : 'text-vellum/50'
            }`}
          >
            <span aria-hidden="true">{rankLabel(rank)}</span>
            <span className="sr-only">Rang {rank}</span>
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h2 className="truncate font-display text-lg text-vellum">
                {tableau.name || TABLEAUX_LIST.unnamed}
              </h2>
              <span aria-hidden="true" className="flex shrink-0 items-center gap-1 text-brass/75">
                {TABLEAU_SLOTS.map((slot) => (
                  <svg
                    key={slot}
                    aria-hidden="true"
                    focusable="false"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.4}
                    strokeLinecap="square"
                    className="h-3.5 w-3.5"
                  >
                    <path d={SLOT_META[slot].glyph} />
                  </svg>
                ))}
              </span>
            </div>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55">
              {dateFormatter.format(new Date(tableau.createdAt))}
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55">
            {TABLEAUX_LIST.scoreLabel}
          </p>
          <p className="mt-1 font-display text-2xl leading-none tabular-nums text-brass">
            {scoreFormatter.format(tableau.total)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-oxide font-display text-[12px] tabular-nums text-vellum">
          {multiplierLabel(tableau.alignment.multiplier)}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/60">
          {tier.title}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55">
          {linksLabel(links)}
        </span>
        {tableau.complete ? null : (
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-warn">
            {TABLEAUX_LIST.incomplete}
          </span>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TABLEAU_SLOTS.map((slot) => (
          <SlotCard key={slot} slot={slot} card={tableau.cards[SLOT_TO_CARDS_KEY[slot]]} />
        ))}
      </div>

      <div className="mt-4 border-t border-veil pt-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/55">
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
    <div className="rounded-[2px] border border-veil bg-cabinet-sunk/40 p-3">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-brass/80">
        {TABLEAU_SLOT_LABELS[slot]}
      </p>
      {card ? (
        <>
          <p className="mt-1 truncate font-display text-[14px] text-vellum">{card.nom}</p>
          <p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-vellum/55">
            {CATEGORY_LABELS[card.category]} · {card.refCode}
          </p>
          <div className="mt-2 flex items-center justify-between gap-2">
            <RarityBadge rarity={card.rarity} />
            <span className="font-mono text-[11px] tabular-nums text-brass">
              {scoreFormatter.format(card.score)}
            </span>
          </div>
        </>
      ) : (
        <p className="mt-2 font-display text-[14px] italic text-vellum/55">
          {TABLEAUX_LIST.emptySlot}
        </p>
      )}
    </div>
  );
}
