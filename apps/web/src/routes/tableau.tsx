import type { TableauAlignment, TableauSlot } from '@hexamap/shared';
import {
  evaluateTableauAlignment,
  slotMatchesCategory,
  TABLEAU_SLOT_LABELS,
  TABLEAU_SLOTS,
  tableauScore,
} from '@hexamap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Button } from '../components/button';
import { FormError } from '../components/form-error';
import { ComboBoard, type TableauSelection } from '../components/tableau/combo-board';
import { MultiplierPanel } from '../components/tableau/multiplier-panel';
import { TextField } from '../components/text-field';
import { Card } from '../components/ui/Card';
import { RarityBadge } from '../components/ui/rarity-badge';
import {
  drawerTitleLabel,
  multiplierLabel,
  resultsLabel,
  TABLEAU,
  TABLEAUX_LIST,
} from '../content/tableau';
import { CATEGORY_LABELS } from '../content/tickets';
import {
  type CollectionCard,
  collectionErrorMessage,
  collectionQueryOptions,
} from '../lib/collection';
import { useSession } from '../lib/session';
import {
  type CreatedTableau,
  createTableau,
  tableauErrorMessage,
  tableauPreviewQueryOptions,
  tableauxListQueryKey,
} from '../lib/tableaux';

const scoreFormatter = new Intl.NumberFormat('fr-FR');

type Selection = TableauSelection;

export const Route = createFileRoute('/tableau')({
  component: TableauPage,
});

function TableauPage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-ink-secondary">{TABLEAU.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-sign-ochre">
          {TABLEAU.eyebrow}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">{TABLEAU.title}</h1>
        <p className="text-ink-secondary">{TABLEAU.subtitle}</p>
      </header>
      <TableauBody />
    </section>
  );
}

function TableauBody() {
  const collectionQuery = useQuery(collectionQueryOptions);

  if (collectionQuery.isPending) {
    return <p className="text-ink-secondary">{TABLEAU.loading}</p>;
  }

  if (collectionQuery.isError) {
    return (
      <div className="space-y-4 rounded-md border-2 border-border bg-surface shadow-tactile p-6">
        <FormError message={collectionErrorMessage(collectionQuery.error)} />
        <Button onClick={() => void collectionQuery.refetch()}>{TABLEAU.retry}</Button>
      </div>
    );
  }

  const items = collectionQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-md border-2 border-border bg-surface p-10 text-center">
        <h2 className="text-xl font-semibold text-ink">{TABLEAU.emptyCollectionTitle}</h2>
        <p className="mt-1 text-ink-secondary">{TABLEAU.emptyCollectionDescription}</p>
      </div>
    );
  }

  return <TableauBuilder items={items} />;
}

