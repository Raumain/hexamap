import type { Category, Rarity } from '@hexamap/shared';
import { memo } from 'react';
import { CATEGORY_LABELS, RARITY_LABELS } from '../../content/tickets';
import { CATEGORY_ACCENT, RARITY_CARD_STYLES, RARITY_TEXT } from './card-styles';

interface CardProps {
  type: Category;
  rarity: Rarity;
  name: string;
  score: number;
  refCode?: string;
  population?: number;
  blasonUrl?: string | null;
  blasonCredit?: string | null;
  variant?: 'compact' | 'detailed';
  locked?: boolean;
  decorative?: boolean;
  className?: string;
}

const scoreFormatter = new Intl.NumberFormat('fr-FR');
const populationFormatter = new Intl.NumberFormat('fr-FR');

const BLAZON_MOTIF: Record<Category, string> = {
  REGION:
    'M12 7.2 13.7 10.6 17.4 11.2 14.8 13.8 15.4 17.5 12 15.7 8.6 17.5 9.2 13.8 6.6 11.2 10.3 10.6z',
  DEPARTEMENT: 'M6 10h12v4H6z',
  COMMUNE: 'M9 19v-5h2v-3h2v3h2v5z',
  RUE: '',
};

function nameHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash + name.charCodeAt(i) * 7) % 360;
  }
  return hash;
}

function CardBase({
  type,
  rarity,
  name,
  score,
  refCode,
  population,
  blasonUrl,
  blasonCredit,
  variant = 'compact',
  locked = false,
  decorative = false,
  className,
}: CardProps) {
  const detailed = variant === 'detailed';

  return (
    <article
      aria-hidden={decorative ? true : undefined}
      className={[
        'relative isolate flex aspect-[2.5/3.5] w-full flex-col overflow-hidden rounded-xl border-2',
        RARITY_CARD_STYLES[rarity],
        locked ? 'opacity-60 saturate-50' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {type === 'RUE' ? (
        <RuePlaque name={name} />
      ) : (
        <TerritoryFace
          type={type}
          name={name}
          hue={nameHue(name)}
          population={population}
          blasonUrl={blasonUrl}
          blasonCredit={blasonCredit}
          detailed={detailed}
        />
      )}
      <CardFooter rarity={rarity} score={score} refCode={refCode} detailed={detailed} />
    </article>
  );
}

export const Card = memo(CardBase);
export default Card;

function RuePlaque({ name }: { name: string }) {
  return (
    <div className="relative z-10 m-1.5 flex flex-1 items-center justify-center rounded-md border border-emerald-200/80 bg-blue-900 px-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
      <span className="min-w-0 truncate text-center text-xs font-semibold uppercase tracking-wider text-white">
        {name}
      </span>
      <span
        aria-hidden="true"
        className="absolute left-1.5 top-1.5 size-1.5 rounded-full bg-slate-300/80 ring-1 ring-slate-500/60"
      />
      <span
        aria-hidden="true"
        className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-slate-300/80 ring-1 ring-slate-500/60"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-1.5 left-1.5 size-1.5 rounded-full bg-slate-300/80 ring-1 ring-slate-500/60"
      />
      <span
        aria-hidden="true"
        className="absolute bottom-1.5 right-1.5 size-1.5 rounded-full bg-slate-300/80 ring-1 ring-slate-500/60"
      />
    </div>
  );
}

interface TerritoryFaceProps {
  type: Category;
  name: string;
  hue: number;
  population?: number;
  blasonUrl?: string | null;
  blasonCredit?: string | null;
  detailed: boolean;
}

function TerritoryFace({
  type,
  name,
  hue,
  population,
  blasonUrl,
  blasonCredit,
  detailed,
}: TerritoryFaceProps) {
  return (
    <div className="relative z-10 flex flex-1 flex-col items-center gap-1 px-2 pt-2.5">
      <div className="relative flex min-h-0 w-full flex-1 items-center justify-center">
        <Blason type={type} hue={hue} className="h-full w-auto" />
        {blasonUrl ? (
          <img
            src={blasonUrl}
            alt=""
            aria-hidden="true"
            decoding="async"
            title={blasonCredit ?? undefined}
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
            className="absolute inset-0 size-full object-contain drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]"
          />
        ) : null}
      </div>
      <h3 className="mt-1 w-full truncate text-center text-xs font-semibold text-slate-100">
        {name}
      </h3>
      <p
        className={[
          'text-[10px] font-medium uppercase tracking-widest',
          CATEGORY_ACCENT[type],
          detailed ? 'block' : 'hidden',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {CATEGORY_LABELS[type]}
      </p>
      <p
        className={[
          'text-[10px] tabular-nums text-slate-400',
          population !== undefined && detailed ? 'block' : 'hidden',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {population !== undefined ? populationFormatter.format(population) : ''}
      </p>
    </div>
  );
}

function Blason({ type, hue, className }: { type: Category; hue: number; className?: string }) {
  const fill = `hsl(${hue} 55% 24%)`;
  const accent = `hsl(${hue} 60% 68%)`;
  const motif = BLAZON_MOTIF[type];
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 2 21 5v7c0 5-4 8.5-9 10-5-1.5-9-5-9-10V5z"
        fill={fill}
        stroke={accent}
        strokeWidth="1"
      />
      {motif !== '' ? (
        <path d={motif} fill={accent} stroke={accent} strokeWidth="0.5" strokeLinejoin="round" />
      ) : null}
    </svg>
  );
}

interface CardFooterProps {
  rarity: Rarity;
  score: number;
  refCode?: string;
  detailed: boolean;
}

function CardFooter({ rarity, score, refCode, detailed }: CardFooterProps) {
  return (
    <div className="relative z-10 flex items-center justify-between gap-1 border-t border-white/10 px-1.5 py-0.5">
      <span
        className={`truncate font-bold tabular-nums text-slate-100 ${detailed ? 'text-xs' : 'text-[9px]'}`}
      >
        {scoreFormatter.format(score)}
      </span>
      <span
        className={[
          'truncate text-[9px] font-semibold uppercase tracking-wide',
          RARITY_TEXT[rarity],
          detailed ? 'block' : 'hidden',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {RARITY_LABELS[rarity]}
      </span>
      <span
        className={['truncate text-[9px] text-slate-500', refCode && detailed ? 'block' : 'hidden']
          .filter(Boolean)
          .join(' ')}
      >
        {refCode}
      </span>
    </div>
  );
}
