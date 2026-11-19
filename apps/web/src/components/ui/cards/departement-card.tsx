import type { Rarity } from '@hexamap/shared';
import { CATEGORY_META } from '../../../lib/category-theme';
import { RARITY_THEME } from '../../../lib/rarity-theme';
import { RaritySeal } from '../rarity-seal';
import { cardShellProps, formatNumber } from './card-shell';

export interface DepartementCardProps {
  rarity: Rarity;
  name: string;
  score: number;
  refCode: string;
  blasonUrl: string | null;
  detailed: boolean;
  locked: boolean;
  decorative: boolean;
  className?: string;
}

const SHIELD = 'polygon(50% 0%, 94% 22%, 94% 72%, 50% 100%, 6% 72%, 6% 22%)';

/** Planche « Département » — l'écu (DESIGN_SYSTEM.md §7.2). */
export function DepartementCard({
  rarity,
  name,
  score,
  refCode,
  blasonUrl,
  detailed,
  locked,
  decorative,
  className,
}: DepartementCardProps) {
  const theme = RARITY_THEME[rarity];
  const shell = cardShellProps({ rarity, locked, decorative, className });

  if (decorative) {
    return (
      <article {...shell}>
        <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[1px] bg-vellum">
          <div
            className="flex h-[62%] w-[62%] items-center justify-center border border-ink/70 bg-vellum-2"
            style={{ clipPath: SHIELD }}
          >
            <span className="whitespace-nowrap font-display text-[10px] font-semibold leading-none tabular-nums text-ink">
              {refCode}
            </span>
          </div>
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
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full text-ink"
          viewBox="0 0 100 140"
          fill="none"
          opacity="0.12"
        >
          <path d="M50 8 L92 26 V74 L50 122 L8 74 V26 Z" stroke="currentColor" strokeWidth="0.8" />
          <path
            d="M50 16 L84 31 V72 L50 112 L16 72 V31 Z"
            stroke="currentColor"
            strokeWidth="0.6"
          />
        </svg>

        <header className="relative flex items-start justify-between gap-[3%]">
          <span className="font-mono text-[clamp(7px,3.1cqi,9px)] uppercase tracking-[0.16em] text-ink-faint">
            {CATEGORY_META.DEPARTEMENT.label}
          </span>
          {blasonUrl ? (
            <img
              src={blasonUrl}
              alt=""
              className="h-[clamp(18px,18cqi,44px)] w-[clamp(18px,18cqi,44px)] object-contain opacity-90 mix-blend-multiply"
            />
          ) : (
            <span className="font-mono text-[clamp(7px,3cqi,9px)] uppercase tracking-[0.1em] text-ink-faint">
              Écu
            </span>
          )}
        </header>

        <div className="relative my-auto flex justify-center">
          <div
            className="flex h-[clamp(46px,42cqi,88px)] w-[clamp(40px,37cqi,76px)] items-center justify-center border border-ink/80 bg-vellum-2"
            style={{ clipPath: SHIELD }}
          >
            <span className="font-display text-[clamp(14px,10cqi,24px)] font-semibold leading-none tabular-nums text-ink">
              {refCode}
            </span>
          </div>
        </div>

        <div className="relative text-center">
          <h3 className="font-display text-[clamp(10px,6.6cqi,16px)] font-semibold leading-[1.1] tracking-tight text-ink break-words line-clamp-2">
            {name}
          </h3>
          {detailed ? (
            <p className="mt-[3%] font-mono text-[clamp(7px,2.9cqi,8px)] uppercase tracking-[0.14em] text-ink-faint">
              {CATEGORY_META.DEPARTEMENT.plate}
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
          <RaritySeal rarity={rarity} />
        </footer>
      </div>
    </article>
  );
}