function TableauBuilder({ items }: { items: CollectionCard[] }) {
  const [selection, setSelection] = useState<Selection>({});
  const [openSlot, setOpenSlot] = useState<TableauSlot | null>(null);
  const [name, setName] = useState('');
  const [created, setCreated] = useState<CreatedTableau | null>(null);

  const preview = useQuery(tableauPreviewQueryOptions(selection));

  // Le multiplicateur et le total viennent exclusivement des fonctions partagées.
  const alignment = preview.data ? evaluateTableauAlignment(preview.data.geography) : null;
  const scores = {
    region: selection.REGION?.score ?? 0,
    departement: selection.DEPARTEMENT?.score ?? 0,
    commune: selection.COMMUNE?.score ?? 0,
    rue: selection.RUE?.score ?? 0,
  };
  const total = alignment ? tableauScore(scores, alignment.links) : null;
  const complete = TABLEAU_SLOTS.every((slot) => selection[slot] !== undefined);
  const recalculating = preview.isFetching && preview.isPlaceholderData;

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: createTableau,
    onSuccess: (data) => {
      setCreated(data);
      queryClient.invalidateQueries({ queryKey: tableauxListQueryKey });
    },
  });

  function selectCard(slot: TableauSlot, card: CollectionCard) {
    setSelection((prev) => ({ ...prev, [slot]: card }));
    setOpenSlot(null);
  }

  function removeCard(slot: TableauSlot) {
    setSelection((prev) => {
      const next = { ...prev };
      delete next[slot];
      return next;
    });
  }

  function resetBuilder() {
    setSelection({});
    setName('');
    setCreated(null);
  }

  function handleSave() {
    const region = selection.REGION;
    const departement = selection.DEPARTEMENT;
    const commune = selection.COMMUNE;
    const rue = selection.RUE;
    if (!region || !departement || !commune || !rue) return;
    createMutation.mutate({
      name: name.trim() || undefined,
      regionCardId: region.id,
      departementCardId: departement.id,
      communeCardId: commune.id,
      rueCardId: rue.id,
    });
  }

  if (created) {
    return <CreatedPanel tableau={created} onReset={resetBuilder} />;
  }

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <aside className="order-first lg:order-last lg:sticky lg:top-6 lg:w-80 lg:shrink-0">
        <MultiplierPanel alignment={alignment} />
      </aside>

      <div className="min-w-0 flex-1 space-y-6">
        <ComboBoard
          selection={selection}
          alignment={alignment}
          onOpen={setOpenSlot}
          onRemove={removeCard}
        />

        {recalculating ? (
          <p role="status" className="font-mono text-xs text-ink-muted">
            {TABLEAU.recalculating}
          </p>
        ) : null}

        <ScoreDetail
          selection={selection}
          alignment={alignment}
          total={total}
          complete={complete}
        />

        <section className="space-y-4 rounded-md border-2 border-border bg-surface shadow-tactile p-5">
          <TextField
            label={TABLEAU.nameLabel}
            placeholder={TABLEAU.namePlaceholder}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
          />
          <Button
            onClick={handleSave}
            disabled={!complete}
            isPending={createMutation.isPending}
            className="w-full"
          >
            {TABLEAU.save}
          </Button>
          <FormError
            message={createMutation.isError ? tableauErrorMessage(createMutation.error) : null}
          />
        </section>
      </div>

      {openSlot ? (
        <CardDrawer
          slot={openSlot}
          items={items}
          selection={selection}
          onSelect={selectCard}
          onClose={() => setOpenSlot(null)}
        />
      ) : null}
    </div>
  );
}

interface ScoreDetailProps {
  selection: Selection;
  alignment: TableauAlignment | null;
  total: number | null;
  complete: boolean;
}

function ScoreDetail({ selection, alignment, total, complete }: ScoreDetailProps) {
  const sousTotal = TABLEAU_SLOTS.reduce((sum, slot) => sum + (selection[slot]?.score ?? 0), 0);
  const multiplier = alignment?.multiplier ?? 1;

  return (
    <section className="rounded-md border-2 border-border bg-surface shadow-tactile p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-secondary">
        {TABLEAU.scoreTitle}
      </h2>
      <dl className="mt-3 space-y-2">
        {TABLEAU_SLOTS.map((slot) => {
          const card = selection[slot];
          return (
            <div key={slot} className="flex items-center justify-between text-sm">
              <dt className="text-ink-secondary">
                {TABLEAU_SLOT_LABELS[slot]}
                {card ? <span className="ml-2 text-xs text-ink-muted">{card.nom}</span> : null}
              </dt>
              <dd className="font-mono tabular-nums text-ink">
                {scoreFormatter.format(card?.score ?? 0)}
              </dd>
            </div>
          );
        })}
        <div className="flex items-center justify-between border-t border-border pt-2 text-sm">
          <dt className="font-medium text-ink-secondary">{TABLEAU.subTotal}</dt>
          <dd className="font-mono tabular-nums font-medium text-ink">
            {scoreFormatter.format(sousTotal)}
          </dd>
        </div>
        {complete ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <dt className="text-ink-secondary">{TABLEAU.multiplierLine}</dt>
              <dd className="font-mono tabular-nums text-sign-ochre">
                {multiplierLabel(multiplier)}
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-2 text-base">
              <dt className="font-semibold text-ink">{TABLEAU.totalLine}</dt>
              <dd className="font-mono tabular-nums font-black text-sign-ochre">
                {total !== null ? scoreFormatter.format(total) : '—'}
              </dd>
            </div>
          </>
        ) : (
          <p className="pt-2 text-sm text-ink-muted">{TABLEAU.incompleteHint}</p>
        )}
      </dl>
    </section>
  );
}

interface CardDrawerProps {
  slot: TableauSlot;
  items: CollectionCard[];
  selection: Selection;
  onSelect: (slot: TableauSlot, card: CollectionCard) => void;
  onClose: () => void;
}

