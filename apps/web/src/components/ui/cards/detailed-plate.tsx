import type { Category, Rarity } from '@hexamap/shared';
import { CATEGORY_META } from '../../../lib/category-theme';
import { communeVignette } from '../../../lib/commune-vignette';
import { RARITY_THEME } from '../../../lib/rarity-theme';
import { RaritySeal } from '../rarity-seal';
import { cardShellProps, formatNumber, formatPopulation } from './card-shell';

const SHIELD = 'polygon(50% 0%, 94% 22%, 94% 72%, 50% 100%, 6% 72%, 6% 22%)';

export interface DetailedPlateProps {
  category: Category;
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
  locked?: boolean;
  className?: string;
}

/**
 * La planche de musée — la composition du Cartel (DESIGN_SYSTEM.md §7.1, §8.7).
 *
 * Quatre zones empilées, sans recouvrement : en-tête, bande de gravure réservée,
 * cartouche (sceau + lecture), pied. Le blason et la gravure ne partagent jamais
 * une surface, et aucun mode de fusion n'est employé : un contour transparent
 * se confondrait autrement avec la gravure.
 */
export function DetailedPlate({
  category,
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
  locked = false,
  className,
}: DetailedPlateProps) {
  const label = refCode ?? '—';
  const theme = RARITY_THEME[rarity];
  const meta = CATEGORY_META[category];
  const shell = cardShellProps({ rarity, locked, className, ratio: 'plate' });
  const vignette = communeVignette(label);

  const engraving =
    category === 'REGION' ? (
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full text-ink"
        viewBox="0 0 100 140"
        preserveAspectRatio="xMidYMid slice"
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
    ) : category === 'DEPARTEMENT' ? (
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full text-ink"
        viewBox="0 0 100 140"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        opacity="0.16"
      >
        <path d="M50 8 L92 26 V74 L50 122 L8 74 V26 Z" stroke="currentColor" strokeWidth="0.8" />
        <path d="M50 16 L84 31 V72 L50 112 L16 72 V31 Z" stroke="currentColor" strokeWidth="0.6" />
      </svg>
    ) : category === 'COMMUNE' ? (
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full text-ink"
        viewBox="0 0 100 66"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        opacity="0.26"
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
    ) : (
      <svg
        aria-hidden="true"
        className="absolute inset-0 h-full w-full text-ink"
        viewBox="0 0 100 140"
        preserveAspectRatio="xMidYMid slice"
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

  const dataLines: string[] = [];
  if (category === 'DEPARTEMENT') {
    if (population !== null && population !== undefined) {
      dataLines.push(`${formatPopulation(population)} hab.`);
    }
    if (regionName) dataLines.push(regionName);
  } else if (category === 'COMMUNE') {
    dataLines.push(
      population === null || population === undefined
        ? `INSEE ${label}`
        : `${formatPopulation(population)} hab.`,
    );
    const parents = [departementName, regionName].filter(Boolean).join(' · ');
    if (parents) dataLines.push(parents);
  } else if (category === 'RUE') {
    if (occurrenceCount !== null && occurrenceCount !== undefined) {
      dataLines.push(`Occurrences : ${formatNumber(occurrenceCount)}`);
    }
  }

  const seal =
    category === 'RUE' ? (
      <span className="font-display text-[clamp(18px,7cqi,34px)] italic leading-none text-ink/50">
        rue
      </span>
    ) : category === 'DEPARTEMENT' ? (
      <div
        className="flex aspect-[5/6] w-full items-center justify-center border border-ink/60 bg-vellum p-[8%]"
        style={{ clipPath: SHIELD }}
      >
        {blasonUrl ? (
          <img
            src={blasonUrl}
            alt=""
            title={blasonCredit ?? undefined}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="font-display text-[clamp(14px,10cqi,24px)] font-semibold leading-none tabular-nums text-ink">
            {label}
          </span>
        )}
      </div>
    ) : (
      <div className="flex aspect-square w-full items-center justify-center rounded-full border border-brass/50 bg-vellum p-[9%]">
        {blasonUrl ? (
          <img
            src={blasonUrl}
            alt=""
            title={blasonCredit ?? undefined}
            className="h-full w-full object-contain"
          />
        ) : (
          <span className="font-mono text-[clamp(10px,3cqi,12px)] tabular-nums tracking-[0.1em] text-ink-faint">
            {label}
          </span>
        )}
      </div>
    );

  return (
    <article {...shell} title={blasonCredit ?? undefined}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-[1px] bg-vellum px-[5%] pb-[4%] pt-[4%] text-ink">
        <div className="flex items-start justify-between gap-[3%]">
          <span className="font-mono text-[clamp(10px,2.4cqi,11px)] uppercase tracking-[0.16em] text-ink-faint">
            {meta.label}
          </span>
          <span className="font-mono text-[clamp(10px,2.4cqi,11px)] tabular-nums tracking-[0.1em] text-ink-soft">
            {label}
          </span>
        </div>

        <div className="relative mt-[4%] h-[clamp(96px,42cqi,190px)] w-full overflow-hidden rounded-[1px] border border-ink/15 bg-vellum-2/50">
          {engraving}
        </div>

        <div className="mt-[5%] flex items-start gap-[4%]">
          <div className="flex w-[clamp(56px,26cqi,140px)] shrink-0 items-start justify-center">
            {seal}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="font-display text-[clamp(20px,7.6cqi,34px)] font-semibold leading-[1.02] tracking-tight text-ink break-words line-clamp-3">
              {name}
            </h3>
            <div className="mt-[3%] h-px w-[38%] bg-brass/60" />
            {dataLines.map((line) => (
              <p
                key={line}
                className="mt-[3%] font-mono text-[clamp(10px,3.1cqi,12px)] tabular-nums text-ink-soft break-words"
              >
                {line}
              </p>
            ))}
            <p className="mt-[4%] font-mono text-[clamp(10px,2.6cqi,11px)] uppercase tracking-[0.14em] text-ink-faint">
              {meta.plate}
            </p>
          </div>
        </div>

        <footer className="mt-auto flex items-end justify-between border-t border-ink/20 pt-[3%]">
          <span className="font-display text-[clamp(18px,6.4cqi,30px)] font-semibold leading-none tabular-nums text-ink">
            {formatNumber(score)}
            <span className="ml-1 font-sans text-[clamp(10px,2.4cqi,11px)] uppercase tracking-[0.1em] text-ink-soft">
              pts
            </span>
          </span>
          <span className="flex items-center gap-[6%]">
            <RaritySeal rarity={rarity} />
            <span className="font-mono text-[clamp(10px,2.4cqi,11px)] uppercase tracking-[0.1em] text-ink-soft">
              {theme.label}
            </span>
          </span>
        </footer>
      </div>
    </article>
  );
}
