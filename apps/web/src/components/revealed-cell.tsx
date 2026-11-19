import { PANEL_CONTENT, type PanelKind } from '../content/tickets';
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

export function RevealedCell({ cell }: RevealedCellProps) {
  const { kind, card, nom, distance } = cell;
  const isTreasure = kind === 'TREASURE';

  return (
    <div
      className={[
        'relative flex aspect-square flex-col justify-between gap-1 overflow-hidden rounded-[2px] border border-ink/15 bg-vellum-2/40 p-1.5',
        isTreasure ? 'border-brass shadow-brass' : '',
      ].join(' ')}
    >
      {isCardKind(kind) && card ? (
        <div className="relative min-h-0 flex-1">
          <Card
            type={card.category}
            rarity={card.rarity}
            name={card.nom || nom || 'Carte'}
            score={card.score}
            className="h-full w-full"
          />
          {kind === 'TWIN' ? (
            <span className="absolute right-0 top-0 rounded-[2px] border border-brass/50 bg-vellum px-1 py-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-brass-deep">
              Jumelé
            </span>
          ) : null}
        </div>
      ) : isPanelKind(kind) ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <PanelIcon kind={kind} />
          <p className="text-[11px] font-semibold leading-tight text-ink">
            {PANEL_CONTENT[kind].label}
          </p>
          <p className="line-clamp-3 text-[9px] leading-tight text-ink-soft">
            {PANEL_CONTENT[kind].description}
          </p>
        </div>
      ) : null}

      {typeof distance === 'number' ? (
        <p className="shrink-0 font-mono text-[10px] leading-none tabular-nums text-brass-deep">
          {distance === 0 ? 'Pépite' : `${distance} pas`}
        </p>
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
