import type { Rarity } from '@hexamap/shared';
import { RARITY_THEME } from '../../lib/rarity-theme';

interface RaritySealProps {
  rarity: Rarity;
  /** Diamètre explicite ; omis, le sceau suit la largeur de la planche. */
  size?: number;
  className?: string;
}

/**
 * Le sceau de cire d'un palier (DESIGN_SYSTEM.md §7.4).
 * Unique composant de rareté de l'application : aucun badge concurrent.
 * Sans `size`, il se dimensionne sur la planche via les unités de conteneur.
 */
export function RaritySeal({ rarity, size, className = '' }: RaritySealProps) {
  const theme = RARITY_THEME[rarity];
  const ink = theme.sealInk === 'ink' ? 'var(--color-ink)' : 'var(--color-vellum)';

  const box =
    size === undefined
      ? { width: 'clamp(15px, 7.5cqi, 22px)', height: 'clamp(15px, 7.5cqi, 22px)' }
      : { width: size, height: size };

  return (
    <span
      role="img"
      aria-label={`Rareté : ${theme.label}`}
      className={`relative inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        ...box,
        backgroundColor: theme.metal,
        color: ink,
        boxShadow:
          'inset 0 0 0 1px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.4), 0 1px 2px rgba(0,0,0,0.55)',
      }}
    >
      <span
        aria-hidden="true"
        className="font-display leading-none"
        style={{
          fontSize: size === undefined ? 'clamp(8px, 3.8cqi, 11px)' : Math.round(size * 0.5),
          fontWeight: 600,
        }}
      >
        {theme.initial}
      </span>
    </span>
  );
}
