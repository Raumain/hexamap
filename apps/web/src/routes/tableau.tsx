import type { TableauAlignment, TableauSlot } from '@hexamap/shared';
import { slotMatchesCategory, TABLEAU_SLOT_LABELS, TABLEAU_SLOTS } from '@hexamap/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, Navigate } from '@tanstack/react-router';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Fragment, type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react';
import { FormError } from '../components/form-error';
import type { TableauSelection } from '../components/tableau/combo-board';
import { MultiplierPanel } from '../components/tableau/multiplier-panel';
import { TextField } from '../components/text-field';
import { Card } from '../components/ui/Card';
import { CardLink, cardLinkLabel } from '../components/ui/card-link';
import { OverlayPortal } from '../components/ui/overlay-portal';
import { RaritySeal } from '../components/ui/rarity-seal';
import {
  drawerTitleLabel,
  multiplierLabel,
  removeCardAria,
  resultsLabel,
  TABLEAU,
  TABLEAUX_LIST,
} from '../content/tableau';
import { CATEGORY_LABELS } from '../content/tickets';
import { CATEGORY_META, type CategoryMeta } from '../lib/category-theme';
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

type TableauLinkKey = TableauAlignment['breakdown'][number]['key'];

/** Lien géographique attaché à l'emplacement qui le précède, dans l'ordre du GDD. */
const LINK_FOR_SLOT: Partial<Record<TableauSlot, TableauLinkKey>> = {
  REGION: 'region-departement',
  DEPARTEMENT: 'departement-commune',
  COMMUNE: 'commune-rue',
};

const SLOT_META: Record<TableauSlot, CategoryMeta> = {
  REGION: CATEGORY_META.REGION,
  DEPARTEMENT: CATEGORY_META.DEPARTEMENT,
  COMMUNE: CATEGORY_META.COMMUNE,
  RUE: CATEGORY_META.RUE,
};

export const Route = createFileRoute('/tableau')({
  component: TableauPage,
});

function TableauPage() {
  const session = useSession();

  return (
    <section className="space-y-10">
      <header>
        <p className="salon-eyebrow">SALLE III · LA PLANCHE</p>
        <h1 className="mt-3 font-display text-4xl tracking-tight text-vellum md:text-5xl">
          La planche d'alignement
        </h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-vellum/70">{TABLEAU.subtitle}</p>
        <div className="brass-rule mt-5 w-24" />
      </header>

      {session.isPending ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
          {TABLEAU.loadingSession}
        </p>
      ) : !session.data?.user ? (
        <Navigate to="/login" />
      ) : (
        <TableauBody />
      )}
    </section>
  );
}

function TableauBody() {
  const collectionQuery = useQuery(collectionQueryOptions);

  if (collectionQuery.isPending) {
    return (
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
        {TABLEAU.loading}
      </p>
    );
  }

  if (collectionQuery.isError) {
    return (
      <div className="space-y-4 rounded-sheet border border-oxide/40 bg-cabinet-raised p-6">
        <FormError message={collectionErrorMessage(collectionQuery.error)} />
        <GhostButton onClick={() => void collectionQuery.refetch()}>{TABLEAU.retry}</GhostButton>
      </div>
    );
  }

  const items = collectionQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="rounded-sheet border border-veil bg-cabinet-raised p-10 text-center">
        <h2 className="font-display text-xl text-vellum">{TABLEAU.emptyCollectionTitle}</h2>
        <p className="mt-2 text-sm text-vellum/65">{TABLEAU.emptyCollectionDescription}</p>
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

  // L'alignement, le nombre de liens et le total viennent du serveur
  // (`GET /tableaux/preview`) : aucune règle géographique n'est réévaluée ici.
  const alignment = preview.data?.alignment ?? null;
  const scores = {
    region: selection.REGION?.score ?? 0,
    departement: selection.DEPARTEMENT?.score ?? 0,
    commune: selection.COMMUNE?.score ?? 0,
    rue: selection.RUE?.score ?? 0,
  };
  const base = scores.region + scores.departement + scores.commune + scores.rue;
  const total = preview.data?.total ?? null;
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
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="min-w-0 space-y-6">
        <div className="rounded-sheet border border-veil bg-cabinet-raised p-4 md:p-6">
          <div className="flex flex-col gap-0">
            {TABLEAU_SLOTS.map((slot, index) => {
              const key = LINK_FOR_SLOT[slot];
              const link =
                key === undefined
                  ? undefined
                  : alignment?.breakdown.find((entry) => entry.key === key);

              return (
                <Fragment key={slot}>
                  {index === 0 ? null : <SlotSeal link={link} />}
                  <SlotRow
                    slot={slot}
                    card={selection[slot]}
                    onOpen={() => setOpenSlot(slot)}
                    onRemove={() => removeCard(slot)}
                  />
                </Fragment>
              );
            })}
          </div>
        </div>

        <section className="space-y-4 rounded-sheet border border-veil bg-cabinet-raised p-5">
          <TextField
            label={TABLEAU.nameLabel}
            placeholder={TABLEAU.namePlaceholder}
            value={name}
            maxLength={80}
            onChange={(event) => setName(event.target.value)}
            tone="dark"
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!complete || createMutation.isPending}
            aria-busy={createMutation.isPending || undefined}
            className="inline-flex w-full items-center justify-center rounded-[2px] border border-brass-deep bg-brass px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale disabled:cursor-not-allowed disabled:opacity-50"
          >
            {createMutation.isPending ? 'Enregistrement…' : TABLEAU.save}
          </button>
          <FormError
            message={createMutation.isError ? tableauErrorMessage(createMutation.error) : null}
          />
        </section>

        {recalculating ? (
          <p
            role="status"
            className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/55"
          >
            {TABLEAU.recalculating}
          </p>
        ) : null}
      </div>

      <aside className="sticky top-6 space-y-4 self-start">
        <CalculationPlate
          base={base}
          multiplier={alignment?.multiplier ?? 1}
          total={total}
          complete={complete}
        />
        <MultiplierPanel alignment={alignment} />
      </aside>

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

