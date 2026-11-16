import type { Rarity } from '@hexamap/shared';
import { CATEGORY, RARITY } from '@hexamap/shared';
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
import { COLLECTION, cardsShownLabel, collectionTotalLabel } from '../content/collection';
import { CATEGORY_LABELS, RARITY_LABELS, RARITY_STYLES } from '../content/tickets';
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
    cell: (info) => <span className="font-medium text-slate-100">{info.getValue()}</span>,
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
    cell: (info) => scoreFormatter.format(info.getValue()),
  }),
  columnHelper.accessor('acquiredAt', {
    header: COLLECTION.columns.acquiredAt,
    sortFn: 'datetime',
    cell: (info) => dateFormatter.format(new Date(info.getValue())),
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
    return <p className="text-slate-400">{COLLECTION.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">
          {COLLECTION.eyebrow}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">{COLLECTION.title}</h1>
        <p className="text-slate-400">{COLLECTION.subtitle}</p>
      </header>
      <CollectionBody />
    </section>
  );
}

function CollectionBody() {
  const collectionQuery = useQuery(collectionQueryOptions);

  if (collectionQuery.isPending) {
    return <p className="text-slate-400">{COLLECTION.loading}</p>;
  }

  if (collectionQuery.isError) {
    return (
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <FormError message={collectionErrorMessage(collectionQuery.error)} />
        <Button onClick={() => void collectionQuery.refetch()}>{COLLECTION.retry}</Button>
      </div>
    );
  }

  const items = collectionQuery.data?.items ?? [];
  const total = collectionQuery.data?.total ?? 0;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center">
        <h2 className="text-xl font-semibold text-slate-100">{COLLECTION.emptyTitle}</h2>
        <p className="mt-1 text-slate-400">{COLLECTION.emptyDescription}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-300"
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
    estimateSize: () => 60,
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

      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-400">
        <p>{cardsShownLabel(filteredCount, total)}</p>
        <p>{collectionTotalLabel(total)}</p>
      </div>

      <div
        ref={scrollRef}
        className="h-[32rem] overflow-auto rounded-xl border border-slate-800 bg-slate-900/60"
      >
        <table aria-label={COLLECTION.scrollAriaLabel} className="w-full">
          <thead className="sticky top-0 z-10 block border-b border-slate-800 bg-slate-900">
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
                          className="inline-flex items-center gap-1 rounded text-left font-medium text-slate-200 transition-colors hover:text-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                        >
                          <table.FlexRender header={header} />
                          <span aria-hidden="true" className="text-amber-400">
                            {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : ''}
                          </span>
                        </button>
                      ) : (
                        <span className="font-medium text-slate-200">
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
                  className={`${gridTemplate} absolute top-0 left-0 w-full border-b border-slate-800/50`}
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
      <label htmlFor={id} className="text-sm font-medium text-slate-200">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400"
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

function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2 py-0.5 text-xs font-medium ${RARITY_STYLES[rarity]}`}
    >
      {RARITY_LABELS[rarity]}
    </span>
  );
}

function LockedBadge() {
  return (
    <span className="inline-flex w-fit rounded-full border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
      {COLLECTION.locked}
    </span>
  );
}
