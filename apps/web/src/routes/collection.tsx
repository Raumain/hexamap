import { CATEGORY, type Category, RARITY, RARITY_LABELS } from '@hexamap/shared';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import type { ColumnFiltersState, SortingState } from '@tanstack/react-table';
import {
  columnFilteringFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  filterFn_equals,
  filterFn_includesString,
  globalFilteringFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../components/ui/Card';
import { CardLink, cardLinkLabel } from '../components/ui/card-link';
import { RarityBadge } from '../components/ui/rarity-badge';
import { COLLECTION, cardsShownLabel, collectionTotalLabel } from '../content/collection';
import { CATEGORY_LABELS } from '../content/tickets';
import {
  type CollectionCard,
  collectionErrorMessage,
  collectionQueryOptions,
} from '../lib/collection';
import { useSession } from '../lib/session';

const scoreFormatter = new Intl.NumberFormat('fr-FR');
const dateFormatter = new Intl.DateTimeFormat('fr-FR');

const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  filterFns: { includesString: filterFn_includesString, equals: filterFn_equals },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

const columnHelper = createColumnHelper<typeof features, CollectionCard>();

const columns = columnHelper.columns([
  columnHelper.accessor('nom', {
    header: COLLECTION.columns.nom,
    filterFn: 'includesString',
    cell: (info) => {
      const card = info.row.original;
      return (
        <div className="flex items-center gap-3">
          <CardLink
            cardId={card.id}
            label={cardLinkLabel(card.nom)}
            className="w-[84px] shrink-0 md:w-[96px]"
          >
            <Card
              type={card.category}
              rarity={card.rarity}
              name={card.nom}
              score={card.score}
              refCode={card.refCode}
              blasonUrl={card.blasonUrl}
              blasonCredit={card.blasonCredit}
              locked={card.locked}
              variant="compact"
              className="w-[84px] shrink-0 md:w-[96px]"
            />
          </CardLink>
          <div className="min-w-0 md:hidden">
            <p className="font-display text-[15px] font-semibold leading-tight text-vellum line-clamp-2">
              {card.nom}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/60">
              {CATEGORY_LABELS[card.category]} · {scoreFormatter.format(card.score)} pts
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <RarityBadge rarity={card.rarity} />
              <span className="font-mono text-[10px] tabular-nums text-vellum/55">
                {dateFormatter.format(new Date(card.acquiredAt))}
              </span>
              {card.locked ? (
                <span className="text-vellum/55">
                  <LockedGlyph />
                </span>
              ) : null}
            </div>
          </div>
        </div>
      );
    },
  }),
  columnHelper.accessor('category', {
    header: COLLECTION.columns.category,
    filterFn: 'equals',
    cell: (info) => (
      <span className="text-[15px] text-vellum/75">{CATEGORY_LABELS[info.getValue()]}</span>
    ),
  }),
  columnHelper.accessor('rarity', {
    header: COLLECTION.columns.rarity,
    filterFn: 'equals',
    cell: (info) => <RarityBadge rarity={info.getValue()} />,
  }),
  columnHelper.accessor('score', {
    header: COLLECTION.columns.score,
    cell: (info) => (
      <span className="font-mono tabular-nums text-brass">
        {scoreFormatter.format(info.getValue())}
      </span>
    ),
  }),
  columnHelper.accessor('acquiredAt', {
    header: COLLECTION.columns.acquiredAt,
    sortFn: 'datetime',
    cell: (info) => (
      <span className="font-mono text-[11px] tabular-nums text-vellum/60">
        {dateFormatter.format(new Date(info.getValue()))}
      </span>
    ),
  }),
  columnHelper.accessor('locked', {
    header: COLLECTION.columns.state,
    enableSorting: false,
    cell: (info) => (info.getValue() ? <LockedGlyph /> : null),
  }),
]);

const gridTemplate =
  'grid grid-cols-1 items-center gap-6 px-5 py-3 md:grid-cols-[96px_minmax(0,1.3fr)_minmax(0,1.1fr)_minmax(0,0.7fr)_minmax(0,1fr)_minmax(0,0.6fr)] md:py-2';

const inputClass =
  'h-10 rounded-[2px] border border-veil bg-cabinet-sunk px-3 text-[13px] text-vellum placeholder:text-vellum/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass';

const outlineButtonClass =
  'inline-flex min-h-10 items-center justify-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale disabled:cursor-not-allowed disabled:opacity-40';

export const Route = createFileRoute('/collection')({
  component: CollectionPage,
});

function CollectionPage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-sm text-vellum/70">{COLLECTION.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section>
      <header>
        <p className="salon-eyebrow">SALLE II · LE CADASTRE</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {COLLECTION.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 text-[15px] leading-relaxed text-vellum/70">{COLLECTION.subtitle}</p>
      </header>
      <div className="mt-8">
        <CollectionBody />
      </div>
    </section>
  );
}