function CardDrawer({ slot, items, selection, onSelect, onClose }: CardDrawerProps) {
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  const eligible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((card) => {
      if (!slotMatchesCategory(slot, card.category)) return false;
      if (card.locked) return false;
      if (query === '') return true;
      return card.nom.toLowerCase().includes(query) || card.refCode.toLowerCase().includes(query);
    });
  }, [items, slot, search]);

  const rowVirtualizer = useVirtualizer<HTMLDivElement, HTMLButtonElement>({
    count: eligible.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 64,
    getItemKey: (index) => eligible[index]?.id ?? index,
    overscan: 8,
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <div className="absolute inset-0 bg-ink/60" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l-2 border-border bg-surface shadow-tactile-lg"
      >
        <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {drawerTitleLabel(TABLEAU_SLOT_LABELS[slot])}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={TABLEAU.drawerClose}
            className="rounded-md p-2 text-ink-secondary transition-colors duration-150 hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-sign-blue"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-border px-4 py-3">
          <TextField
            label={TABLEAU.searchLabel}
            placeholder={TABLEAU.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <p className="mt-2 text-sm text-ink-secondary">{resultsLabel(eligible.length)}</p>
        </div>

        {eligible.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <p className="text-ink-muted">{TABLEAU.noResults}</p>
          </div>
        ) : (
          <div ref={scrollRef} className="flex-1 overflow-auto p-4">
            <div style={{ position: 'relative', height: rowVirtualizer.getTotalSize() }}>
              {virtualItems.map((virtualItem) => {
                const card = eligible[virtualItem.index];
                if (!card) return null;
                const usedElsewhere = Object.entries(selection).some(
                  ([usedSlot, usedCard]) => usedSlot !== slot && usedCard?.id === card.id,
                );
                return (
                  <button
                    key={card.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualItem.index}
                    type="button"
                    disabled={usedElsewhere}
                    onClick={() => onSelect(slot, card)}
                    className="absolute top-0 left-0 flex h-16 w-full items-center gap-3 rounded-md border-2 border-border bg-surface px-3 text-left transition-colors duration-150 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    style={{ transform: `translateY(${virtualItem.start}px)` }}
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
                      decorative
                      className="w-8 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink">{card.nom}</p>
                      <p className="truncate text-xs text-ink-secondary">
                        {CATEGORY_LABELS[card.category]} · {card.refCode}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <RarityBadge rarity={card.rarity} />
                      <p className="mt-1 text-sm font-semibold tabular-nums text-ink">
                        {scoreFormatter.format(card.score)}
                      </p>
                    </div>
                    {usedElsewhere ? (
                      <span className="shrink-0 text-xs text-sign-ochre">
                        {TABLEAU.usedElsewhere}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CreatedPanel({ tableau, onReset }: { tableau: CreatedTableau; onReset: () => void }) {
  return (
    <section className="space-y-6 rounded-sm border-2 border-sign-gold bg-paper p-8 shadow-tactile text-center">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-sign-ochre">
          {TABLEAU.successEyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-bold">{TABLEAU.successTitle}</h2>
      </div>
      <p className="text-lg font-medium text-ink">{tableau.name}</p>
      <dl className="mx-auto grid max-w-sm grid-cols-2 gap-4">
        <div className="rounded-md border-2 border-border bg-surface shadow-tactile-sm p-4">
          <dt className="text-sm text-ink-secondary">{TABLEAU.totalLine}</dt>
          <dd className="mt-1 font-mono text-2xl font-black tabular-nums text-sign-ochre">
            {scoreFormatter.format(tableau.total)}
          </dd>
        </div>
        <div className="rounded-md border-2 border-border bg-surface shadow-tactile-sm p-4">
          <dt className="text-sm text-ink-secondary">{TABLEAU.multiplierLine}</dt>
          <dd className="mt-1 font-mono text-2xl font-black tabular-nums text-sign-ochre">
            {multiplierLabel(tableau.alignment.multiplier)}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onReset}>{TABLEAU.createAnother}</Button>
        <Link
          to="/tableaux"
          className="inline-flex items-center justify-center rounded-md border border-border px-4 py-2 text-sm font-medium text-ink transition-colors duration-150 hover:bg-muted"
        >
          {TABLEAUX_LIST.viewList}
        </Link>
      </div>
    </section>
  );
}
