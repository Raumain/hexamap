import {
  CATEGORY,
  type Category,
  type ExemplaireGroup,
  groupExemplaires,
  RARITY,
  RARITY_LABELS,
} from '@hexamap/shared';
import { useQuery } from '@tanstack/react-query';
import {
  createFileRoute,
  Link,
  Navigate,
  useNavigate,
  useRouterState,
} from '@tanstack/react-router';
import type { SortingState } from '@tanstack/react-table';
import {
  createColumnHelper,
  createSortedRowModel,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../components/ui/Card';
import { CardLink, cardLinkLabel } from '../components/ui/card-link';
import { RarityBadge } from '../components/ui/rarity-badge';
import { SessionUnavailable } from '../components/ui/session-unavailable';
import {
  COLLECTION,
  COLLECTION_FILTERED_EMPTY,
  COLLECTION_FILTERS,
  codePostalLabel,
  collectionGroupsLabel,
  collectionTotalLabel,
  exemplairesCountLabel,
} from '../content/collection';
import { CATEGORY_LABELS } from '../content/tickets';
import {
  type CollectionCard,
  collectionErrorMessage,
  collectionQueryOptions,
} from '../lib/collection';
import {
  type CollectionFilters,
  type CollectionSearchWire,
  EMPTY_COLLECTION_FILTERS,
  filterCollectionCards,
  parseCollectionSearch,
  parseCollectionWire,
  serializeCollectionSearch,
} from '../lib/collection-search';
import { parseSearch, stringifySearch } from '../lib/search-params';
import { useSessionState } from '../lib/session';

const scoreFormatter = new Intl.NumberFormat('fr-FR');
const dateFormatter = new Intl.DateTimeFormat('fr-FR');

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    basic: sortFn_basic,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
});

type CollectionRow = CollectionCard & { exemplaireCount: number };

const columnHelper = createColumnHelper<typeof features, CollectionRow>();

