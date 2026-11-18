import type { Rarity } from '@hexamap/shared';
import { CATEGORY_LABELS } from '../../../content/tickets';
import { RARITY_THEME } from '../../../lib/rarity-theme';
import { cardShellProps, formatPopulation } from './card-shell';

export interface CommuneCardProps {
  rarity: Rarity;
  name: string;
  score: number;
  refCode: string;
  population: number | null;
  blasonUrl: string | null;
  blasonCredit: string | null;
  detailed: boolean;
  locked: boolean;
  decorative: boolean;
  className?: string;
}

/** Carte « Commune » — panneau d'entrée d'agglomération EB10. */
export function CommuneCard({
  rarity,
  name,
  score,
  refCode,
  population,
  blasonUrl,
  blasonCredit,
  detailed,
  locked,
  decorative,
  className,
}: CommuneCardProps) {
  const theme = RARITY_THEME[rarity];

  return (
    <article {...cardShellProps({ rarity, locked, decorative, className })}>
      <div className="flex items-center justify-between gap-1">
        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
          {CATEGORY_LABELS.COMMUNE}
        </span>
        <span
          className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold ${theme.badgeBgClass} ${theme.badgeTextClass}`}
        >
          {theme.label}
        </span>
      </div>

      <div className="mx-0.5 my-auto rounded-sm border-2 border-sign-red bg-surface px-2 py-2.5 text-center">
        {blasonUrl ? (
          <img
            src={blasonUrl}
            alt=""
            title={blasonCredit ?? undefined}
            className="mx-auto mb-1 h-8 w-8 object-contain"
          />
        ) : null}
        <h3 className="text-xs font-black uppercase leading-tight tracking-tight text-ink line-clamp-2 md:text-sm">
          {name}
        </h3>
        {population === null ? null : (
          <div className="mt-1 inline-block rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-ink-secondary">
            {formatPopulation(population)} hab.
          </div>
        )}
      </div>

      {detailed ? (
        <div className="flex items-center justify-between border-t border-border/30 pt-1.5 font-mono text-[11px] tabular-nums text-ink-secondary">
          <span>{score} pts</span>
          <span>{refCode}</span>
        </div>
      ) : null}
    </article>
  );
}
