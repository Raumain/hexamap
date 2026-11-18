import { RARITY, type Rarity } from '@hexamap/shared';
import { RARITY_THEME } from '../../../lib/rarity-theme';
import { cardShellProps } from './card-shell';

export interface RueCardProps {
  rarity: Rarity;
  name: string;
  score: number;
  refCode: string;
  occurrenceCount: number | null;
  detailed: boolean;
  locked: boolean;
  decorative: boolean;
  className?: string;
}

/** Carte « Rue » — plaque émaillée, rivets dessinés en `::before`/`::after`. */
export function RueCard({
  rarity,
  name,
  occurrenceCount,
  detailed,
  locked,
  decorative,
  className,
}: RueCardProps) {
  const theme = RARITY_THEME[rarity];
  const isHighRarity = RARITY.indexOf(rarity) >= RARITY.indexOf('RARE');
  const shell = cardShellProps({
    rarity,
    locked,
    decorative,
    className: `${className ?? ''} rue-plaque`.trim(),
    background: isHighRarity ? 'bg-sign-green' : 'bg-sign-blue',
    padding: 'p-2',
  });

  return (
    <article {...shell}>
      <div className="my-auto border border-ink-inverse/80 px-2 py-2 text-center">
        <h3 className="text-xs font-bold uppercase leading-snug tracking-wide text-ink-inverse line-clamp-2 md:text-sm">
          {name}
        </h3>
      </div>

      {detailed ? (
        <div className="flex items-center justify-between font-mono text-[10px] tabular-nums text-ink-inverse/90">
          <span>{occurrenceCount === null ? null : `${occurrenceCount} rép. FR`}</span>
          <span className="rounded-sm bg-ink-inverse px-1.5 py-0.5 font-bold text-sign-blue">
            {theme.label}
          </span>
        </div>
      ) : null}
    </article>
  );
}
