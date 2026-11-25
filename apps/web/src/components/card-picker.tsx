import { CATEGORY, type Category, RARITY, RARITY_LABELS, type Rarity } from '@hexamap/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useMemo, useRef, useState } from 'react';
import { cardsCountLabel, MARKET_MINE } from '../content/market';
import { CATEGORY_LABELS } from '../content/tickets';
import {
  EMPTY_PICKER_FILTERS,
  filterPickableCards,
  type PickerFilters,
  pickableCardLabel,
} from '../lib/card-picker';
import type { CollectionCard } from '../lib/collection';
import { Card } from './ui/Card';
import { RarityBadge } from './ui/rarity-badge';

// I-001 — le choix d'une carte à vendre. Le composant reçoit la collection déjà
// filtrée sur `locked = false`, ne fait aucune requête, et ne connaît ni le prix
// ni la mutation : le tap sélectionne, « Mettre en vente » vend (route).

/**
 * Hauteur nominale d'une ligne : planche `w-14` en `aspect-[4/5]` (70 px) plus
 * `py-2` (16 px). La ligne ne déclare pas de hauteur — le contenu la fixe — et
 * cette constante ne sert qu'à l'estimation d'avant-mesure du virtualiseur.
 */
const ROW_ESTIMATE = 86;

const scoreFormatter = new Intl.NumberFormat('fr-FR');

const fieldClass =
  'h-10 w-full rounded-[2px] border border-veil bg-cabinet-sunk px-3 text-[13px] text-vellum focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass';

const labelClass = 'block font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/60';

function chipClass(active: boolean): string {
  const base =
    'inline-flex min-h-8 items-center rounded-[2px] border px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass';
  return active
    ? `${base} border-brass bg-brass/15 text-brass-pale`
    : `${base} border-veil text-vellum/65 hover:border-brass/40 hover:text-vellum`;
}

export interface CardPickerProps {
  cards: readonly CollectionCard[];
  value: string;
  onChange: (cardId: string) => void;
}

function toggleValue<T>(list: readonly T[], entry: T): T[] {
  return list.includes(entry) ? list.filter((item) => item !== entry) : [...list, entry];
}

interface FilterChipsProps<T extends string> {
  label: string;
  options: readonly T[];
  selected: readonly T[];
  labelOf: (option: T) => string;
  onToggle: (option: T) => void;
  onClear: () => void;
}

function FilterChips<T extends string>({
  label,
  options,
  selected,
  labelOf,
  onToggle,
  onClear,
}: FilterChipsProps<T>) {
  return (
    <fieldset className="space-y-1.5">
      <legend className={labelClass}>{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={selected.length === 0}
          aria-label={`${label} : ${MARKET_MINE.pickerAllValues}`}
          onClick={onClear}
          className={chipClass(selected.length === 0)}
        >
          {MARKET_MINE.pickerAllValues}
        </button>
        {options.map((option) => {
          const active = selected.includes(option);
          return (
            <button
              key={option}
              type="button"
              aria-pressed={active}
              onClick={() => onToggle(option)}
              className={chipClass(active)}
            >
              {labelOf(option)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function CardPicker({ cards, value, onChange }: CardPickerProps) {
  const [filters, setFilters] = useState<PickerFilters>(EMPTY_PICKER_FILTERS);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => filterPickableCards(cards, filters), [cards, filters]);

  const virtualizer = useVirtualizer<HTMLElement, HTMLButtonElement>({
    count: filtered.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_ESTIMATE,
    getItemKey: (index) => filtered[index]?.id ?? index,
    overscan: 8,
  });

  const selected = useMemo(() => cards.find((card) => card.id === value) ?? null, [cards, value]);

  function applyFilters(next: PickerFilters): void {
    setFilters(next);
    scrollRef.current?.scrollTo({ top: 0 });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="sell-card-search" className={labelClass}>
          {MARKET_MINE.pickerSearchLabel}
        </label>
        <input
          id="sell-card-search"
          type="search"
          autoComplete="off"
          placeholder={MARKET_MINE.pickerSearchPlaceholder}
          value={filters.query}
          onChange={(event) => applyFilters({ ...filters, query: event.target.value })}
          className={fieldClass}
        />
      </div>

      <FilterChips<Category>
        label={MARKET_MINE.pickerCategoryLabel}
        options={CATEGORY}
        selected={filters.categories}
        labelOf={(option) => CATEGORY_LABELS[option]}
        onToggle={(option) =>
          applyFilters({ ...filters, categories: toggleValue(filters.categories, option) })
        }
        onClear={() => applyFilters({ ...filters, categories: [] })}
      />

      <FilterChips<Rarity>
        label={MARKET_MINE.pickerRarityLabel}
        options={RARITY}
        selected={filters.rarities}
        labelOf={(option) => RARITY_LABELS[option]}
        onToggle={(option) =>
          applyFilters({ ...filters, rarities: toggleValue(filters.rarities, option) })
        }
        onClear={() => applyFilters({ ...filters, rarities: [] })}
      />

      <p
        aria-live="polite"
        className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55"
      >
        {cardsCountLabel(filtered.length)}
      </p>

      {filtered.length === 0 ? (
        <p className="border-y border-veil px-4 py-10 text-center font-display text-base italic text-vellum/60">
          {MARKET_MINE.pickerEmpty}
        </p>
      ) : (
        <section
          ref={scrollRef}
          aria-label={MARKET_MINE.pickerListLabel}
          className="max-h-[min(22rem,42vh)] overflow-y-auto rounded-[2px]"
        >
          <div className="relative" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const card = filtered[virtualItem.index];
              if (!card) return null;
              const active = card.id === value;
              return (
                <button
                  key={card.id}
                  ref={virtualizer.measureElement}
                  data-index={virtualItem.index}
                  type="button"
                  aria-pressed={active}
                  aria-label={pickableCardLabel(card)}
                  onClick={() => onChange(card.id)}
                  className={`absolute top-0 left-0 flex w-full items-center gap-3 rounded-[2px] border px-2 py-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                    active
                      ? 'border-brass bg-brass/10'
                      : 'border-veil bg-cabinet-sunk/40 hover:border-brass/40'
                  }`}
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
                    variant="compact"
                    decorative
                    className="w-14 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[15px] leading-tight text-vellum">
                      {card.nom}
                    </span>
                    <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.12em] text-vellum/60">
                      {CATEGORY_LABELS[card.category]} · {card.refCode}
                    </span>
                    <span className="mt-1 block">
                      <RarityBadge rarity={card.rarity} />
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-brass">
                    {scoreFormatter.format(card.score)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}

      <p aria-live="polite" className="font-display text-[13px] text-vellum/80">
        {selected
          ? `${MARKET_MINE.pickerSelectionChosen} : ${selected.nom}`
          : MARKET_MINE.pickerSelectionNone}
      </p>
    </div>
  );
}