function CollectionBody() {
  const collectionQuery = useQuery(collectionQueryOptions);

  if (collectionQuery.isPending) {
    return <p className="text-sm text-vellum/70">{COLLECTION.loading}</p>;
  }

  if (collectionQuery.isError) {
    return (
      <div className="space-y-4 rounded-sheet border border-veil bg-cabinet-raised p-6">
        <div role="alert" className="text-sm text-danger">
          {collectionErrorMessage(collectionQuery.error)}
        </div>
        <button
          type="button"
          onClick={() => void collectionQuery.refetch()}
          className={outlineButtonClass}
        >
          {COLLECTION.retry}
        </button>
      </div>
    );
  }

  const items = collectionQuery.data?.items ?? [];
  const total = collectionQuery.data?.total ?? 0;

  return (
    <div className="space-y-8">
      <CollectionCounters items={items} />
      {items.length === 0 ? (
        <div className="border-y border-veil px-4 py-16 text-center">
          <p className="font-display text-lg italic text-vellum/60">{COLLECTION.emptyTitle}</p>
          <p className="mt-2 font-display text-base italic text-vellum/60">
            {COLLECTION.emptyDescription}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex min-h-10 items-center justify-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale"
          >
            {COLLECTION.goHome}
          </Link>
        </div>
      ) : (
        <CollectionTable items={items} total={total} />
      )}
    </div>
  );
}

function CollectionCounters({ items }: { items: CollectionCard[] }) {
  const counts = useMemo(() => {
    const byCategory = new Map<Category, number>();
    for (const item of items) {
      byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1);
    }
    return CATEGORY.map((category) => ({
      category,
      count: byCategory.get(category) ?? 0,
    }));
  }, [items]);

  return (
    <div className="grid grid-cols-4 divide-x divide-veil border-y border-veil">
      {counts.map(({ category, count }) => (
        <div key={category} className="px-3 py-3 md:px-4 md:py-4">
          <p className="truncate font-mono text-[8px] uppercase tracking-[0.12em] text-vellum/60 md:text-[9px] md:tracking-[0.18em]">
            {CATEGORY_LABELS[category]}
          </p>
          <p className="mt-1 font-display text-2xl tabular-nums text-brass md:text-3xl">
            {scoreFormatter.format(count)}
          </p>
        </div>
      ))}
    </div>
  );
}

interface CollectionTableProps {
  items: CollectionCard[];
  total: number;
}

