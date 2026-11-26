import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { CATEGORY_LABELS } from '../../content/tickets';
import { TROC } from '../../content/trade';
import {
  type FriendTradeCards,
  friendTradeCardsQueryKey,
  friendTradeCardsQueryOptions,
  tradeErrorMessage,
} from '../../lib/trade';
import { FormError } from '../form-error';
import { outlineButtonClass } from '../ui/button-classes';
import { Card } from '../ui/Card';
import { OverlayPortal } from '../ui/overlay-portal';
import { RarityBadge } from '../ui/rarity-badge';
import { ProposeTradeDialog } from './propose-trade';

type FriendTradeCard = FriendTradeCards[number];

interface FriendTradePanelProps {
  friendId: string;
  pseudo: string;
}

/**
 * Le troc depuis La salle des Amis : une amitié acceptée ouvre la collection
 * troquable de l'autre, et c'est de là qu'une proposition part. La liste ne
 * contient que des cartes libres — ni en vente, ni engagées dans une offre.
 */
export function FriendTradePanel({ friendId, pseudo }: FriendTradePanelProps) {
  const queryClient = useQueryClient();
  const [listOpen, setListOpen] = useState(false);
  const [chosen, setChosen] = useState<{ id: string; nom: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className={outlineButtonClass}
        onClick={() => {
          setNotice(null);
          setListOpen(true);
        }}
      >
        {TROC.friend.open}
      </button>

      {notice ? (
        <span
          aria-live="polite"
          className="basis-full font-display text-[12px] leading-snug text-brass"
        >
          {notice}
        </span>
      ) : null}

      {listOpen ? (
        <FriendCardsDialog
          friendId={friendId}
          pseudo={pseudo}
          onClose={() => setListOpen(false)}
          onPick={(card) => {
            setListOpen(false);
            setChosen({ id: card.id, nom: card.nom });
          }}
        />
      ) : null}

      {chosen ? (
        <ProposeTradeDialog
          open
          onOpenChange={(next) => {
            if (!next) setChosen(null);
          }}
          requestedCardId={chosen.id}
          requestedCardName={chosen.nom}
          onProposed={() => {
            setChosen(null);
            setNotice(TROC.sent);
            void queryClient.invalidateQueries({
              queryKey: friendTradeCardsQueryKey(friendId),
            });
          }}
        />
      ) : null}
    </>
  );
}

interface FriendCardsDialogProps {
  friendId: string;
  pseudo: string;
  onClose: () => void;
  onPick: (card: FriendTradeCard) => void;
}

function FriendCardsDialog({ friendId, pseudo, onClose, onPick }: FriendCardsDialogProps) {
  const titleId = useId();
  const query = useQuery(friendTradeCardsQueryOptions(friendId));
  const cards = query.data ?? [];

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50" role="presentation">
        <div className="absolute inset-0 bg-cabinet/80" onClick={onClose} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-y-auto rounded-t-panel border-t border-brass/30 bg-cabinet-raised p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lifted md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-[min(34rem,92vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-sheet md:border"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-xl text-vellum">
              {TROC.friend.pickTitle(pseudo)}
            </h2>
            <button type="button" onClick={onClose} className={outlineButtonClass}>
              {TROC.close}
            </button>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-vellum/70">
            {TROC.friend.pickHint(pseudo)}
          </p>

          {query.isPending ? (
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/60">
              {TROC.friend.loading}
            </p>
          ) : query.isError ? (
            <div className="mt-4 space-y-3">
              <FormError message={tradeErrorMessage(query.error)} />
              <button
                type="button"
                onClick={() => void query.refetch()}
                className={outlineButtonClass}
              >
                {TROC.friend.retry}
              </button>
            </div>
          ) : cards.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-vellum/70">{TROC.friend.empty}</p>
          ) : (
            <>
              <ul className="mt-4 max-h-[min(24rem,50vh)] space-y-2 overflow-y-auto">
                {cards.map((card) => (
                  <li key={card.id}>
                    <button
                      type="button"
                      aria-label={TROC.friend.pickLabel(card.nom)}
                      onClick={() => onPick(card)}
                      className="flex w-full items-center gap-3 rounded-[2px] border border-veil bg-cabinet-sunk/40 px-2 py-2 text-left transition-colors duration-150 hover:border-brass/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
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
                        {card.score.toLocaleString('fr-FR')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-vellum/45">
                {TROC.friend.limit}
              </p>
            </>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
