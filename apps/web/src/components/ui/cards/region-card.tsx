import type { Rarity } from '@hexamap/shared';
import { CATEGORY_META } from '../../../lib/category-theme';
import { RARITY_THEME } from '../../../lib/rarity-theme';
import { RaritySeal } from '../rarity-seal';
import { cardShellProps, formatNumber } from './card-shell';

export interface RegionCardProps {
  rarity: Rarity;
  name: string;
  score: number;
  refCode: string;
  blasonUrl: string | null;
  blasonCredit: string | null;
  detailed: boolean;
  locked: boolean;
  decorative: boolean;
  className?: string;
}

/** Planche « Région » — la planche topographique (DESIGN_SYSTEM.md §7.2). */
export function RegionCard({
  rarity,
  name,
  score,
  refCode,
  blasonUrl,
  blasonCredit,
  detailed,
  locked,
  decorative,
  className,
}: RegionCardProps) {
  const theme = RARITY_THEME[rarity];
  const shell = cardShellProps({ rarity, locked, decorative, className });

  const art = (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full text-ink"
      viewBox="0 0 100 140"
      fill="none"
      opacity="0.2"
    >
      <path d="M-6 26 C 20 8, 52 44, 106 18" stroke="currentColor" strokeWidth="1.1" />
      <path d="M-6 42 C 18 24, 50 60, 106 34" stroke="currentColor" strokeWidth="1" />
      <path d="M-6 58 C 16 40, 48 76, 106 50" stroke="currentColor" strokeWidth="0.9" />
      <path d="M-6 74 C 14 56, 46 92, 106 66" stroke="currentColor" strokeWidth="0.8" />
      <path d="M-6 90 C 12 72, 44 108, 106 82" stroke="currentColor" strokeWidth="0.7" />
      <circle cx="76" cy="112" r="10" stroke="currentColor" strokeWidth="0.9" />
      <path d="M76 104v16M68 112h16" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );

  if (decorative) {
    return (
      <article {...shell}>
        <div className="relative h-full w-full overflow-hidden rounded-[1px] bg-vellum">
          {art}
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
        {art}

        <header className="relative flex items-start justify-between gap-[3%]">
          <span className="font-mono text-[clamp(7px,3.1cqi,9px)] uppercase tracking-[0.16em] text-ink-faint">
            {CATEGORY_META.REGION.label}
          </span>
          {blasonUrl ? (
            <img
              src={blasonUrl}
              alt=""
              title={blasonCredit ?? undefined}
              className="h-[clamp(18px,18cqi,44px)] w-[clamp(18px,18cqi,44px)] object-contain opacity-90 mix-blend-multiply"
            />
          ) : (
            <span className="font-mono text-[clamp(7px,3cqi,9px)] tabular-nums tracking-[0.1em] text-ink-faint">
              {refCode}
            </span>
          )}
        </header>

        <div className="relative mt-auto">
          <h3 className="font-display text-[clamp(11px,7.4cqi,20px)] font-semibold leading-[1.05] tracking-tight text-ink break-words line-clamp-2">
            {name}
          </h3>
          <div className="mt-[3%] h-px w-[30%] bg-ink/30" />
          {detailed ? (
            <p className="mt-[3%] font-mono text-[clamp(7px,2.9cqi,8px)] uppercase tracking-[0.14em] text-ink-faint">
              {CATEGORY_META.REGION.plate}
            </p>
          ) : null}
        </div>

        <footer className="relative mt-[3.5%] flex items-end justify-between gap-1 border-t border-ink/20 pt-[3%]">
          <span className="font-display text-[clamp(10px,5.6cqi,15px)] font-semibold leading-none tabular-nums text-ink">
            {formatNumber(score)}
            <span className="plate-optional ml-0.5 font-sans text-[clamp(7px,2.6cqi,8px)] uppercase tracking-[0.1em] text-ink-soft">
              pts
            </span>
          </span>
          <span className="plate-optional font-mono text-[clamp(7px,3cqi,9px)] tabular-nums tracking-[0.08em] text-ink-soft">
            {refCode}
          </span>
          <RaritySeal rarity={rarity} />
        </footer>
      </div>
    </article>
  );
}
