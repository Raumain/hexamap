import type { TableauAlignment } from '@hexamap/shared';
import { connectorAriaLabel, linkStatusLabel } from '../../content/tableau';

interface AlignmentConnectorProps {
  valid: boolean;
  label: string;
  orientation?: 'horizontal' | 'vertical';
}

/**
 * Trait visuel entre deux emplacements adjacents.
 * `valid` vient exclusivement de `TableauAlignment.breakdown[].valid` :
 * aucune règle géographique n'est recalculée ici.
 */
export function AlignmentConnector({
  valid,
  label,
  orientation = 'horizontal',
}: AlignmentConnectorProps) {
  const vertical = orientation === 'vertical';

  return (
    <div className="relative flex items-center justify-center">
      <svg
        aria-hidden="true"
        focusable="false"
        className={vertical ? 'h-full w-2' : 'h-2 w-full'}
        viewBox={vertical ? '0 0 2 100' : '0 0 100 2'}
        preserveAspectRatio="none"
        fill="none"
      >
        <line
          x1={vertical ? 1 : 0}
          y1={vertical ? 0 : 1}
          x2={vertical ? 1 : 100}
          y2={vertical ? 100 : 1}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
          strokeDasharray={valid ? undefined : '4 3'}
          className={valid ? 'stroke-emerald-700' : 'stroke-slate-400'}
        />
      </svg>
      <span
        aria-hidden="true"
        className={`absolute inline-flex h-4 w-4 items-center justify-center rounded-sm border font-mono text-[10px] font-bold ${
          valid
            ? 'border-emerald-700 bg-emerald-100 text-emerald-900'
            : 'border-slate-400 bg-slate-200 text-slate-600'
        }`}
      >
        {valid ? '✓' : '✗'}
      </span>
      <span className="sr-only">{connectorAriaLabel(label, valid)}</span>
    </div>
  );
}

interface AlignmentLinkListProps {
  breakdown: TableauAlignment['breakdown'];
  className?: string;
}

/** Liste compacte des liens, partagée par le board mobile et la liste des tableaux. */
export function AlignmentLinkList({ breakdown, className }: AlignmentLinkListProps) {
  return (
    <ul className={`flex flex-wrap gap-2 ${className ?? ''}`}>
      {breakdown.map((link) => (
        <li key={link.key} className="flex items-center gap-1.5">
          <span
            className={`rounded-sm border px-2 py-0.5 font-mono text-xs font-bold ${
              link.valid
                ? 'border-emerald-700 bg-emerald-100 text-emerald-900'
                : 'border-slate-400 bg-slate-200 text-slate-600'
            }`}
          >
            {linkStatusLabel(link.valid)}
          </span>
          <span className="text-xs text-ink-secondary">{link.label}</span>
        </li>
      ))}
    </ul>
  );
}