/** Sceau de validation entre deux emplacements, alimenté par `alignment.breakdown`. */
function SlotSeal({ link }: { link: TableauAlignment['breakdown'][number] | undefined }) {
  return (
    <div className="relative flex h-7 items-center justify-center">
      <div aria-hidden="true" className="h-7 w-px bg-brass/35" />
      {link === undefined ? null : (
        <div className="absolute left-3 flex items-center gap-2">
          <span
            aria-hidden="true"
            className={`font-mono text-[11px] leading-none ${
              link.valid ? 'text-verdigris' : 'text-oxide'
            }`}
          >
            {link.valid ? '✓' : '✗'}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/60">
            {link.label}
          </span>
        </div>
      )}
    </div>
  );
}

interface SlotRowProps {
  slot: TableauSlot;
  card: CollectionCard | undefined;
  onOpen: () => void;
  onRemove: () => void;
}

function SlotRow({ slot, card, onOpen, onRemove }: SlotRowProps) {
  const meta = SLOT_META[slot];

  if (card === undefined) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="flex w-full items-center gap-4 rounded-[2px] border border-dashed border-veil-strong/70 bg-cabinet-sunk/40 p-3 text-left transition-colors duration-150 hover:border-brass/40"
      >
        <span className="flex h-12 w-9 shrink-0 items-center justify-center rounded-[2px] border border-veil text-brass/70">
          <CategoryGlyph glyph={meta.glyph} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block font-display text-[15px] text-vellum/65">Emplacement libre</span>
          <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/55">
            {TABLEAU_SLOT_LABELS[slot]}
          </span>
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-4 rounded-[2px] border border-veil bg-cabinet-sunk/30 p-3">
      <div className="relative shrink-0">
        <span
          aria-hidden="true"
          className="absolute top-0 left-1/2 z-10 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brass shadow-brass"
        />
        <CardLink cardId={card.id} label={cardLinkLabel(card.nom)} className="w-[132px] shrink-0">
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
            className="w-[132px] shrink-0"
          />
        </CardLink>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] text-vellum">{card.nom}</p>
        <p className="mt-0.5 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-vellum/60">
          {CATEGORY_LABELS[card.category]} · {card.refCode}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <RaritySeal rarity={card.rarity} size={18} />
          <button
            type="button"
            onClick={onOpen}
            className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55 transition-colors duration-150 hover:text-brass"
          >
            {TABLEAU.slotModify}
          </button>
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeCardAria(card.nom)}
            className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55 transition-colors duration-150 hover:text-oxide"
          >
            Retirer
          </button>
        </div>
      </div>
    </div>
  );
}

interface CalculationPlateProps {
  base: number;
  multiplier: number;
  total: number | null;
  complete: boolean;
}

