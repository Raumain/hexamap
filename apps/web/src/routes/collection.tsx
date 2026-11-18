import { CATEGORY, RARITY, RARITY_LABELS } from '@hexamap/shared';
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
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef, useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { TextField } from '../components/text-field';
import { Card } from '../components/ui/Card';
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
            decorative
            className="w-10 shrink-0"
          />
          <span className="min-w-0 truncate font-medium text-ink">{card.nom}</span>
        </div>
      );
    },
  }),
  columnHelper.accessor('category', {
    header: COLLECTION.columns.category,
    filterFn: 'equals',
    cell: (info) => CATEGORY_LABELS[info.getValue()],
  }),
  columnHelper.accessor('rarity', {
    header: COLLECTION.columns.rarity,
    filterFn: 'equals',
    cell: (info) => <RarityBadge rarity={info.getValue()} />,
  }),
  columnHelper.accessor('score', {
    header: COLLECTION.columns.score,
    cell: (info) => (
      <span className="font-mono tabular-nums">{scoreFormatter.format(info.getValue())}</span>
    ),
  }),
  columnHelper.accessor('acquiredAt', {
    header: COLLECTION.columns.acquiredAt,
    sortFn: 'datetime',
    cell: (info) => (
      <span className="font-mono tabular-nums">
        {dateFormatter.format(new Date(info.getValue()))}
      </span>
    ),
  }),
  columnHelper.accessor('locked', {
    header: COLLECTION.columns.state,
    enableSorting: false,
    cell: (info) => (info.getValue() ? <LockedBadge /> : null),
  }),
]);

const gridTemplate =
  'grid grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.7fr)_minmax(0,1.1fr)_minmax(0,0.8fr)] items-center gap-4 px-4';

export const Route = createFileRoute('/collection')({
  component: CollectionPage,
});

function CollectionPage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-ink-secondary">{COLLECTION.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-sign-ochre">
          {COLLECTION.eyebrow}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">{COLLECTION.title}</h1>
        <p className="text-ink-secondary">{COLLECTION.subtitle}</p>
      </header>
      <CollectionBody />
    </section>
  );
}

function CollectionBody() {
  const collectionQuery = useQuery(collectionQueryOptions);

  if (collectionQuery.isPending) {
    return <p className="text-ink-secondary">{COLLECTION.loading}</p>;
  }

  if (collectionQuery.isError) {
    return (
      <div className="space-y-4 rounded-md border-2 border-border bg-surface shadow-tactile p-6">
        <FormError message={collectionErrorMessage(collectionQuery.error)} />
        <Button onClick={() => void collectionQuery.refetch()}>{COLLECTION.retry}</Button>
      </div>
    );
  }

  const items = collectionQuery.data?.items ?? [];
  const total = collectionQuery.data?.total ?? 0;

  if (items.length === 0) {
    return (
      <div className="rounded-md border-2 border-border bg-surface shadow-tactile p-10 text-center">
        <h2 className="text-xl font-semibold text-ink">{COLLECTION.emptyTitle}</h2>
        <p className="mt-1 text-ink-secondary">{COLLECTION.emptyDescription}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md border-2 border-border bg-sign-blue px-4 py-2 text-sm font-medium text-ink-inverse shadow-tactile-sm transition-colors duration-150 hover:shadow-tactile"
        >
          {COLLECTION.goHome}
        </Link>
      </div>
    );
  }

  return <CollectionTable items={items} total={total} />;
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

  const scrollRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLDivElement>({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 84,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-64 flex-1">
          <TextField
            label={COLLECTION.searchLabel}
            placeholder={COLLECTION.searchPlaceholder}
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
          />
        </div>
        <FilterSelect
          id="rarity"
          label={COLLECTION.rarityLabel}
          value={getFilterValue('rarity')}
          onChange={(value) => applyColumnFilter('rarity', value)}
          options={RARITY.map((rarity) => ({
            value: rarity,
            label: RARITY_LABELS[rarity],
          }))}
        />
        <FilterSelect
          id="category"
          label={COLLECTION.categoryLabel}
          value={getFilterValue('category')}
          onChange={(value) => applyColumnFilter('category', value)}
          options={CATEGORY.map((category) => ({
            value: category,
            label: CATEGORY_LABELS[category],
          }))}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-secondary">
        <p>{cardsShownLabel(filteredCount, total)}</p>
        <p>{collectionTotalLabel(total)}</p>
      </div>

      <div
        ref={scrollRef}
        className="h-[32rem] overflow-auto rounded-md border-2 border-border bg-surface shadow-tactile"
      >
        <table aria-label={COLLECTION.scrollAriaLabel} className="w-full">
          <thead className="sticky top-0 z-10 block border-b border-border bg-surface">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className={`${gridTemplate} py-2`}>
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
                          className="inline-flex items-center gap-1 rounded text-left font-medium text-ink transition-colors duration-150 hover:text-sign-ochre focus:outline-none focus-visible:ring-2 focus-visible:ring-sign-blue"
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden="true" className="text-sign-ochre">
                            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                          </span>
                        </button>
                      ) : (
                        <span className="font-medium text-ink">
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
                  className={`${gridTemplate} absolute top-0 left-0 w-full border-b border-border/50`}
                  style={{ transform: `translateY(${item.start}px)` }}
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="py-3">
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

interface FilterSelectProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
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
        <option value="">{COLLECTION.allValues}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function LockedBadge() {
  return (
    <span className="inline-flex w-fit rounded-sm border border-border bg-muted px-2 py-0.5 text-xs font-medium text-ink-secondary">
      {COLLECTION.locked}
    </span>
  );
}
