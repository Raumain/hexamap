import type { PackDefinition, PackKey } from '@hexamap/shared';
import { BOUTIQUE, PACK_LABELS, packBonusLabel, packPriceLabel } from '../../content/boutique';
import { priceLabel } from '../../content/market';

const buyButtonClass =
  'mt-5 inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-[2px] border border-brass bg-brass px-4 font-mono text-[10px] uppercase tracking-[0.16em] text-cabinet transition-colors duration-150 hover:bg-brass-pale disabled:cursor-not-allowed disabled:opacity-60';

interface PackCardProps {
  pack: PackDefinition;
  /** Ce pack précis est en vol. */
  pending: boolean;
  /** Un achat est en vol : les autres planches se désarment. */
  disabled: boolean;
  onBuy: (packKey: PackKey) => void;
}

export function PackCard({ pack, pending, disabled, onBuy }: PackCardProps) {
  const label = PACK_LABELS[pack.key];
  const bonus = packBonusLabel(pack.bonusPercent);

  return (
    <article className="flex flex-col rounded-sheet border border-veil bg-cabinet-raised p-5">
      <h2 className="font-display text-xl text-vellum">{label.name}</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-vellum/60">{label.tagline}</p>

      <p className="mt-4 font-display text-2xl tabular-nums text-brass">{priceLabel(pack.ecus)}</p>

      <dl className="mt-3 space-y-1 border-t border-veil pt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-vellum/55">
        <div className="flex items-baseline justify-between gap-3">
          <dt>{BOUTIQUE.priceTtc}</dt>
          <dd className="tabular-nums text-vellum/80">{packPriceLabel(pack.priceCents)}</dd>
        </div>
        {bonus ? (
          <div className="flex items-baseline justify-between gap-3">
            <dt>{BOUTIQUE.bonusLabel}</dt>
            <dd className="text-ok">{bonus}</dd>
          </div>
        ) : null}
      </dl>

      <button
        type="button"
        onClick={() => onBuy(pack.key)}
        disabled={disabled}
        aria-busy={pending || undefined}
        aria-label={`${BOUTIQUE.buy} ${label.name}`}
        className={buyButtonClass}
      >
        {pending ? BOUTIQUE.buying : BOUTIQUE.buy}
      </button>
    </article>
  );
}
