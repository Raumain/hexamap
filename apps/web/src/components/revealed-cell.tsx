import {
  CATEGORY_LABELS,
  PANEL_CONTENT,
  type PanelKind,
  RARITY_LABELS,
  RARITY_STYLES,
} from '../content/tickets';
import type { TicketCell } from '../lib/tickets';

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
        'relative flex aspect-square flex-col justify-between gap-2 overflow-hidden rounded-2xl border p-2.5',
        isTreasure
          ? 'border-amber-400 bg-amber-400/10 shadow-[0_0_14px_rgba(251,191,36,0.3)]'
          : 'border-slate-700 bg-slate-800/80',
      ].join(' ')}
    >
      {isCardKind(kind) && card ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <div className="flex items-start justify-between gap-1">
            <span className="truncate text-[10px] font-medium uppercase tracking-wide text-slate-400">
              {CATEGORY_LABELS[card.category]}
            </span>
            {kind === 'TWIN' ? (
              <span className="shrink-0 rounded border border-sky-700 bg-sky-900/60 px-1 py-0.5 text-[9px] font-semibold text-sky-300">
                Jumelé
              </span>
            ) : null}
          </div>
          <p
            className="line-clamp-2 text-xs font-semibold leading-tight text-slate-100"
            title={card.nom}
          >
            {card.nom || nom}
          </p>
          <span
            className={[
              'mt-auto inline-flex w-fit items-center rounded-full border px-1.5 py-0.5 text-[9px] font-medium',
              RARITY_STYLES[card.rarity],
            ].join(' ')}
          >
            {RARITY_LABELS[card.rarity]}
          </span>
          <span className="text-[11px] font-semibold text-amber-300">
            {scoreFormatter.format(card.score)} pts
          </span>
        </div>
      ) : isPanelKind(kind) ? (
        <div className="flex min-h-0 flex-1 flex-col gap-1">
          <PanelIcon kind={kind} />
          <p className="text-xs font-semibold text-slate-100">{PANEL_CONTENT[kind].label}</p>
          <p className="text-[10px] leading-tight text-slate-400">
            {PANEL_CONTENT[kind].description}
          </p>
          {card ? (
            <p
              className="mt-auto line-clamp-2 text-[11px] font-medium text-amber-200"
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
      className="h-5 w-5 shrink-0 text-amber-400"
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
        <span className="absolute inset-0 rounded-full border border-slate-500" />
        <span className="absolute inset-[3px] rounded-full border border-slate-500" />
        <span
          className={[
            'absolute inset-[6px] rounded-full',
            isTreasure ? 'bg-amber-400' : 'bg-slate-400',
          ].join(' ')}
        />
      </span>
      <span
        className={[
          'text-[10px] font-medium leading-none',
          isTreasure ? 'text-amber-300' : 'text-slate-300',
        ].join(' ')}
      >
        {label}
      </span>
    </div>
  );
}
