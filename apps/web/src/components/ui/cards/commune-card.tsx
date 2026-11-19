import type { Rarity } from '@hexamap/shared';
import { CATEGORY_META } from '../../../lib/category-theme';
import { communeVignette } from '../../../lib/commune-vignette';
import { RARITY_THEME } from '../../../lib/rarity-theme';
import { RaritySeal } from '../rarity-seal';
import { cardShellProps, formatNumber, formatPopulation } from './card-shell';

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

/** Planche « Commune » — la vue, générée depuis le code INSEE (DESIGN_SYSTEM.md §7.2). */
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
  const shell = cardShellProps({ rarity, locked, decorative, className });
  const vignette = communeVignette(refCode);

  const view = (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full text-ink"
      viewBox="0 0 100 66"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
    >
      <path
        d={vignette.ridges}
        fill="currentColor"
        fillOpacity="0.16"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeOpacity="0.6"
      />
      <path
        d={vignette.roofline}
        fill="currentColor"
        fillOpacity="0.38"
        stroke="currentColor"
        strokeWidth="0.55"
        strokeOpacity="0.85"
      />
      <path
        d={`M${vignette.steeple.x} 54 L${vignette.steeple.x} ${54 - vignette.steeple.height} L${
          vignette.steeple.x + vignette.steeple.width / 2
        } ${54 - vignette.steeple.height - vignette.steeple.width * 1.6} L${
          vignette.steeple.x + vignette.steeple.width
        } ${54 - vignette.steeple.height} L${vignette.steeple.x + vignette.steeple.width} 54 Z`}
        fill="currentColor"
        fillOpacity="0.45"
        stroke="currentColor"
        strokeWidth="0.6"
        strokeOpacity="0.9"
      />
      <circle
        cx={vignette.orb.cx}
        cy={vignette.orb.cy}
        r={vignette.orb.r}
        stroke="currentColor"
        strokeWidth="0.5"
        strokeOpacity="0.55"
      />
    </svg>
  );

  if (decorative) {
    return (
      <article {...shell}>
        <div className="relative h-full w-full overflow-hidden rounded-[1px] bg-vellum">
          {view}
          <span
            className="absolute inset-x-0 bottom-0 h-[3px]"
            style={{ backgroundColor: theme.metal }}
          />
        </div>
      </article>
    );
  }

  return (
    <article {...shell} title={blasonCredit ?? undefined}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[1px] bg-vellum px-[4.5%] pb-[3.5%] pt-[3.5%] text-ink">
        <header className="relative flex items-start justify-between gap-[3%]">
          <span className="font-mono text-[clamp(7px,3.1cqi,9px)] uppercase tracking-[0.16em] text-ink-faint">
            {CATEGORY_META.COMMUNE.label}
          </span>
          {blasonUrl ? (
            <img
              src={blasonUrl}
              alt=""
              title={blasonCredit ?? undefined}
              className="h-[clamp(18px,18cqi,44px)] w-[clamp(18px,18cqi,44px)] object-contain opacity-90 mix-blend-multiply"
            />
          ) : null}
        </header>

        <div className="relative my-[4%] h-[38%] overflow-hidden border-y border-ink/15 bg-vellum-2/40">
          {view}
        </div>

        <div className="relative">
          <h3 className="font-display text-[clamp(10px,6.8cqi,17px)] font-semibold leading-[1.05] tracking-tight text-ink break-words line-clamp-2">
            {name}
          </h3>
          <p className="mt-[2.5%] font-mono text-[clamp(7px,3.1cqi,9px)] tabular-nums tracking-[0.06em] text-ink-soft truncate">
            {population === null || population === undefined
              ? `INSEE ${refCode}`
              : `${formatPopulation(population)} hab.`}
          </p>
        </div>

        <footer className="relative mt-auto flex items-end justify-between gap-1 border-t border-ink/20 pt-[3%]">
          <span className="font-display text-[clamp(10px,5.6cqi,15px)] font-semibold leading-none tabular-nums text-ink">
            {formatNumber(score)}
            <span className="plate-optional ml-0.5 font-sans text-[clamp(7px,2.6cqi,8px)] uppercase tracking-[0.1em] text-ink-soft">
              pts
            </span>
          </span>
          {detailed ? (
            <span className="plate-optional font-mono text-[clamp(7px,3cqi,9px)] tabular-nums tracking-[0.06em] text-ink-soft truncate">
              {refCode}
            </span>
          ) : null}
          <RaritySeal rarity={rarity} />
        </footer>
      </div>
    </article>
  );
}
