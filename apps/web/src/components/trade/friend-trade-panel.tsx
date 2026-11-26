import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { TROC } from '../../content/trade';
import {
  friendTradeCardsQueryKey,
  friendTradeCardsQueryOptions,
  tradeErrorMessage,
} from '../../lib/trade';
import { FormError } from '../form-error';
import { outlineButtonClass } from '../ui/button-classes';
import { Card } from '../ui/Card';
import { RarityBadge } from '../ui/rarity-badge';
import { ProposeTradeDialog } from './propose-trade';

interface FriendTradePanelProps {
  friendId: string;
  pseudo: string;
}

/**
 * Le troc depuis La salle des Amis : une amitié acceptée ouvre la collection
 * troquable de l'autre, et c'est de là qu'une proposition part. Les cartes sont
 * posées à même la ligne de l'ami — aucun sélecteur intermédiaire — et la liste
 * ne contient que des cartes libres, ni en vente ni engagées dans une offre.
 */
export function FriendTradePanel({ friendId, pseudo }: FriendTradePanelProps) {
  const queryClient = useQueryClient();
  const query = useQuery(friendTradeCardsQueryOptions(friendId));
  const [chosen, setChosen] = useState<{ id: string; nom: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const cards = query.data ?? [];

  return (
    <div className="w-full min-w-0 space-y-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-vellum/55">
        {TROC.friend.cardsTitle(pseudo)}
      </p>

      {notice ? (
        <p aria-live="polite" className="font-display text-[12px] leading-snug text-brass">
          {notice}
        </p>
      ) : null}

      {query.isPending ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/60">
          {TROC.friend.loading}
        </p>
      ) : query.isError ? (
        <div className="space-y-2">
          <FormError message={tradeErrorMessage(query.error)} />
          <button type="button" onClick={() => void query.refetch()} className={outlineButtonClass}>
            {TROC.friend.retry}
          </button>
        </div>
      ) : cards.length === 0 ? (
        <p className="text-sm leading-relaxed text-vellum/70">{TROC.friend.empty}</p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {cards.map((card) => (
              <li key={card.id} className="min-w-0">
                <button
                  type="button"
                  aria-label={TROC.friend.pickLabel(card.nom)}
                  onClick={() => {
                    setNotice(null);
                    setChosen({ id: card.id, nom: card.nom });
                  }}
                  className="flex w-full flex-col gap-1.5 rounded-[2px] border border-veil bg-cabinet-sunk/40 p-2 text-left transition-colors duration-150 hover:border-brass/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass"
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
                    className="w-full"
                  />
                  <span className="block w-full truncate font-display text-[13px] leading-tight text-vellum">
                    {card.nom}
                  </span>
                  <RarityBadge rarity={card.rarity} />
                  <span className="font-mono text-[11px] tabular-nums text-brass">
                    {card.score.toLocaleString('fr-FR')}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-vellum/45">
            {TROC.friend.limit}
          </p>
        </>
      )}

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
    </div>
  );
}
