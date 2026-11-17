import type { Rarity, TableauAlignment, TableauSlot } from '@hexamap/shared';
import {
  evaluateTableauAlignment,
  slotMatchesCategory,
  TABLEAU_LINK_KEYS,
  TABLEAU_LINK_LABELS,
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
import { TextField } from '../components/text-field';
import { Card } from '../components/ui/Card';
import {
  drawerTitleLabel,
  linksLabel,
  MULTIPLIER_TIERS,
  multiplierAnnouncement,
  multiplierLabel,
  removeCardAria,
  resultsLabel,
  TABLEAU,
  TABLEAUX_LIST,
} from '../content/tableau';
import { CATEGORY_LABELS, RARITY_LABELS, RARITY_STYLES } from '../content/tickets';
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

type Selection = Partial<Record<TableauSlot, CollectionCard>>;

export const Route = createFileRoute('/tableau')({
  component: TableauPage,
});

function TableauPage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-slate-400">{TABLEAU.loadingSession}</p>;
  }

  if (!session.data?.user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">
          {TABLEAU.eyebrow}
        </p>
        <h1 className="text-4xl font-bold tracking-tight">{TABLEAU.title}</h1>
        <p className="text-slate-400">{TABLEAU.subtitle}</p>
      </header>
      <TableauBody />
    </section>
  );
}

