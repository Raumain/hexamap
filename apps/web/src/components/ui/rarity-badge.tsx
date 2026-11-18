import type { Rarity } from '@hexamap/shared';
import { RARITY_THEME } from '../../lib/rarity-theme';

export function RarityBadge({ rarity, className = '' }: { rarity: Rarity; className?: string }) {
  const theme = RARITY_THEME[rarity];
  return (
    <span
      className={`inline-flex w-fit rounded-sm border-2 border-border/20 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${theme.badgeBgClass} ${theme.badgeTextClass} ${className}`}
    >
      {theme.label}
    </span>
  );
}
