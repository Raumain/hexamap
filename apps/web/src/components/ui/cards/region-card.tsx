import type { Rarity } from '@hexamap/shared';
import { CATEGORY_LABELS } from '../../../content/tickets';
import { RARITY_THEME } from '../../../lib/rarity-theme';
import { cardShellProps } from './card-shell';

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

/** Carte « Région » — topographie IGN sur papier ancien. */
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
  const shell = cardShellProps({
    rarity,
    locked,
    decorative,
    className,
    background: 'bg-paper',
    style: {
      backgroundImage: blasonUrl ? `url(${blasonUrl})` : undefined,
      backgroundSize: '60%',
      backgroundPosition: 'center 60%',
      backgroundRepeat: 'no-repeat',
    },
  });

  return (
    <article {...shell} title={blasonCredit ?? undefined}>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-20"
        viewBox="0 0 100 140"
        fill="none"
      >
        <path
          d="M-10 30 C 30 10, 70 50, 110 25 C 75 70, 25 90, -10 110 Z"
          stroke="currentColor"
          strokeWidth="1.2"
          className="text-sign-ochre"
        />
        <path
          d="M10 45 C 40 30, 65 55, 95 40 C 70 75, 35 85, 10 100 Z"
          stroke="currentColor"
          strokeWidth="1"
          className="text-sign-ochre"
        />
        <path
          d="M25 60 C 45 50, 60 65, 80 55 C 65 75, 45 80, 25 88 Z"
          stroke="currentColor"
          strokeWidth="0.8"
          className="text-sign-ochre"
        />
      </svg>

      <div className="z-10 flex items-center justify-between gap-1">
        <span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-ink-secondary">
          {CATEGORY_LABELS.REGION}
        </span>
        <span
          className={`rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold ${theme.badgeBgClass} ${theme.badgeTextClass}`}
        >
          {theme.label}
        </span>
      </div>

      <div className="z-10 my-auto bg-paper px-1 text-center">
        <div className="mb-0.5 font-mono text-xs tabular-nums text-ink-secondary">
          INSEE {refCode}
        </div>
        <h3 className="text-sm font-bold uppercase leading-tight tracking-tight text-ink line-clamp-2 md:text-base">
          {name}
        </h3>
      </div>

      {detailed ? (
        <div className="z-10 flex items-center justify-between border-t border-border/30 pt-1.5 font-mono text-[11px] tabular-nums text-ink-secondary">
          <span>+{score} pts</span>
          <span>IGN-REG</span>
        </div>
      ) : null}
    </article>
  );
}