function TableauBody() {
  const collectionQuery = useQuery(collectionQueryOptions);

  if (collectionQuery.isPending) {
    return <p className="text-slate-400">{TABLEAU.loading}</p>;
  }

  if (collectionQuery.isError) {
    return (
      <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <FormError message={collectionErrorMessage(collectionQuery.error)} />
        <Button onClick={() => void collectionQuery.refetch()}>{TABLEAU.retry}</Button>
      </div>
    );
  }

  const items = collectionQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-10 text-center">
        <h2 className="text-xl font-semibold text-slate-100">{TABLEAU.emptyCollectionTitle}</h2>
        <p className="mt-1 text-slate-400">{TABLEAU.emptyCollectionDescription}</p>
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
        <div className="grid gap-4 sm:grid-cols-2">
          {TABLEAU_SLOTS.map((slot) => (
            <Slot
              key={slot}
              slot={slot}
              card={selection[slot]}
              onOpen={() => setOpenSlot(slot)}
              onRemove={() => removeCard(slot)}
            />
          ))}
        </div>

        {recalculating ? (
          <p role="status" className="text-xs text-slate-500">
            {TABLEAU.recalculating}
          </p>
        ) : null}

        <ScoreDetail
          selection={selection}
          alignment={alignment}
          total={total}
          complete={complete}
        />

        <section className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
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

interface SlotProps {
  slot: TableauSlot;
  card: CollectionCard | undefined;
  onOpen: () => void;
  onRemove: () => void;
}

function Slot({ slot, card, onOpen, onRemove }: SlotProps) {
  const label = TABLEAU_SLOT_LABELS[slot];

  return (
    <div className="flex flex-col rounded-xl border border-slate-800 bg-slate-900/60">
      <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-2">
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          className="flex flex-1 items-center gap-2 rounded text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <span className="text-sm font-semibold uppercase tracking-wide text-amber-400">
            {label}
          </span>
          <span className="text-xs text-slate-400">
            {card ? TABLEAU.slotModify : TABLEAU.slotChoose}
          </span>
        </button>
        {card ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeCardAria(card.nom)}
            className="rounded p-1 text-slate-400 transition-colors hover:text-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            ✕
          </button>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="flex flex-1 items-center gap-3 px-4 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-400"
      >
        {card ? (
          <>
            <Card
              type={card.category}
              rarity={card.rarity}
              name={card.nom}
              score={card.score}
              refCode={card.refCode}
              blasonUrl={card.blasonUrl}
              blasonCredit={card.blasonCredit}
              locked={card.locked}
              variant="detailed"
              decorative
              className="w-28 shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-100">{card.nom}</p>
              <p className="text-xs text-slate-400">
                {CATEGORY_LABELS[card.category]} · {card.refCode}
              </p>
            </div>
            <div className="text-right">
              <RarityBadge rarity={card.rarity} />
              <p className="mt-1 text-sm font-semibold tabular-nums text-slate-200">
                {scoreFormatter.format(card.score)}
              </p>
            </div>
          </>
        ) : (
          <p className="py-4 text-sm text-slate-500">{TABLEAU.slotEmpty}</p>
        )}
      </button>
    </div>
  );
}

function MultiplierPanel({ alignment }: { alignment: TableauAlignment | null }) {
  const links = alignment?.links ?? 0;
  const multiplier = alignment?.multiplier ?? 1;
  const tier = MULTIPLIER_TIERS[links] ?? MULTIPLIER_TIERS[0];
  const breakdown =
    alignment?.breakdown ??
    TABLEAU_LINK_KEYS.map((key) => ({ key, valid: false, label: TABLEAU_LINK_LABELS[key] }));

  return (
    <section className={`rounded-2xl border p-5 transition-all duration-300 ${tier.panelClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-300">
          {TABLEAU.multiplierTitle}
        </p>
        <span
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tier.badgeClass}`}
        >
          {linksLabel(links)}
        </span>
      </div>

      <p className={`mt-3 text-5xl font-black tabular-nums ${tier.surfaceClass}`}>
        {multiplierLabel(multiplier)}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{tier.title}</p>
      <p className="mt-1 text-xs text-slate-400">{tier.hint}</p>

      <div className="mt-4 flex gap-1.5" aria-hidden="true">
        {breakdown.map((link) => (
          <span
            key={link.key}
            className={`h-1.5 flex-1 rounded-full ${link.valid ? 'bg-amber-400' : 'bg-slate-700'}`}
          />
        ))}
      </div>

      <p className="mt-4 text-xs font-medium uppercase tracking-wide text-slate-500">
        {TABLEAU.linksTitle}
      </p>
      <ul className="mt-2 space-y-2">
        {breakdown.map((link) => (
          <li key={link.key} className="flex items-start justify-between gap-2 text-sm">
            <span className="text-slate-300">{link.label}</span>
            <span aria-hidden="true" className={link.valid ? 'text-emerald-400' : 'text-slate-600'}>
              {link.valid ? '✓' : '✗'}
            </span>
          </li>
        ))}
      </ul>

      <div className="sr-only" aria-live="polite">
        {multiplierAnnouncement(multiplier, links)}
      </div>
    </section>
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
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
        {TABLEAU.scoreTitle}
      </h2>
      <dl className="mt-3 space-y-2">
        {TABLEAU_SLOTS.map((slot) => {
          const card = selection[slot];
          return (
            <div key={slot} className="flex items-center justify-between text-sm">
              <dt className="text-slate-400">
                {TABLEAU_SLOT_LABELS[slot]}
                {card ? <span className="ml-2 text-xs text-slate-500">{card.nom}</span> : null}
              </dt>
              <dd className="tabular-nums text-slate-200">
                {scoreFormatter.format(card?.score ?? 0)}
              </dd>
            </div>
          );
        })}
        <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-sm">
          <dt className="font-medium text-slate-300">{TABLEAU.subTotal}</dt>
          <dd className="tabular-nums font-medium text-slate-100">
            {scoreFormatter.format(sousTotal)}
          </dd>
        </div>
        {complete ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <dt className="text-slate-400">{TABLEAU.multiplierLine}</dt>
              <dd className="tabular-nums text-amber-300">{multiplierLabel(multiplier)}</dd>
            </div>
            <div className="flex items-center justify-between border-t border-slate-800 pt-2 text-base">
              <dt className="font-semibold text-slate-100">{TABLEAU.totalLine}</dt>
              <dd className="tabular-nums font-black text-amber-400">
                {total !== null ? scoreFormatter.format(total) : '—'}
              </dd>
            </div>
          </>
        ) : (
          <p className="pt-2 text-sm text-slate-500">{TABLEAU.incompleteHint}</p>
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
      <div className="absolute inset-0 bg-slate-950/70" onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-slate-800 bg-slate-900 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-4 py-3">
          <h2 id={titleId} className="text-lg font-semibold text-slate-100">
            {drawerTitleLabel(TABLEAU_SLOT_LABELS[slot])}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={TABLEAU.drawerClose}
            className="rounded-md p-2 text-slate-400 transition-colors hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-800 px-4 py-3">
          <TextField
            label={TABLEAU.searchLabel}
            placeholder={TABLEAU.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <p className="mt-2 text-sm text-slate-400">{resultsLabel(eligible.length)}</p>
        </div>

        {eligible.length === 0 ? (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <p className="text-slate-500">{TABLEAU.noResults}</p>
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
                    className="absolute top-0 left-0 flex h-16 w-full items-center gap-3 rounded-lg border border-slate-800 bg-slate-900 px-3 text-left transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
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
                      <p className="truncate font-medium text-slate-100">{card.nom}</p>
                      <p className="truncate text-xs text-slate-400">
                        {CATEGORY_LABELS[card.category]} · {card.refCode}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <RarityBadge rarity={card.rarity} />
                      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-200">
                        {scoreFormatter.format(card.score)}
                      </p>
                    </div>
                    {usedElsewhere ? (
                      <span className="shrink-0 text-xs text-amber-400">
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
    <section className="space-y-6 rounded-2xl border border-amber-400/40 bg-amber-400/5 p-8 text-center">
      <div>
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">
          {TABLEAU.successEyebrow}
        </p>
        <h2 className="mt-2 text-2xl font-bold">{TABLEAU.successTitle}</h2>
      </div>
      <p className="text-lg font-medium text-slate-100">{tableau.name}</p>
      <dl className="mx-auto grid max-w-sm grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <dt className="text-sm text-slate-400">{TABLEAU.totalLine}</dt>
          <dd className="mt-1 text-2xl font-black tabular-nums text-amber-400">
            {scoreFormatter.format(tableau.total)}
          </dd>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <dt className="text-sm text-slate-400">{TABLEAU.multiplierLine}</dt>
          <dd className="mt-1 text-2xl font-black tabular-nums text-amber-400">
            {multiplierLabel(tableau.alignment.multiplier)}
          </dd>
        </div>
      </dl>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={onReset}>{TABLEAU.createAnother}</Button>
        <Link
          to="/tableaux"
          className="inline-flex items-center justify-center rounded-md border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-800"
        >
          {TABLEAUX_LIST.viewList}
        </Link>
      </div>
    </section>
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
