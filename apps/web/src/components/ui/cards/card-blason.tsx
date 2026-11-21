import { type ReactNode, useState } from 'react';

/** Géométrie unique du blason d'en-tête, partagée par les trois planches qui en portent un. */
export const CARD_BLASON_CLASSES =
  'h-[clamp(18px,18cqi,44px)] w-[clamp(18px,18cqi,44px)] object-contain opacity-90 mix-blend-multiply';

export interface CardBlasonProps {
  url: string | null;
  credit?: string | null;
  className?: string;
  fallback?: ReactNode;
}

/**
 * Le blason d'une planche. Le serveur replie déjà `blason_url ?? contour_url` :
 * ce que l'on appelle « blason » est souvent un contour transparent, et il reste
 * un `<img>` pour ne jamais se mêler à la gravure.
 *
 * Une image absente du volume tombe sur `fallback` au lieu de montrer l'icône
 * d'image cassée. Le repli est rendu **à la place** de l'image, jamais dans une
 * enveloppe de plus : une planche est plafonnée à 18 nœuds non-SVG (§4.9).
 */
export function CardBlason({
  url,
  credit,
  className = CARD_BLASON_CLASSES,
  fallback = null,
}: CardBlasonProps) {
  const [failed, setFailed] = useState(false);

  if (!url || failed) return <>{fallback}</>;

  return (
    <img
      src={url}
      alt=""
      title={credit ?? undefined}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
