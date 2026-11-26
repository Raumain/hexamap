import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { TROC } from '../../content/trade';
import { friendTradeCardsQueryKey } from '../../lib/trade';
import { outlineButtonClass } from '../ui/button-classes';
import { ProposeTradeDialog } from './propose-trade';

interface FriendTradePanelProps {
  friendId: string;
  pseudo: string;
}

/**
 * Le troc depuis La salle des Amis : une amitié acceptée ouvre la collection
 * troquable de l'autre. Le bouton ouvre la modale de proposition, qui fait
 * défiler les cartes de l'ami puis les siennes — c'est elle qui charge, la ligne
 * de l'ami ne porte plus de grille.
 */
export function FriendTradePanel({ friendId, pseudo }: FriendTradePanelProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setNotice(null);
          setOpen(true);
        }}
        className={outlineButtonClass}
      >
        {TROC.friend.open}
      </button>

      {notice ? (
        <p aria-live="polite" className="min-w-0 font-display text-[12px] leading-snug text-brass">
          {notice}
        </p>
      ) : null}

      {open ? (
        <ProposeTradeDialog
          open
          onOpenChange={setOpen}
          friend={{ id: friendId, pseudo }}
          onProposed={() => {
            setNotice(TROC.sent);
            void queryClient.invalidateQueries({ queryKey: friendTradeCardsQueryKey(friendId) });
          }}
        />
      ) : null}
    </div>
  );
}
