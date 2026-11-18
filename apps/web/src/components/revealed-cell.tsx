import { CATEGORY_LABELS, PANEL_CONTENT, type PanelKind } from '../content/tickets';
import type { TicketCell } from '../lib/tickets';
import { RarityBadge } from './ui/rarity-badge';

const scoreFormatter = new Intl.NumberFormat('fr-FR');

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
        'relative flex aspect-square flex-col justify-between gap-2 overflow-hidden rounded-md border p-2.5',
        isTreasure ? 'border-sign-gold bg-amber-100 shadow-tactile-sm' : 'border-border bg-surface',
      ].join(' ')}
    >
      {isCardKind(kind) && card ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-1">
            <span className="truncate font-mono text-[10px] font-medium uppercase tracking-wide text-ink-secondary">
              {CATEGORY_LABELS[card.category]}
            </span>
            {kind === 'TWIN' ? (
              <span className="shrink-0 rounded-sm border border-border bg-muted px-1 py-0.5 font-mono text-[9px] font-semibold text-ink-secondary">
                Jumelé
              </span>
            ) : null}
          </div>
          <p className="line-clamp-2 text-xs font-semibold leading-tight text-ink" title={card.nom}>
            {card.nom || nom}
          </p>
          <RarityBadge rarity={card.rarity} className="mt-auto" />
          <span className="font-mono text-[11px] font-semibold tabular-nums text-sign-ochre">
            {scoreFormatter.format(card.score)} pts
          </span>
        </div>
      ) : isPanelKind(kind) ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <PanelIcon kind={kind} />
          <p className="text-xs font-semibold text-ink">{PANEL_CONTENT[kind].label}</p>
          <p className="text-[10px] leading-tight text-ink-secondary">
            {PANEL_CONTENT[kind].description}
          </p>
          {card ? (
            <p
              className="mt-auto line-clamp-2 text-[11px] font-medium text-sign-ochre"
              title={card.nom}
            >
              {card.nom}
            </p>
          ) : null}
        </div>
      ) : null}

      {distance !== null ? <DistanceRadar distance={distance} /> : null}
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
      className="h-5 w-5 shrink-0 text-sign-ochre"
    >
      <path d={PANEL_CONTENT[kind].icon} />
    </svg>
  );
}

function DistanceRadar({ distance }: { distance: number }) {
  const isTreasure = distance === 0;
  const label = isTreasure ? 'Pépite' : `${distance} case${distance > 1 ? 's' : ''}`;

  return (
    <div className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center"
      >
        <span className="absolute inset-0 rounded-full border border-ink-muted" />
        <span className="absolute inset-[3px] rounded-full border border-ink-muted" />
        <span
          className={[
            'absolute inset-[6px] rounded-full',
            isTreasure ? 'bg-sign-gold' : 'bg-ink-secondary',
          ].join(' ')}
        />
      </span>
      <span
        className={[
          'font-mono text-[10px] font-medium leading-none tabular-nums',
          isTreasure ? 'text-sign-ochre' : 'text-ink-secondary',
        ].join(' ')}
      >
        {label}
      </span>
    </div>
  );
}
