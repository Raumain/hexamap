import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId, useState } from 'react';
import { TROC } from '../../content/trade';
import { cardDetailQueryKey } from '../../lib/card-detail';
import { collectionQueryKey, collectionQueryOptions } from '../../lib/collection';
import {
  friendTradeCardsQueryOptions,
  proposeTrade,
  tradeErrorMessage,
  tradeOffersQueryKey,
} from '../../lib/trade';
import { FormError } from '../form-error';
import { outlineButtonClass, primaryButtonClass } from '../ui/button-classes';
import { OverlayPortal } from '../ui/overlay-portal';
import { CardChoiceList } from './card-choice-list';

interface ChosenCard {
  id: string;
  nom: string;
}

interface ProposeTradeProps {
  requestedCardId: string;
  requestedCardName: string;
}

/**
 * Le point d'entrée du Cartel : la carte demandée est celle de la page, donc le
 * dialogue s'ouvre directement sur le choix de la carte offerte.
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
          open={open}
          onOpenChange={setOpen}
          requested={{ id: requestedCardId, nom: requestedCardName }}
          onProposed={() => setNotice(TROC.sent)}
        />
      ) : null}
    </div>
  );
}

export interface ProposeTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  requested?: ChosenCard | null;
  friend?: { id: string; pseudo: string } | null;
  onProposed?: () => void;
}

type Step = 'requested' | 'offered';

/**
 * Une seule modale, deux temps, et les deux se choisissent en cliquant une
 * planche : d'abord la carte de l'ami à demander (quand la proposition part de
 * La salle des Amis), puis la sienne. Aucun sélecteur natif.
 */
export function ProposeTradeDialog({
  open,
  onOpenChange,
  requested = null,
  friend = null,
  onProposed,
}: ProposeTradeDialogProps) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const friendId = friend?.id ?? null;
  const requestedId = requested?.id ?? null;
  const requestedNom = requested?.nom ?? null;

  const [step, setStep] = useState<Step>(requestedId ? 'offered' : 'requested');
  const [chosenRequested, setChosenRequested] = useState<ChosenCard | null>(
    requestedId && requestedNom ? { id: requestedId, nom: requestedNom } : null,
  );
  const [offeredCardId, setOfferedCardId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setStep(requestedId ? 'offered' : 'requested');
    setChosenRequested(requestedId && requestedNom ? { id: requestedId, nom: requestedNom } : null);
    setOfferedCardId(null);
    setError(null);
  }, [open, requestedId, requestedNom]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onOpenChange(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  const friendCards = useQuery({
    ...friendTradeCardsQueryOptions(friendId ?? ''),
    enabled: open && step === 'requested' && friendId !== null,
  });

  const collection = useQuery({
    ...collectionQueryOptions,
    enabled: open && step === 'offered',
  });

  const mutation = useMutation({
    mutationFn: proposeTrade,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: collectionQueryKey });
      void queryClient.invalidateQueries({ queryKey: tradeOffersQueryKey('sent') });
      void queryClient.invalidateQueries({ queryKey: tradeOffersQueryKey('received') });
      if (chosenRequested) {
        void queryClient.invalidateQueries({ queryKey: cardDetailQueryKey(chosenRequested.id) });
      }
      onOpenChange(false);
      onProposed?.();
    },
    onError: (failure) => setError(tradeErrorMessage(failure)),
  });

  if (!open) return null;

  const freeCards = (collection.data?.items ?? []).filter((card) => !card.locked);
  const offeredCard = freeCards.find((card) => card.id === offeredCardId) ?? null;
  const canSubmit = chosenRequested !== null && offeredCard !== null && !mutation.isPending;

  const listClass = 'h-[min(22rem,45vh)] rounded-[2px] border border-veil bg-cabinet-sunk/30 p-1';

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50" role="presentation">
        <div
          className="absolute inset-0 bg-cabinet/80"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85vh] flex-col overflow-hidden rounded-t-panel border-t border-brass/30 bg-cabinet-raised p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lifted md:inset-x-auto md:bottom-auto md:top-1/2 md:left-1/2 md:w-[min(44rem,94vw)] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-sheet md:border"
        >
          <div className="flex shrink-0 items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-xl text-vellum">
              {TROC.dialogTitle}
            </h2>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className={outlineButtonClass}
            >
              {TROC.close}
            </button>
          </div>

          <form
            className="mt-3 flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              if (!chosenRequested || !offeredCard) return;
              setError(null);
              mutation.mutate({
                offeredCardId: offeredCard.id,
                requestedCardId: chosenRequested.id,
              });
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
              {step === 'requested' && friend ? (
                <>
                  <p className="text-sm leading-relaxed text-vellum/70">
                    {TROC.friend.requestStepTitle(friend.pseudo)}
                  </p>
                  {friendCards.isPending ? (
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/60">
                      {TROC.loading}
                    </p>
                  ) : friendCards.isError ? (
                    <div className="space-y-2">
                      <FormError message={tradeErrorMessage(friendCards.error)} />
                      <button
                        type="button"
                        onClick={() => void friendCards.refetch()}
                        className={outlineButtonClass}
                      >
                        {TROC.retry}
                      </button>
                    </div>
                  ) : (
                    <CardChoiceList
                      key={`friend-${friendId ?? ''}`}
                      cards={friendCards.data ?? []}
                      value={null}
                      onChange={(card) => {
                        setChosenRequested({ id: card.id, nom: card.nom });
                        setOfferedCardId(null);
                        setError(null);
                        setStep('offered');
                      }}
                      empty={TROC.friend.empty}
                      className={listClass}
                    />
                  )}
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-vellum/45">
                    {TROC.friend.limit}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm leading-relaxed text-vellum/70">
                    {TROC.friend.offerStepTitle}
                  </p>
                  {chosenRequested ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-[13px] text-brass">
                        {TROC.offerLine(chosenRequested.nom)}
                      </p>
                      {friend ? (
                        <button
                          type="button"
                          onClick={() => {
                            setOfferedCardId(null);
                            setError(null);
                            setStep('requested');
                          }}
                          className={outlineButtonClass}
                        >
                          {TROC.changeRequested}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {collection.isPending ? (
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/60">
                      {TROC.loading}
                    </p>
                  ) : collection.isError ? (
                    <div className="space-y-2">
                      <FormError message={tradeErrorMessage(collection.error)} />
                      <button
                        type="button"
                        onClick={() => void collection.refetch()}
                        className={outlineButtonClass}
                      >
                        {TROC.retry}
                      </button>
                    </div>
                  ) : (
                    <CardChoiceList
                      key="own"
                      cards={freeCards}
                      value={offeredCardId}
                      onChange={(card) => {
                        setOfferedCardId(card.id);
                        setError(null);
                      }}
                      empty={TROC.noFreeCard}
                      className={listClass}
                    />
                  )}
                </>
              )}
            </div>

            <div className="mt-3 shrink-0 border-t border-veil pt-3">
              <p
                aria-live="polite"
                className="min-h-[18px] font-display text-[13px] leading-snug text-vellum/80"
              >
                {chosenRequested && offeredCard
                  ? TROC.summary(chosenRequested.nom, offeredCard.nom)
                  : ''}
              </p>
              <FormError message={error} />
              <button type="submit" disabled={!canSubmit} className={`${primaryButtonClass} mt-2`}>
                {mutation.isPending ? TROC.submitting : TROC.submit}
              </button>
            </div>
          </form>
        </div>
      </div>
    </OverlayPortal>
  );
}
