import { useEffect, useId, useRef } from 'react';
import { PANEL_CONTENT, type PanelKind, TICKET } from '../content/tickets';
import type { TicketCell } from '../lib/tickets';
import { Card } from './ui/Card';
import { OverlayPortal } from './ui/overlay-portal';

type CardKind = 'CARD' | 'TREASURE' | 'TWIN';

interface RevealedCellModalProps {
  cell: TicketCell;
  onClose: () => void;
}

function isCardKind(kind: TicketCell['kind']): kind is CardKind {
  return kind === 'CARD' || kind === 'TREASURE' || kind === 'TWIN';
}

function isPanelKind(kind: TicketCell['kind']): kind is PanelKind {
  return kind === 'STATION' || kind === 'BELVEDERE' || kind === 'RENOVATION';
}

/**
 * Le détail d'une case déjà révélée. Purement local : tout ce qu'il affiche
 * était déjà dans la réponse du ticket, aucune requête n'est émise.
 */
export function RevealedCellModal({ cell, onClose }: RevealedCellModalProps) {
  const titleId = useId();
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { kind, card } = cell;

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previous?.focus();
    };
  }, [onClose]);

  const name = isPanelKind(kind)
    ? PANEL_CONTENT[kind].label
    : isCardKind(kind) && card
      ? card.nom || cell.nom || TICKET.cellDialogCardFallback
      : cell.nom || TICKET.cellDialogCardFallback;

  return (
    <OverlayPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-cabinet/85 p-6"
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <div className="w-full max-w-sm">
          <p className="font-mono text-[10px] uppercase tracking-[0.28em] text-brass">
            {TICKET.cellDialogEyebrow}
          </p>
          <h2 id={titleId} className="mt-3 font-display text-xl text-vellum">
            {name}
          </h2>

          {isPanelKind(kind) ? (
            <>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                className="mt-5 h-6 w-6 text-brass-deep"
              >
                <path d={PANEL_CONTENT[kind].icon} />
              </svg>
              <p className="mt-4 text-sm leading-relaxed text-vellum/80">
                {PANEL_CONTENT[kind].detail}
              </p>
            </>
          ) : isCardKind(kind) && card ? (
            <>
              <Card
                variant="detailed"
                type={card.category}
                rarity={card.rarity}
                name={name}
                score={card.score}
                refCode={card.refCode}
                blasonUrl={card.blasonUrl}
                blasonCredit={card.blasonCredit}
                className="mx-auto mt-5 w-full max-w-[268px]"
              />
              {card.blasonCredit ? (
                <p className="mt-3 font-mono text-[10px] leading-relaxed text-vellum/60">
                  {card.blasonCredit}
                </p>
              ) : null}
            </>
          ) : null}

          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-sm border border-brass/40 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-vellum/80 transition-colors duration-150 hover:border-brass hover:text-vellum"
          >
            {TICKET.cellDialogClose}
          </button>
        </div>
      </div>
    </OverlayPortal>
  );
}
