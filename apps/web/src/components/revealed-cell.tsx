import {
  distanceAriaLabel,
  distanceLabel,
  PANEL_CONTENT,
  type PanelKind,
} from '../content/tickets';
import type { TicketCell } from '../lib/tickets';
import { Card } from './ui/Card';

type CardKind = 'CARD' | 'TREASURE' | 'TWIN';

interface RevealedCellProps {
  cell: TicketCell;
}

function isCardKind(kind: TicketCell['kind']): kind is CardKind {
  return kind === 'CARD' || kind === 'TREASURE' || kind === 'TWIN';
}

function isPanelKind(kind: TicketCell['kind']): kind is PanelKind {
  return kind === 'STATION' || kind === 'BELVEDERE' || kind === 'RENOVATION';
}

const BADGE_CLASSES =
  'rounded-[2px] bg-cabinet px-1 font-mono text-[10px] leading-none tabular-nums text-brass';

const TWIN_CLASSES = 'font-mono text-[10px] uppercase tracking-[0.1em] text-brass-deep';

/** Bandeau de 16 px : la marque des jumelés à gauche, la distance à droite, hors de la gravure. */
function CellStrip({ kind, distance }: { kind: TicketCell['kind']; distance?: number | null }) {
  return (
    <div className="flex h-4 shrink-0 items-center justify-between gap-1">
      <span className={TWIN_CLASSES}>{kind === 'TWIN' ? 'Jumelé' : ''}</span>
      {typeof distance === 'number' ? (
        <span className={BADGE_CLASSES}>
          <span aria-hidden="true">{distanceLabel(distance)}</span>
          <span className="sr-only">{distanceAriaLabel(distance)}</span>
        </span>
      ) : null}
    </div>
  );
}

export function RevealedCell({ cell }: RevealedCellProps) {
  const { kind, card, nom, distance } = cell;
  const isTreasure = kind === 'TREASURE';
  const name = card?.nom || nom || 'Carte';

  return (
    <div
      className={[
        'relative flex aspect-[3/5] flex-col gap-1 overflow-hidden rounded-[2px] border border-ink/15 bg-vellum-2/40 p-1',
        isTreasure ? 'border-brass shadow-brass' : '',
      ].join(' ')}
    >
      {isCardKind(kind) && card ? (
        <>
          <CellStrip kind={kind} distance={distance} />
          <div className="relative flex min-h-0 flex-1 items-center justify-center">
            <Card
              type={card.category}
              rarity={card.rarity}
              name={name}
              score={card.score}
              refCode={card.refCode}
              blasonUrl={card.blasonUrl}
              blasonCredit={card.blasonCredit}
              className="h-auto w-full"
            />
          </div>
        </>
      ) : isPanelKind(kind) ? (
        <>
          <CellStrip kind={kind} distance={distance} />
          <div className="relative flex min-h-0 flex-1 flex-col gap-1">
            <PanelIcon kind={kind} />
            <p className="text-[11px] font-semibold leading-tight text-ink">
              {PANEL_CONTENT[kind].label}
            </p>
            <p className="line-clamp-3 text-[10px] leading-tight text-ink-soft">
              {PANEL_CONTENT[kind].description}
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

function PanelIcon({ kind }: { kind: PanelKind }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="h-5 w-5 shrink-0 text-brass-deep"
    >
      <path d={PANEL_CONTENT[kind].icon} />
    </svg>
  );
}
