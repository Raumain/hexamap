import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useId, useState } from 'react';
import { TROC } from '../../content/trade';
import { collectionQueryKey } from '../../lib/collection';
import {
  acceptTrade,
  cancelTrade,
  declineTrade,
  type TradeBox,
  type TradeOffer,
  tradeErrorMessage,
  tradeOffersQueryKey,
  tradeOffersQueryOptions,
} from '../../lib/trade';
import { FormError } from '../form-error';
import { outlineButtonClass, primaryButtonClass } from '../ui/button-classes';

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' });

/**
 * Les offres du Troc dans Le Guichet. Le Guichet porte déjà les événements :
 * le troc n'ouvre pas de salle à lui seul, il ajoute ce panneau.
 */
export function TradeOffersPanel() {
  const queryClient = useQueryClient();
  const titleId = useId();
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null);

  const received = useQuery(tradeOffersQueryOptions('received'));
  const sent = useQuery(tradeOffersQueryOptions('sent'));

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: tradeOffersQueryKey('received') });
    void queryClient.invalidateQueries({ queryKey: tradeOffersQueryKey('sent') });
    void queryClient.invalidateQueries({ queryKey: collectionQueryKey });
  };

  const accept = useMutation({
    mutationFn: acceptTrade,
    onSuccess: () => setNotice({ tone: 'success', message: TROC.accepted }),
    onError: (error) => setNotice({ tone: 'error', message: tradeErrorMessage(error) }),
    onSettled: invalidate,
  });

  const decline = useMutation({
    mutationFn: declineTrade,
    onSuccess: () => setNotice({ tone: 'success', message: TROC.declined }),
    onError: (error) => setNotice({ tone: 'error', message: tradeErrorMessage(error) }),
    onSettled: invalidate,
  });

  const withdraw = useMutation({
    mutationFn: cancelTrade,
    onSuccess: () => setNotice({ tone: 'success', message: TROC.cancelled }),
    onError: (error) => setNotice({ tone: 'error', message: tradeErrorMessage(error) }),
    onSettled: invalidate,
  });

  const busy = accept.isPending || decline.isPending || withdraw.isPending;
  const receivedOffers = received.data ?? [];
  const sentOffers = sent.data ?? [];
  const failure = received.error ?? sent.error;

  return (
    <section
      aria-labelledby={titleId}
      className="rounded-sheet border border-veil bg-cabinet-raised p-5"
    >
      <h2 id={titleId} className="font-display text-lg text-vellum">
        {TROC.sectionTitle}
      </h2>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-vellum/60">{TROC.sectionBody}</p>

      <p
        aria-live="polite"
        className={`mt-3 min-h-[18px] font-mono text-[10px] uppercase tracking-[0.14em] ${
          notice?.tone === 'error' ? 'text-oxide' : 'text-brass'
        }`}
      >
        {notice?.message ?? ''}
      </p>

      {failure ? <FormError message={tradeErrorMessage(failure)} /> : null}

      <div className="mt-4 space-y-6">
        <OfferList
          box="received"
          title={TROC.receivedTitle}
          offers={receivedOffers}
          busy={busy}
          onAccept={(id) => accept.mutate(id)}
          onDecline={(id) => decline.mutate(id)}
        />
        <OfferList
          box="sent"
          title={TROC.sentTitle}
          offers={sentOffers}
          busy={busy}
          onWithdraw={(id) => withdraw.mutate(id)}
        />
      </div>
    </section>
  );
}

interface OfferListProps {
  box: TradeBox;
  title: string;
  offers: readonly TradeOffer[];
  busy: boolean;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onWithdraw?: (id: string) => void;
}

function OfferList({ box, title, offers, busy, onAccept, onDecline, onWithdraw }: OfferListProps) {
  return (
    <div>
      <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-vellum/55">
        {`${title} · ${offers.length}`}
      </h3>
      {offers.length === 0 ? (
        <p className="mt-2 text-sm leading-relaxed text-vellum/50">{TROC.empty}</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {offers.map((offer) => (
            <OfferRow
              key={offer.id}
              box={box}
              offer={offer}
              busy={busy}
              onAccept={onAccept}
              onDecline={onDecline}
              onWithdraw={onWithdraw}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

interface OfferRowProps {
  box: TradeBox;
  offer: TradeOffer;
  busy: boolean;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
  onWithdraw?: (id: string) => void;
}

function OfferRow({ box, offer, busy, onAccept, onDecline, onWithdraw }: OfferRowProps) {
  const pending = offer.status === 'PENDING';
  const counterpart = box === 'received' ? offer.proposer : offer.receiver;

  return (
    <li className="rounded-[2px] border border-veil bg-cabinet-sunk p-3">
      <p className="text-sm text-vellum">
        {`${TROC.offerLine(offer.offeredCard.nom)} ${TROC.against} ${TROC.offerLine(offer.requestedCard.nom)}`}
      </p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
        {`${(box === 'received' ? TROC.from : TROC.to)(counterpart.pseudo ?? 'un joueur')} · ${TROC.status[offer.status]}${
          pending ? ` · ${TROC.expires(DATE_FORMAT.format(new Date(offer.expiresAt)))}` : ''
        }`}
      </p>

      {pending ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {box === 'received' && onAccept && onDecline ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onAccept(offer.id)}
                className={primaryButtonClass}
              >
                {TROC.accept}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onDecline(offer.id)}
                className={outlineButtonClass}
              >
                {TROC.decline}
              </button>
            </>
          ) : null}
          {box === 'sent' && onWithdraw ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onWithdraw(offer.id)}
              className={outlineButtonClass}
            >
              {TROC.withdraw}
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
