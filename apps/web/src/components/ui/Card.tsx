import type { Category, Rarity } from '@hexamap/shared';
import { memo } from 'react';
import { CommuneCard } from './cards/commune-card';
import { DepartementCard } from './cards/departement-card';
import { RegionCard } from './cards/region-card';
import { RueCard } from './cards/rue-card';

export interface CardProps {
  type: Category;
  rarity: Rarity;
  name: string;
  score: number;
  refCode?: string | null;
  population?: number | null;
  occurrenceCount?: number | null;
  blasonUrl?: string | null;
  blasonCredit?: string | null;
  variant?: 'compact' | 'detailed';
  locked?: boolean;
  decorative?: boolean;
  className?: string;
}

function CardBase({
  type,
  rarity,
  name,
  score,
  refCode = null,
  population = null,
  occurrenceCount = null,
  blasonUrl = null,
  blasonCredit = null,
  variant = 'compact',
  locked = false,
  decorative = false,
  className,
}: CardProps) {
  const shared = {
    rarity,
    name,
    score,
    refCode: refCode ?? '—',
    blasonCredit,
    detailed: variant === 'detailed',
    locked,
    decorative,
    className,
  };

  if (type === 'REGION') return <RegionCard {...shared} blasonUrl={blasonUrl} />;
  if (type === 'DEPARTEMENT') return <DepartementCard {...shared} blasonUrl={blasonUrl} />;
  if (type === 'COMMUNE') {
    return <CommuneCard {...shared} blasonUrl={blasonUrl} population={population} />;
  }

  return <RueCard {...shared} occurrenceCount={occurrenceCount} />;
}

export const Card = memo(CardBase);
export default Card;
