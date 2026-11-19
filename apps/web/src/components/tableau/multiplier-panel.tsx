import type { TableauAlignment } from '@hexamap/shared';
import { TABLEAU_LINK_KEYS, TABLEAU_LINK_LABELS } from '@hexamap/shared';
import {
  linksLabel,
  MULTIPLIER_TIERS,
  multiplierAnnouncement,
  multiplierLabel,
  TABLEAU,
} from '../../content/tableau';

interface MultiplierPanelProps {
  alignment: TableauAlignment | null;
}

export function MultiplierPanel({ alignment }: MultiplierPanelProps) {
  // Multiplicateur, nombre de liens et détail viennent du serveur (`preview`).
  const links = alignment?.links ?? 0;
  const multiplier = alignment?.multiplier ?? 1;
  const tier = MULTIPLIER_TIERS[links] ?? MULTIPLIER_TIERS[0];
  const breakdown =
    alignment?.breakdown ??
    TABLEAU_LINK_KEYS.map((key) => ({
      key,
      valid: false,
      label: TABLEAU_LINK_LABELS[key],
    }));

  const frameClass =
    links === 3
      ? 'border-brass bg-brass/10'
      : links > 0
        ? 'border-brass/40 bg-brass/5'
        : 'border-veil bg-cabinet-raised';

  return (
    <section className={`flex flex-col gap-3 rounded-sheet border p-5 ${frameClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-brass/85">
          {TABLEAU.multiplierTitle}
        </p>
        <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55">
          {linksLabel(links)}
        </span>
      </div>

      <p className="font-display text-3xl font-semibold leading-none tabular-nums text-brass md:text-4xl">
        {multiplierLabel(multiplier)}
      </p>

      <div>
        <p className="font-display text-[15px] text-vellum/75">{tier.title}</p>
        <p className="mt-1 text-xs leading-relaxed text-vellum/55">{tier.hint}</p>
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        {breakdown.map((link) => (
          <span
            key={link.key}
            className={`h-1 flex-1 rounded-[1px] ${
              link.valid ? 'bg-brass/60' : 'bg-veil-strong/50'
            }`}
          />
        ))}
      </div>

      <div>
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/55">
          {TABLEAU.linksTitle}
        </p>
        <ul className="mt-2 space-y-2">
          {breakdown.map((link) => (
            <li key={link.key} className="flex items-start justify-between gap-2">
              <span className="text-xs leading-relaxed text-vellum/65">{link.label}</span>
              <span
                aria-hidden="true"
                className={`font-mono text-[11px] leading-none ${
                  link.valid ? 'text-verdigris' : 'text-oxide'
                }`}
              >
                {link.valid ? '✓' : '✗'}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="sr-only" aria-live="polite">
        {multiplierAnnouncement(multiplier, links)}
      </div>
    </section>
  );
}