const columns = columnHelper.columns([
  columnHelper.accessor('nom', {
    header: COLLECTION.columns.nom,
    cell: (info) => {
      const card = info.row.original;
      return (
        <div className="flex items-center gap-3">
          <CardLink
            cardId={card.id}
            label={cardLinkLabel(card.nom)}
            className="w-[120px] shrink-0 md:w-[140px]"
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
              className="w-[120px] shrink-0 md:w-[140px]"
            />
          </CardLink>
          <div className="min-w-0 md:hidden">
            <p className="font-display text-[15px] font-semibold leading-tight text-vellum line-clamp-2">
              {card.nom}
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/60">
              {CATEGORY_LABELS[card.category]} · {scoreFormatter.format(card.score)} pts
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <RarityBadge rarity={card.rarity} />
              {card.category === 'COMMUNE' ? (
                <span className="font-mono text-[10px] tabular-nums text-vellum/60">
                  {codePostalLabel(card.codePostal)}
                </span>
              ) : null}
              <span className="font-mono text-[10px] tabular-nums text-brass">
                {exemplairesCountLabel(card.exemplaireCount)}
              </span>
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
    cell: (info) => (
      <span className="text-[15px] text-vellum/75">{CATEGORY_LABELS[info.getValue()]}</span>
    ),
  }),
  columnHelper.accessor('rarity', {
    header: COLLECTION.columns.rarity,
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
  columnHelper.accessor((row) => row.codePostal ?? '', {
    id: 'codePostal',
    header: COLLECTION.columns.codePostal,
    sortFn: 'text',
    cell: (info) => (
      <span className="whitespace-nowrap font-mono tabular-nums text-vellum/75">
        {codePostalLabel(info.row.original.codePostal)}
      </span>
    ),
  }),
  columnHelper.accessor('exemplaireCount', {
    header: COLLECTION.columns.exemplaires,
    sortFn: 'basic',
    cell: (info) => (
      <span className="whitespace-nowrap font-mono tabular-nums text-brass">
        {exemplairesCountLabel(info.getValue())}
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
  'grid grid-cols-1 items-center gap-6 px-5 py-3 md:grid-cols-[140px_minmax(0,1.15fr)_minmax(0,0.9fr)_minmax(0,0.6fr)_minmax(0,0.7fr)_minmax(0,1.05fr)_minmax(0,0.9fr)_minmax(0,0.35fr)] md:gap-4 md:py-2';

const inputClass =
  'h-10 rounded-[2px] border border-veil bg-cabinet-sunk px-3 text-[13px] text-vellum placeholder:text-vellum/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass';

const outlineButtonClass =
  'inline-flex min-h-10 items-center justify-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale disabled:cursor-not-allowed disabled:opacity-40';

const legendClass = 'font-mono text-[10px] uppercase tracking-[0.18em] text-vellum/60';

const fieldsetClass = 'm-0 border-0 p-0';

const chipClass =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[2px] border px-3 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors duration-150';

const EMPTY_ITEMS: CollectionCard[] = [];

type CommitFilters = (next: CollectionFilters, options: { replace: boolean }) => void;

// L'ordre exposé reste celui du domaine (`CATEGORY` / `RARITY`), pas celui des clics.
function toggled<T>(values: readonly T[], value: T, domain: readonly T[]): T[] {
  const next = values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
  return domain.filter((entry) => next.includes(entry));
}

function chipStateClass(active: boolean): string {
  return active
    ? 'border-brass bg-brass/10 text-brass'
    : 'border-veil text-vellum/65 hover:border-brass/50 hover:text-vellum';
}

export const Route = createFileRoute('/collection')({
  validateSearch: (search: Record<string, unknown>) => parseCollectionWire(search),
  component: CollectionPage,
});

function CollectionPage() {
  const session = useSessionState();
  const search = Route.useSearch();

  if (session.status === 'loading') {
    return <p className="text-sm text-vellum/70">{COLLECTION.loadingSession}</p>;
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
        <p className="salon-eyebrow">SALLE II · LE CADASTRE</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          {COLLECTION.title}
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-4 text-[15px] leading-relaxed text-vellum/70">{COLLECTION.subtitle}</p>
      </header>
      <div className="mt-8">
        <CollectionBody search={search} />
      </div>
    </section>
  );
}

function CollectionBody({ search }: { search: CollectionSearchWire }) {
  const collectionQuery = useQuery(collectionQueryOptions);
  const navigate = useNavigate();

  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );

  useEffect(() => {
    const query = window.matchMedia('(min-width: 768px)');
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const filters = useMemo(() => parseCollectionSearch(search), [search]);
  const items = collectionQuery.data?.items ?? EMPTY_ITEMS;
  const total = collectionQuery.data?.total ?? 0;
  const visible = useMemo(() => filterCollectionCards(items, filters), [items, filters]);
  const groups = useMemo(() => groupExemplaires(visible), [visible]);

  const commitFilters = useCallback<CommitFilters>(
    (next, options) => {
      navigate({
        to: '/collection',
        search: serializeCollectionSearch(next),
        replace: options.replace,
      });
    },
    [navigate],
  );

  // La forme transportée par l'URL est unique. Une seule normalisation réécrit
  // l'adresse quand elle s'en écarte : ordre du domaine, doublons retirés, clés
  // dans l'ordre `categorie, rarete, q`, virgules littérales, et
  // `commune` — un point d'entrée, jamais un état — remplacé par `q`.
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  // Les deux côtés de la comparaison se lisent dans **le même instantané** : `current`
  // relit `searchStr`, donc la cible se dérive de `searchStr` et jamais de la prop
  // `search`. Celle-ci n'est rattrapée par le routeur qu'après validation ; tant qu'elle
  // retarde, `current` porte la nouvelle adresse quand `canonical` porte encore
  // l'ancienne, et normaliser écrasait le filtre qui venait d'être posé (le clic sur
  // `Région` annulé par un retour à `/collection`). Dériver les deux du même `searchStr`
  // rend cet écart impossible par construction.
  const liveSearch = useMemo(() => parseSearch(searchStr), [searchStr]);
  const liveFilters = useMemo(() => parseCollectionSearch(liveSearch), [liveSearch]);
  const liveCommune = typeof liveSearch.commune === 'string' ? liveSearch.commune : null;
  const liveTarget = useMemo(
    () => ({ ...liveFilters, q: liveCommune ?? liveFilters.q }),
    [liveFilters, liveCommune],
  );
  const canonical = useMemo(
    () => stringifySearch(serializeCollectionSearch(liveTarget)),
    [liveTarget],
  );
  // Une même adresse s'écrit de plusieurs façons : clé répétée (`?rarete=RARE&rarete=RUE`)
  // ou liste (`?rarete=RARE,RUE`), `%2C` ou `,`, `+` ou `%20`, `?` absent sur un search
  // vide. Comparer les graphies brutes ferait naviguer sans fin ; relire puis réécrire par
  // les deux mêmes fonctions ramène les deux côtés à la forme unique que le routeur écrit.
  const current = useMemo(() => stringifySearch(liveSearch), [liveSearch]);
  const routerStatus = useRouterState({ select: (state) => state.status });

  useEffect(() => {
    // Ceinture et bretelles : la course est déjà impossible, les deux côtés venant du
    // même instantané, mais on ne réécrit jamais une adresse en cours de transition.
    if (routerStatus !== 'idle') return;
    // La cible est déjà la salle courante : rien à réécrire. C'est aussi ce qui arrête
    // la normalisation après la navigation, `current` valant alors `canonical`.
    if (current === canonical) return;
    navigate({
      to: '/collection',
      search: serializeCollectionSearch(liveTarget),
      replace: true,
    });
  }, [routerStatus, current, canonical, navigate, liveTarget]);

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
        <div className="space-y-4">
          <CollectionFiltersPanel
            filters={filters}
            total={total}
            visibleCount={visible.length}
            groupCount={groups.length}
            isDesktop={isDesktop}
            onCommit={commitFilters}
          />
          {visible.length === 0 ? (
            <div className="border-y border-veil px-4 py-16 text-center">
              <p className="font-display text-lg italic text-vellum/60">
                {COLLECTION_FILTERED_EMPTY.title}
              </p>
              <p className="mt-2 font-display text-base italic text-vellum/60">
                {COLLECTION_FILTERED_EMPTY.description}
              </p>
              <button
                type="button"
                onClick={() => commitFilters(EMPTY_COLLECTION_FILTERS, { replace: false })}
                className={`mt-6 ${outlineButtonClass}`}
              >
                {COLLECTION_FILTERS.reset}
              </button>
            </div>
          ) : (
            <CollectionTable groups={groups} total={total} isDesktop={isDesktop} />
          )}
        </div>
      )}
    </div>
  );
}

interface CollectionFiltersPanelProps {
  filters: CollectionFilters;
  total: number;
  visibleCount: number;
  groupCount: number;
  isDesktop: boolean;
  onCommit: CommitFilters;
}

function CollectionFiltersPanel({
  filters,
  total,
  visibleCount,
  groupCount,
  isDesktop,
  onCommit,
}: CollectionFiltersPanelProps) {
  const [pending, setPending] = useState(filters.q);
  // Ce que nous avons nous-mêmes écrit dans l'URL : réaligner la saisie sur tout `q`
  // validé écraserait une frappe tapée pendant la fenêtre entre le minuteur et
  // l'atterrissage de la navigation. Seule une valeur venue d'ailleurs (retour arrière)
  // réécrit donc le champ.
  const lastEmitted = useRef(filters.q);

  // Le retour arrière réécrit l'URL sous la saisie : la saisie s'y réaligne, sauf si
  // l'URL porte précisément le `q` que nous venons d'émettre.
  useEffect(() => {
    if (filters.q !== lastEmitted.current) {
      lastEmitted.current = filters.q;
      setPending(filters.q);
    }
  }, [filters.q]);

  // Anti-ré-bond : la frappe ne remplace l'URL qu'après 250 ms, et sans historique.
  useEffect(() => {
    if (pending === filters.q) return;
    const timer = window.setTimeout(() => {
      lastEmitted.current = pending;
      onCommit({ ...filters, q: pending }, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [pending, filters, onCommit]);

  return (
    <div className="space-y-3">
      <p aria-live="polite" className="font-mono text-[11px] text-vellum/60">
        {collectionGroupsLabel(visibleCount, groupCount, total)}
      </p>
      <details open={isDesktop} className="rounded-sheet border border-veil bg-cabinet-raised">
        <summary className="cursor-pointer px-4 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-brass md:px-5">
          {COLLECTION_FILTERS.summary}
        </summary>
        <div className="space-y-5 px-4 pb-4 md:px-5 md:pb-5">
          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>{COLLECTION_FILTERS.categorie}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={filters.categorie.length === 0}
                onClick={() => onCommit({ ...filters, categorie: [] }, { replace: false })}
                className={`${chipClass} ${chipStateClass(filters.categorie.length === 0)}`}
              >
                {COLLECTION.allValues}
              </button>
              {CATEGORY.map((categorie) => {
                const active = filters.categorie.includes(categorie);
                return (
                  <button
                    key={categorie}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onCommit(
                        { ...filters, categorie: toggled(filters.categorie, categorie, CATEGORY) },
                        { replace: false },
                      )
                    }
                    className={`${chipClass} ${chipStateClass(active)}`}
                  >
                    {CATEGORY_LABELS[categorie]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>{COLLECTION_FILTERS.rarete}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {RARITY.map((rarete) => {
                const active = filters.rarete.includes(rarete);
                return (
                  // biome-ignore lint/a11y/useSemanticElements: le palier de rareté est un bouton bascule, pas une case de formulaire — le contrat expose `aria-checked` sur `<button role="checkbox">`.
                  <button
                    key={rarete}
                    type="button"
                    role="checkbox"
                    aria-checked={active}
                    onClick={() =>
                      onCommit(
                        { ...filters, rarete: toggled(filters.rarete, rarete, RARITY) },
                        { replace: false },
                      )
                    }
                    className={`${chipClass} ${chipStateClass(active)}`}
                  >
                    <span aria-hidden="true">{active ? '☑' : '☐'}</span>
                    {RARITY_LABELS[rarete]}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className={fieldsetClass}>
            <legend className={legendClass}>{COLLECTION_FILTERS.recherche}</legend>
            <label htmlFor="collection-filter-search" className="sr-only">
              {COLLECTION_FILTERS.recherche}
            </label>
            <input
              id="collection-filter-search"
              type="search"
              value={pending}
              placeholder={COLLECTION_FILTERS.recherchePlaceholder}
              onChange={(event) => setPending(event.target.value)}
              className={`${inputClass} mt-2 w-full md:max-w-sm`}
            />
          </fieldset>

          <div className="flex justify-end border-t border-veil pt-4">
            <button
              type="button"
              onClick={() => onCommit(EMPTY_COLLECTION_FILTERS, { replace: false })}
              className={outlineButtonClass}
            >
              {COLLECTION_FILTERS.reset}
            </button>
          </div>
        </div>
      </details>
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
  groups: ExemplaireGroup<CollectionCard>[];
  total: number;
  isDesktop: boolean;
}

function CollectionTable({ groups, total, isDesktop }: CollectionTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const rowsData = useMemo<CollectionRow[]>(
    () => groups.map((group) => ({ ...group.representative, exemplaireCount: group.count })),
    [groups],
  );

  const table = useTable({
    features,
    columns,
    data: rowsData,
    state: { sorting },
    onSortingChange: setSorting,
  });

  const listRef = useRef<HTMLDivElement>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

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
  // Le pas se déduit de la planche : 120 × 7/5 = 168, plus py-3 (24) donne 192 sur
  // mobile ; 140 × 7/5 = 196, plus 24 donne 220 sur bureau. `measureElement` reste
  // l'autorité, l'estimation ne dimensionne que la barre de défilement.
  const rowVirtualizer = useWindowVirtualizer({
    count: rows.length,
    estimateSize: () => (isDesktop ? 220 : 192),
    scrollMargin,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: 8,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Filtrer change la liste : on ne ramène la fenêtre sur l'en-tête que lorsqu'il a
  // quitté le haut du viewport — un clic sur un filtre visible ne déplace rien.
  const previousLength = useRef(rows.length);

  useEffect(() => {
    if (previousLength.current === rows.length) return;
    previousLength.current = rows.length;
    const node = listRef.current;
    if (!node) return;
    const top = node.getBoundingClientRect().top;
    if (top < 0) window.scrollTo({ top: window.scrollY + top - 12, behavior: 'auto' });
  }, [rows.length]);

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-vellum/60">
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
