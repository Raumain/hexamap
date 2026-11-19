import type { Rarity } from '@hexamap/shared';
import { RARITY_THEME } from '../../lib/rarity-theme';

interface RarityBadgeProps {
  rarity: Rarity;
  className?: string;
}

/**
 * Pastille de rareté (listes, filtres).
 * Le métal est posé en aplat, le texte est éclairci par `color-mix` pour rester
 * lisible sur la pièce (contraste ≥ 4,5:1), sans réintroduire de hexadécimal.
 */
export function RarityBadge({ rarity, className = '' }: RarityBadgeProps) {
  const theme = RARITY_THEME[rarity];

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-[2px] border px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] ${className}`}
      style={{
        borderColor: theme.metal,
        backgroundColor: `color-mix(in srgb, ${theme.metal} 22%, var(--color-cabinet))`,
        color: `color-mix(in srgb, ${theme.metal} 42%, var(--color-vellum))`,
      }}
    >
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: theme.metal }}
      />
      {theme.label}
    </span>
  );
}
