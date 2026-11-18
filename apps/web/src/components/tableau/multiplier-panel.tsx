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

  return (
    <section className={`flex flex-col gap-3 rounded-sm border-2 p-5 ${tier.panelClass}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-ink-secondary">
          {TABLEAU.multiplierTitle}
        </p>
        <span
          className={`inline-flex rounded-sm border px-2 py-0.5 font-mono text-xs font-medium ${tier.badgeClass}`}
        >
          {linksLabel(links)}
        </span>
      </div>

      <p className={`font-mono tabular-nums text-2xl md:text-4xl font-black ${tier.surfaceClass}`}>
        {multiplierLabel(multiplier)}
      </p>

      <div>
        <p className="text-sm font-semibold text-ink">{tier.title}</p>
        <p className="mt-1 text-xs text-ink-secondary">{tier.hint}</p>
      </div>

      <div className="flex gap-1.5" aria-hidden="true">
        {breakdown.map((link) => (
          <span
            key={link.key}
            className={`h-1.5 flex-1 rounded-sm ${link.valid ? 'bg-sign-ochre' : 'bg-muted'}`}
          />
        ))}
      </div>

      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-secondary">
          {TABLEAU.linksTitle}
        </p>
        <ul className="mt-2 space-y-2">
          {breakdown.map((link) => (
            <li key={link.key} className="flex items-start justify-between gap-2 text-sm">
              <span className="text-ink-secondary">{link.label}</span>
              <span
                aria-hidden="true"
                className={`font-mono font-bold ${link.valid ? 'text-emerald-700' : 'text-slate-400'}`}
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