function CollectionTable({ items, total }: CollectionTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const table = useTable({
    features,
    columns,
    data: items,
    state: { sorting, globalFilter, columnFilters },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
  });

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useLayoutEffect(() => {
    const measure = () => {
      if (listRef.current) setScrollMargin(listRef.current.offsetTop);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  const rows = table.getRowModel().rows;
  // Un seul défilement : celui de la fenêtre. Pas de conteneur imbriqué, donc
  // pas de double barre de défilement sur mobile (DESIGN_SYSTEM.md §8.2).
  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => (isDesktop ? 152 : 142),
    scrollMargin,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: 8,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const filteredCount = table.getFilteredRowModel().rows.length;

  function applyColumnFilter(id: string, value: string) {
    setColumnFilters((prev) => {
      const next = prev.filter((filter) => filter.id !== id);
      if (value !== '') next.push({ id, value });
      return next;
    });
  }

  function getFilterValue(id: string): string {
    const filter = columnFilters.find((entry) => entry.id === id);
    return typeof filter?.value === 'string' ? filter.value : '';
  }

  const activeCategory = getFilterValue('category');

  return (
    <div>
      <div className="sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-5 border-b border-veil bg-cabinet px-5 py-3 md:top-0 md:-mx-10 md:px-10">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-4">
          <div className="relative order-1 w-full md:order-3 md:w-72">
            <label htmlFor="collection-search" className="sr-only">
              {COLLECTION.searchLabel}
            </label>
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vellum/50"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m16.5 16.5 4 4" />
            </svg>
            <input
              id="collection-search"
              type="search"
              placeholder={COLLECTION.searchPlaceholder}
              value={globalFilter}
              onChange={(event) => setGlobalFilter(event.target.value)}
              className={`${inputClass} w-full pl-9`}
            />
          </div>

          <fieldset className="order-2 m-0 flex flex-wrap items-center gap-x-4 gap-y-1 border-0 p-0 md:order-1">
            <legend className="sr-only">{COLLECTION.categoryLabel}</legend>
            {(['', ...CATEGORY] as Array<Category | ''>).map((value) => {
              const active = activeCategory === value;
              return (
                <button
                  key={value === '' ? 'all' : value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => applyColumnFilter('category', value)}
                  className={`pb-1.5 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors duration-150 md:pb-2 md:text-[10px] md:tracking-[0.14em] ${
                    active
                      ? 'border-b-2 border-brass text-brass'
                      : 'border-b-2 border-transparent text-vellum/60 hover:text-vellum/75'
                  }`}
                >
                  {value === '' ? COLLECTION.allValues : CATEGORY_LABELS[value]}
                </button>
              );
            })}
          </fieldset>

          <div className="order-3 flex items-center gap-2 md:order-2">
            <label
              htmlFor="rarity"
              className="font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/60"
            >
              {COLLECTION.rarityLabel}
            </label>
            <select
              id="rarity"
              value={getFilterValue('rarity')}
              onChange={(event) => applyColumnFilter('rarity', event.target.value)}
              className={`${inputClass} flex-1 md:flex-none`}
            >
              <option value="">{COLLECTION.allValues}</option>
              {RARITY.map((rarity) => (
                <option key={rarity} value={rarity}>
                  {RARITY_LABELS[rarity]}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-vellum/60">
        <p>{cardsShownLabel(filteredCount, total)}</p>
        <p>{collectionTotalLabel(total)}</p>
      </div>

      <div ref={listRef} className="mt-3 rounded-sheet border border-veil bg-cabinet-sunk">
        <table aria-label={COLLECTION.scrollAriaLabel} className="w-full">
          <thead className="hidden border-b border-veil-strong bg-cabinet-sunk font-mono text-[9px] uppercase tracking-[0.16em] text-vellum/70 md:block">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className={gridTemplate}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted();
                  const ariaSort =
                    sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none';
                  return (
                    <th key={header.id} aria-sort={ariaSort} className="text-left">
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex items-center gap-1 pb-1 text-left transition-colors duration-150 hover:text-brass"
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden="true" className="text-brass">
                            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                          </span>
                        </button>
                      ) : (
                        <span className="pb-1">
                          <table.FlexRender header={header} />
                        </span>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody
            className="block"
            style={{ position: 'relative', height: rowVirtualizer.getTotalSize() }}
          >
            {virtualItems.map((item) => {
              const row = rows[item.index];
              if (!row) return null;
              return (
                <tr
                  key={row.id}
                  ref={rowVirtualizer.measureElement}
                  data-index={item.index}
                  className={`${gridTemplate} absolute top-0 left-0 w-full border-b border-veil transition-colors duration-150 hover:bg-cabinet-raised/70`}
                  style={{ transform: `translateY(${item.start - scrollMargin}px)` }}
                >
                  {row.getAllCells().map((cell, index) => (
                    <td key={cell.id} className={index === 0 ? undefined : 'hidden md:block'}>
                      <table.FlexRender cell={cell} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LockedGlyph() {
  return (
    <span className="inline-flex items-center gap-1.5 text-vellum/55">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-4 w-4"
      >
        <path d="M7 11V8a5 5 0 0 1 10 0v3" strokeLinecap="round" />
        <rect x="5" y="11" width="14" height="9" rx="1" />
        <path d="M12 15v2" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{COLLECTION.locked}</span>
    </span>
  );
}
