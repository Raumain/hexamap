import type { Rarity } from '@hexamap/shared';
import { RARITY_THEME } from '../../../lib/rarity-theme';
import { cardShellProps } from './card-shell';

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

/** Carte « Département » — borne routière et écu géométrique. */
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

  return (
    <article {...cardShellProps({ rarity, locked, decorative, className })}>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex select-none items-center justify-center font-mono text-[7rem] font-black leading-none text-ink/10"
      >
        {refCode}
      </div>

      <div
        className="relative z-10 mx-auto my-auto w-full max-w-[7rem] border-2 border-ink bg-paper px-2 py-3 text-center shadow-tactile-sm"
        style={{
          clipPath: 'polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)',
          backgroundImage: blasonUrl ? `url(${blasonUrl})` : undefined,
          backgroundSize: '70%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      >
        <div className="mx-auto w-fit bg-paper px-1 font-mono text-2xl font-black leading-none tabular-nums text-ink">
          {refCode}
        </div>
      </div>

      <div className="relative z-10 text-center">
        <h3 className="text-xs font-bold uppercase leading-tight tracking-tight text-ink line-clamp-2 md:text-sm">
          {name}
        </h3>
      </div>

      {detailed ? (
        <div className="relative z-10 flex items-center justify-between border-t border-border/30 pt-1.5 font-mono text-[11px] tabular-nums text-ink-secondary">
          <span>DÉP. · {score} pts</span>
          <span
            className={`rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${theme.badgeBgClass} ${theme.badgeTextClass}`}
          >
            {theme.label}
          </span>
        </div>
      ) : null}
    </article>
  );
}
