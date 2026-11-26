import type { Category, Rarity } from '@hexamap/shared';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useRef } from 'react';
import { Card } from '../ui/Card';
import { RarityBadge } from '../ui/rarity-badge';

/**
 * La forme minimale que les deux listes du troc savent rendre : la collection
 * troquable d'un ami (`FriendTradeCards[number]`) comme la sienne
 * (`CollectionCard`) s'y ramènent sans conversion.
 */
export interface ChoiceCard {
  id: string;
  nom: string;
  score: number;
  category: Category;
  rarity: Rarity;
  refCode?: string | null;
  blasonUrl?: string | null;
  blasonCredit?: string | null;
}

interface CardChoiceListProps {
  cards: readonly ChoiceCard[];
  value: string | null;
  onChange: (card: ChoiceCard) => void;
  empty: string;
  className?: string;
}

const ROW_ESTIMATE = 86;

/**
 * La liste de planches du troc : on fait défiler, on clique, on choisit. Aucun
 * sélecteur natif — la collection peut porter cinq mille cartes, donc les lignes
 * sont virtualisées. Le composant ne possède aucune hauteur de lui-même : c'est
 * `className` qui borne le conteneur défilant, et une ligne tient sa hauteur de
 * son contenu (BUG-008).
 */
export function CardChoiceList({ cards, value, onChange, empty, className }: CardChoiceListProps) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: cards.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 8,
    getItemKey: (index) => cards[index]?.id ?? index,
  });

  return (
    <div ref={parentRef} className={`overflow-y-auto ${className ?? ''}`}>
      {cards.length === 0 ? (
        <p className="p-3 text-sm leading-relaxed text-vellum/70">{empty}</p>
      ) : (
        <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
          {virtualizer.getVirtualItems().map((row) => {
            const card = cards[row.index];
            if (!card) return null;
            const selected = card.id === value;

            return (
              <div
                key={row.key}
                className="absolute top-0 left-0 w-full px-1 py-1"
                style={{ transform: `translateY(${row.start}px)` }}
              >
                <button
                  type="button"
                  aria-pressed={selected}
                  onClick={() => onChange(card)}
                  className={`flex w-full items-center gap-3 rounded-[2px] border p-2 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass ${
                    selected
                      ? 'border-brass bg-brass/10'
                      : 'border-veil bg-cabinet-sunk/40 hover:border-brass/40'
                  }`}
                >
                  <Card
                    type={card.category}
                    rarity={card.rarity}
                    name={card.nom}
                    score={card.score}
                    refCode={card.refCode ?? null}
                    blasonUrl={card.blasonUrl ?? null}
                    blasonCredit={card.blasonCredit ?? null}
                    variant="compact"
                    decorative
                    className="w-14 shrink-0"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[13px] leading-tight text-vellum">
                      {card.nom}
                    </span>
                    <span className="mt-1 flex items-center gap-2">
                      <RarityBadge rarity={card.rarity} />
                      <span className="font-mono text-[11px] tabular-nums text-brass">
                        {card.score.toLocaleString('fr-FR')}
                      </span>
                    </span>
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
