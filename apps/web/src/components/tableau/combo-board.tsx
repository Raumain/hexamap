import type { TableauAlignment, TableauSlot } from '@hexamap/shared';
import { TABLEAU_LINK_LABELS, TABLEAU_SLOT_LABELS, TABLEAU_SLOTS } from '@hexamap/shared';
import { removeCardAria, TABLEAU } from '../../content/tableau';
import { CATEGORY_LABELS } from '../../content/tickets';
import type { CollectionCard } from '../../lib/collection';
import { Card } from '../ui/Card';
import { RarityBadge } from '../ui/rarity-badge';
import { AlignmentConnector, AlignmentLinkList } from './alignment-connector';

const scoreFormatter = new Intl.NumberFormat('fr-FR');

export type TableauSelection = Partial<Record<TableauSlot, CollectionCard>>;

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 items-stretch">
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
  const label = TABLEAU_SLOT_LABELS[slot];

  return (
    <div className="flex w-full flex-col rounded-sm border-2 border-border bg-surface shadow-tactile-sm">
      <div className="flex items-center justify-between gap-2 border-b-2 border-border px-4 py-2">
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          className="flex flex-1 items-center gap-2 rounded-sm text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <span className="font-mono text-sm font-semibold uppercase tracking-wide text-ink">
            {label}
          </span>
          <span className="text-xs text-ink-secondary">
            {card ? TABLEAU.slotModify : TABLEAU.slotChoose}
          </span>
        </button>
        {card ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={removeCardAria(card.nom)}
            className="rounded-sm p-1 text-ink-secondary transition-colors hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
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
              <p className="truncate font-medium text-ink">{card.nom}</p>
              <p className="text-xs text-ink-secondary">
                {CATEGORY_LABELS[card.category]} · {card.refCode}
              </p>
            </div>
            <div className="text-right">
              <RarityBadge rarity={card.rarity} />
              <p className="mt-1 font-mono text-sm font-semibold tabular-nums text-ink">
                {scoreFormatter.format(card.score)}
              </p>
            </div>
          </>
        ) : (
          <p className="py-4 text-sm text-ink-secondary">{TABLEAU.slotEmpty}</p>
        )}
      </button>
    </div>
  );
}
