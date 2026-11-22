import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { CATEGORY_LABELS } from '../../content/tickets';
import { TROC } from '../../content/trade';
import { cardDetailQueryKey } from '../../lib/card-detail';
import { collectionQueryKey, collectionQueryOptions } from '../../lib/collection';
import { proposeTrade, tradeErrorMessage, tradeOffersQueryKey } from '../../lib/trade';
import { FormError } from '../form-error';
import { outlineButtonClass, primaryButtonClass } from '../ui/button-classes';
import { OverlayPortal } from '../ui/overlay-portal';

interface ProposeTradeProps {
  requestedCardId: string;
  requestedCardName: string;
}

/**
 * Le seul point d'entrée d'une proposition : Le Cartel d'une carte que le joueur
 * peut voir. La carte offerte se choisit parmi les siennes, libres de tout engagement.
 */
export function ProposeTrade({ requestedCardId, requestedCardName }: ProposeTradeProps) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => {
          setNotice(null);
          setOpen(true);
        }}
        className={outlineButtonClass}
      >
        {TROC.propose}
      </button>
      <p className="max-w-prose text-sm leading-relaxed text-ink-soft">{TROC.proposeHint}</p>
      <p
        aria-live="polite"
        className="min-h-[18px] font-mono text-[10px] uppercase tracking-[0.14em] text-brass"
      >
        {notice ?? ''}
      </p>

      {open ? (
        <ProposeTradeDialog
          requestedCardId={requestedCardId}
          requestedCardName={requestedCardName}
          onClose={() => setOpen(false)}
          onProposed={() => {
            setOpen(false);
            setNotice(TROC.sent);
          }}
        />
      ) : null}
    </div>
  );
}

interface ProposeTradeDialogProps {
  requestedCardId: string;
  requestedCardName: string;
  onClose: () => void;
  onProposed: () => void;
}

function ProposeTradeDialog({
  requestedCardId,
  requestedCardName,
  onClose,
  onProposed,
}: ProposeTradeDialogProps) {
  const titleId = useId();
  const selectId = useId();
  const queryClient = useQueryClient();
  const collection = useQuery(collectionQueryOptions);
  const [offeredCardId, setOfferedCardId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const mutation = useMutation({
    mutationFn: proposeTrade,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionQueryKey });
      void queryClient.invalidateQueries({ queryKey: tradeOffersQueryKey('sent') });
      void queryClient.invalidateQueries({ queryKey: tradeOffersQueryKey('received') });
      void queryClient.invalidateQueries({ queryKey: cardDetailQueryKey(requestedCardId) });
      onProposed();
    },
    onError: (failure) => setError(tradeErrorMessage(failure)),
  });

  const freeCards = (collection.data?.items ?? []).filter((card) => !card.locked);

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50" role="presentation">
        <div className="absolute inset-0 bg-cabinet/80" onClick={onClose} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col overflow-y-auto rounded-t-panel border-t border-brass/30 bg-cabinet-raised p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lifted md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-[min(32rem,92vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-sheet md:border"
        >
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-xl text-vellum">
              {TROC.dialogTitle}
            </h2>
            <button type="button" onClick={onClose} className={outlineButtonClass}>
              {TROC.close}
            </button>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-vellum/70">
            {TROC.dialogIntro(requestedCardName)}
          </p>

          {freeCards.length === 0 ? (
            <p className="mt-4 text-sm leading-relaxed text-vellum/70">{TROC.noFreeCard}</p>
          ) : (
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (offeredCardId === '') return;
                setError(null);
                mutation.mutate({ offeredCardId, requestedCardId });
              }}
            >
              <div className="space-y-1">
                <label
                  htmlFor={selectId}
                  className="block font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55"
                >
                  {TROC.pickLabel}
                </label>
                <select
                  id={selectId}
                  value={offeredCardId}
                  onChange={(event) => setOfferedCardId(event.target.value)}
                  className="min-h-[44px] w-full rounded-[2px] border border-veil bg-cabinet-sunk px-3 text-[13.5px] text-vellum"
                >
                  <option value="">{TROC.pickPlaceholder}</option>
                  {freeCards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {`${CATEGORY_LABELS[card.category]} — ${card.nom}`}
                    </option>
                  ))}
                </select>
              </div>

              <FormError message={error} />

              <button
                type="submit"
                disabled={offeredCardId === '' || mutation.isPending}
                className={primaryButtonClass}
              >
                {mutation.isPending ? TROC.submitting : TROC.submit}
              </button>
            </form>
          )}
        </div>
      </div>
    </OverlayPortal>
  );
}
