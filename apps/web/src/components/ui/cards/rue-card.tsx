import type { Rarity } from '@hexamap/shared';
import { CATEGORY_META } from '../../../lib/category-theme';
import { RARITY_THEME } from '../../../lib/rarity-theme';
import { RaritySeal } from '../rarity-seal';
import { cardShellProps, formatNumber } from './card-shell';

export interface RueCardProps {
  rarity: Rarity;
  name: string;
  score: number;
  refCode: string;
  occurrenceCount: number | null;
  locked: boolean;
  decorative: boolean;
  className?: string;
}

/** Planche « Rue » — le spécimen typographique (DESIGN_SYSTEM.md §7.2). */
export function RueCard({
  rarity,
  name,
  score,
  occurrenceCount,
  locked,
  decorative,
  className,
}: RueCardProps) {
  const theme = RARITY_THEME[rarity];
  const shell = cardShellProps({ rarity, locked, decorative, className });

  const fragment = (
    <svg
      aria-hidden="true"
      className="absolute inset-0 h-full w-full text-ink"
      viewBox="0 0 100 140"
      fill="none"
      opacity="0.22"
    >
      <path d="M-10 104 L110 74" stroke="currentColor" strokeWidth="1.4" />
      <path d="M-10 118 L110 88" stroke="currentColor" strokeWidth="0.8" />
      <path d="M18 -10 L44 150" stroke="currentColor" strokeWidth="0.8" />
      <path d="M62 -10 L88 150" stroke="currentColor" strokeWidth="0.8" />
      <path d="M-10 62 L110 32" stroke="currentColor" strokeWidth="0.6" strokeDasharray="2 3" />
    </svg>
  );

  if (decorative) {
    return (
      <article {...shell}>
        <div className="relative h-full w-full overflow-hidden rounded-[1px] bg-vellum">
          {fragment}
          <span className="absolute left-[6%] top-[5%] whitespace-nowrap font-display text-[10px] italic leading-none text-ink/70">
            rue
          </span>
          <span
            className="absolute inset-x-0 bottom-0 h-[3px]"
            style={{ backgroundColor: theme.metal }}
          />
        </div>
      </article>
    );
  }

  return (
    <article {...shell}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[1px] bg-vellum px-[4.5%] pb-[3.5%] pt-[3.5%] text-ink">
        {fragment}

        <header className="relative flex items-start justify-between gap-[3%]">
          <span className="plate-optional font-mono text-[clamp(7px,3.1cqi,9px)] uppercase tracking-[0.16em] text-ink-faint">
            {CATEGORY_META.RUE.label}
          </span>
          <span className="plate-optional font-mono text-[clamp(7px,3cqi,9px)] uppercase tracking-[0.1em] text-ink-faint">
            Spécimen
          </span>
        </header>

        <div className="relative my-auto py-[4%]">
          <p className="font-display text-[clamp(10px,8.6cqi,21px)] font-semibold italic leading-[1.02] tracking-tight text-ink break-words line-clamp-3">
            {name}
          </p>
          <div className="mt-[4%] h-px w-[34%] bg-ink/30" />
        </div>

        <div className="plate-optional relative">
          <span className="font-mono text-[clamp(7px,2.9cqi,8px)] uppercase tracking-[0.14em] text-ink-faint">
            Occurrences
          </span>
          <div className="mt-[1%] font-display text-[clamp(10px,5.6cqi,15px)] font-semibold leading-none tabular-nums text-ink">
            {formatNumber(occurrenceCount)}
            {occurrenceCount === null || occurrenceCount === undefined ? null : (
              <span className="ml-1 font-sans text-[clamp(7px,2.6cqi,8px)] uppercase tracking-[0.1em] text-ink-soft">
                rép.
              </span>
            )}
          </div>
        </div>

        <footer className="relative mt-[3.5%] flex items-center justify-between gap-1 border-t border-ink/20 pt-[3%]">
          <span className="font-display font-semibold leading-none tabular-nums text-[clamp(10px,5.6cqi,15px)]">
            {formatNumber(score)}
            <span className="plate-optional ml-1 font-sans text-[clamp(10px,2.6cqi,8px)] uppercase tracking-[0.1em] text-ink-soft">
              pts
            </span>
          </span>
          <RaritySeal rarity={rarity} />
        </footer>
      </div>
    </article>
  );
}
