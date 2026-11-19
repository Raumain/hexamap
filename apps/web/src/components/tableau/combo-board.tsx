import type { TableauAlignment, TableauSlot } from '@hexamap/shared';
import { TABLEAU_LINK_LABELS, TABLEAU_SLOT_LABELS, TABLEAU_SLOTS } from '@hexamap/shared';
import { removeCardAria } from '../../content/tableau';
import { CATEGORY_META, type CategoryMeta } from '../../lib/category-theme';
import type { CollectionCard } from '../../lib/collection';
import { Card } from '../ui/Card';
import { AlignmentConnector, AlignmentLinkList } from './alignment-connector';

export type TableauSelection = Partial<Record<TableauSlot, CollectionCard>>;

const SLOT_META: Record<TableauSlot, CategoryMeta> = {
  REGION: CATEGORY_META.REGION,
  DEPARTEMENT: CATEGORY_META.DEPARTEMENT,
  COMMUNE: CATEGORY_META.COMMUNE,
  RUE: CATEGORY_META.RUE,
};

type TableauLinkKey = TableauAlignment['breakdown'][number]['key'];

/** Lien affiché à droite de chaque emplacement, dans l'ordre hiérarchique du GDD. */
const LINK_FOR_SLOT: Partial<Record<TableauSlot, TableauLinkKey>> = {
  REGION: 'region-departement',
  DEPARTEMENT: 'departement-commune',
  COMMUNE: 'commune-rue',
};

interface ComboBoardProps {
  selection: TableauSelection;
  alignment: TableauAlignment | null;
  onOpen: (slot: TableauSlot) => void;
  onRemove: (slot: TableauSlot) => void;
}

export function ComboBoard({ selection, alignment, onOpen, onRemove }: ComboBoardProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 items-stretch gap-3 md:gap-4 lg:grid-cols-4">
        {TABLEAU_SLOTS.map((slot) => {
          const key = LINK_FOR_SLOT[slot];
          const link =
            key === undefined ? undefined : alignment?.breakdown.find((entry) => entry.key === key);

          return (
            <div key={slot} className="relative flex">
              <Slot
                slot={slot}
                card={selection[slot]}
                onOpen={() => onOpen(slot)}
                onRemove={() => onRemove(slot)}
              />
              {key === undefined ? null : (
                <div className="pointer-events-none absolute top-1/2 -right-4 hidden w-4 -translate-y-1/2 lg:block">
                  <AlignmentConnector
                    valid={link?.valid ?? false}
                    label={link?.label ?? TABLEAU_LINK_LABELS[key]}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AlignmentLinkList breakdown={alignment?.breakdown ?? []} className="lg:hidden" />
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
  const meta = SLOT_META[slot];

  return (
    <div className="flex w-full flex-col gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        className="block w-full rounded-[2px] text-left focus-visible:outline-none"
      >
        {card ? (
          <Card
            type={card.category}
            rarity={card.rarity}
            name={card.nom}
            score={card.score}
            refCode={card.refCode}
            blasonUrl={card.blasonUrl}
            blasonCredit={card.blasonCredit}
            locked={card.locked}
            className="w-full"
          />
        ) : (
          <span className="flex aspect-[5/7] w-full flex-col items-center justify-center gap-3 rounded-[2px] border border-dashed border-veil-strong/70 bg-cabinet-sunk/40 px-2 text-center">
            <svg
              aria-hidden="true"
              focusable="false"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.2}
              strokeLinecap="square"
              className="h-6 w-6 text-brass/70"
            >
              <path d={meta.glyph} />
            </svg>
            <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/55">
              Emplacement libre
            </span>
          </span>
        )}
      </button>

      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/55">
          {TABLEAU_SLOT_LABELS[slot]}
        </span>
        {card ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeCardAria(card.nom)}
            className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55 transition-colors duration-150 hover:text-oxide"
          >
            Retirer
          </button>
        ) : null}
      </div>
    </div>
  );
}
