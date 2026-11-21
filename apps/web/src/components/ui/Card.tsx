import type { Category, Rarity } from '@hexamap/shared';
import { memo } from 'react';
import { CommuneCard } from './cards/commune-card';
import { DepartementCard } from './cards/departement-card';
import { DetailedPlate } from './cards/detailed-plate';
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
  departementName?: string | null;
  regionName?: string | null;
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
  departementName = null,
  regionName = null,
  blasonUrl = null,
  blasonCredit = null,
  variant = 'compact',
  locked = false,
  decorative = false,
  className,
}: CardProps) {
  // Le Cartel rend une composition distincte, jamais une planche agrandie.
  if (variant === 'detailed') {
    return (
      <DetailedPlate
        category={type}
        rarity={rarity}
        name={name}
        score={score}
        refCode={refCode}
        population={population}
        occurrenceCount={occurrenceCount}
        departementName={departementName}
        regionName={regionName}
        blasonUrl={blasonUrl}
        blasonCredit={blasonCredit}
        locked={locked}
        className={className}
      />
    );
  }

  const shared = {
    rarity,
    name,
    score,
    refCode: refCode ?? '—',
    blasonCredit,
    locked,
    decorative,
    className,
  };

  if (type === 'REGION') return <RegionCard {...shared} blasonUrl={blasonUrl} />;
  if (type === 'DEPARTEMENT') return <DepartementCard {...shared} blasonUrl={blasonUrl} />;
  if (type === 'COMMUNE')
    return <CommuneCard {...shared} blasonUrl={blasonUrl} population={population} />;

  return <RueCard {...shared} occurrenceCount={occurrenceCount} />;
}

export const Card = memo(CardBase);
export default Card;
