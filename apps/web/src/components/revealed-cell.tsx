import { editionLabel } from '../content/rarete';
import {
  distanceAriaLabel,
  distanceLabel,
  PANEL_CONTENT,
  type PanelKind,
  revealedCellLabel,
} from '../content/tickets';
import type { TicketCell } from '../lib/tickets';
import { Card } from './ui/Card';

type CardKind = 'CARD' | 'TREASURE' | 'TWIN';

interface RevealedCellProps {
  cell: TicketCell;
  onOpen: (cell: TicketCell) => void;
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

/**
 * Bandeau de 16 px : la marque de la case à gauche, la distance à droite, hors
 * de la gravure. Une région et un département nomment leur édition : le sceau de
 * la planche dit déjà le palier, le bandeau dit d'où il vient.
 */
function CellStrip({
  kind,
  card,
  distance,
}: {
  kind: TicketCell['kind'];
  card?: TicketCell['card'] | null;
  distance?: number | null;
}) {
  const edition =
    card && (card.category === 'REGION' || card.category === 'DEPARTEMENT')
      ? editionLabel(card.rarity)
      : null;
  // Le bandeau fait 16 px de haut et 56 px de large sur une case de 66 px : le
  // badge de distance en occupe 30, il reste 26 px, soit trois caractères pleins.
  // « Jumelé » y est déjà tronqué aujourd'hui ; le bandeau porte donc
  // l'abréviation « Éd. », le palier reste au sceau de la planche et la phrase
  // complète (« Édition mythique ») au survol.
  const mark = kind === 'TWIN' ? 'Jumelé' : edition ? 'Éd.' : null;

  return (
    <div className="flex h-4 shrink-0 items-center justify-between gap-1">
      <span className={`${TWIN_CLASSES} min-w-0 truncate`} title={edition ?? mark ?? undefined}>
        {mark ?? ''}
      </span>
      {typeof distance === 'number' ? (
        <span className={BADGE_CLASSES}>
          <span aria-hidden="true">{distanceLabel(distance)}</span>
          <span className="sr-only">{distanceAriaLabel(distance)}</span>
        </span>
      ) : null}
    </div>
  );
}

export function RevealedCell({ cell, onOpen }: RevealedCellProps) {
  const { kind, card, nom, distance } = cell;
  const isTreasure = kind === 'TREASURE';
  const name = card?.nom || nom || 'Carte';
  // Une case révélée sans contenu rendu n'a rien à agrandir : sans cette garde,
  // elle ouvrirait un dialogue au titre générique et au corps vide.
  const canOpen = (isCardKind(kind) && card !== null) || isPanelKind(kind);

  return (
    <div
      className={[
        'relative flex aspect-[3/5] flex-col gap-1 overflow-hidden rounded-[2px] border border-ink/15 bg-vellum-2/40 p-1',
        isTreasure ? 'border-brass shadow-brass' : '',
      ].join(' ')}
    >
      {isCardKind(kind) && card ? (
        <>
          <CellStrip kind={kind} card={card} distance={distance} />
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
      {canOpen ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => onOpen(cell)}
          className="absolute inset-0 z-10 rounded-[2px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass"
        >
          <span className="sr-only">{revealedCellLabel(cell.index, name)}</span>
        </button>
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