/** Plaque de calcul : laiton sur vélin, total en Fraunces. */
function CalculationPlate({ base, multiplier, total, complete }: CalculationPlateProps) {
  return (
    <section aria-live="polite" className="vellum rounded-sheet p-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-deep">
        {TABLEAU.scoreTitle}
      </p>

      <div className="mt-5 space-y-4">
        <div className="flex items-baseline justify-between gap-4 border-b border-ink/12 pb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Score de base
          </span>
          <span className="font-mono text-lg tabular-nums text-ink-soft">
            {scoreFormatter.format(base)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 border-b border-ink/12 pb-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
            Alignement
          </span>
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-oxide font-display text-[15px] tabular-nums text-vellum">
            {multiplierLabel(multiplier)}
          </span>
        </div>

        {complete && total !== null ? (
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-faint">
              {TABLEAU.totalLine}
            </span>
            <span className="font-display text-5xl leading-none tabular-nums text-ink">
              {scoreFormatter.format(total)}
            </span>
          </div>
        ) : (
          <p className="font-display text-base italic text-ink-faint">{TABLEAU.incompleteHint}</p>
        )}
      </div>
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

/**
 * Hauteur nominale d'une ligne du tiroir. La ligne ne déclare plus sa hauteur :
 * c'est sa planche qui la dimensionne — `w-14`, rendue `decorative`, donc
 * `aspect-[4/5]`, soit 70 px — plus les 16 px de `py-2`. Cette constante ne sert
 * qu'à l'estimation d'avant-mesure du virtualiseur : elle doit valoir la mesure,
 * faute de quoi le défilement saute au premier passage.
 */
const DRAWER_ROW_ESTIMATE = 86;

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
    estimateSize: () => DRAWER_ROW_ESTIMATE,
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
    <OverlayPortal>
      <div className="fixed inset-0 z-40" role="presentation">
        <div className="absolute inset-0 bg-cabinet/80" onClick={onClose} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-x-0 bottom-0 z-40 flex max-h-[76vh] flex-col rounded-t-panel border-t border-brass/30 bg-cabinet-raised p-5 shadow-lifted md:left-[232px]"
        >
          <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-veil-strong" />

          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-xl text-vellum">
              {drawerTitleLabel(TABLEAU_SLOT_LABELS[slot])}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={TABLEAU.drawerClose}
              className="rounded-[2px] border border-veil px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/70 transition-colors duration-150 hover:border-brass/40 hover:text-brass"
            >
              {TABLEAU.drawerClose}
            </button>
          </div>

          <div className="mt-4 border-b border-veil pb-4">
            <TextField
              label={TABLEAU.searchLabel}
              placeholder={TABLEAU.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              tone="dark"
            />
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55">
              {resultsLabel(eligible.length)}
            </p>
          </div>

          {eligible.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-6 text-center">
              <p className="font-display text-base italic text-vellum/60">{TABLEAU.noResults}</p>
            </div>
          ) : (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto pt-3">
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
                      className="absolute top-0 left-0 flex w-full items-center gap-3 rounded-[2px] border border-veil bg-cabinet-sunk/40 px-3 py-2 text-left transition-colors duration-150 hover:border-brass/40 disabled:cursor-not-allowed disabled:opacity-40"
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
                        className="w-14 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[15px] text-vellum">{card.nom}</p>
                        <p className="truncate font-mono text-[9px] uppercase tracking-[0.12em] text-vellum/60">
                          {CATEGORY_LABELS[card.category]} · {card.refCode}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <RaritySeal rarity={card.rarity} size={18} />
                        <p className="mt-1 font-mono text-[11px] tabular-nums text-brass">
                          {scoreFormatter.format(card.score)}
                        </p>
                      </div>
                      {usedElsewhere ? (
                        <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-warn">
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
    </OverlayPortal>
  );
}

function CreatedPanel({ tableau, onReset }: { tableau: CreatedTableau; onReset: () => void }) {
  return (
    <section className="vellum mx-auto max-w-2xl rounded-sheet p-8 text-center">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-brass-deep">
        {TABLEAU.successEyebrow}
      </p>
      <h2 className="mt-3 font-display text-2xl text-ink">{TABLEAU.successTitle}</h2>
      <p className="mt-2 font-display text-lg italic text-ink-soft">{tableau.name}</p>

      <dl className="mx-auto mt-6 grid max-w-sm grid-cols-2 gap-4">
        <div className="rounded-[2px] border border-ink/12 p-4">
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
            {TABLEAU.totalLine}
          </dt>
          <dd className="mt-1 font-display text-3xl leading-none tabular-nums text-ink">
            {scoreFormatter.format(tableau.total)}
          </dd>
        </div>
        <div className="rounded-[2px] border border-ink/12 p-4">
          <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ink-faint">
            {TABLEAU.multiplierLine}
          </dt>
          <dd className="mt-1 font-display text-3xl leading-none tabular-nums text-ink">
            {multiplierLabel(tableau.alignment.multiplier)}
          </dd>
        </div>
      </dl>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center justify-center rounded-[2px] border border-brass-deep bg-brass px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-cabinet transition-colors duration-150 hover:bg-brass-pale"
        >
          {TABLEAU.createAnother}
        </button>
        <Link
          to="/tableaux"
          className="inline-flex items-center justify-center rounded-[2px] border border-ink/25 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.16em] text-ink-soft transition-colors duration-150 hover:border-ink/50 hover:text-ink"
        >
          {TABLEAUX_LIST.viewList}
        </Link>
      </div>
    </section>
  );
}

function CategoryGlyph({ glyph, className }: { glyph: string; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.2}
      strokeLinecap="square"
      className={className}
    >
      <path d={glyph} />
    </svg>
  );
}

function GhostButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-[2px] border border-veil px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/70 transition-colors duration-150 hover:border-brass/40 hover:text-brass"
    >
      {children}
    </button>
  );
}
