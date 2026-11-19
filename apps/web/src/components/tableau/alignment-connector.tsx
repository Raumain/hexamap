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
    <div
      className={
        vertical
          ? 'relative flex h-full items-center justify-center'
          : 'relative flex w-full items-center justify-center'
      }
    >
      <div
        aria-hidden="true"
        className={vertical ? 'h-full w-px bg-brass/30' : 'h-px w-full bg-brass/30'}
      />
      <span
        aria-hidden="true"
        className={`absolute inline-flex h-3 w-3 items-center justify-center rounded-full border font-mono text-[8px] leading-none ${
          valid
            ? 'border-verdigris/45 bg-cabinet text-verdigris'
            : 'border-veil-strong/60 bg-cabinet text-vellum/55'
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
        <li key={link.key} className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-[2px] border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
              link.valid
                ? 'border-verdigris/45 text-verdigris'
                : 'border-veil-strong/60 text-vellum/55'
            }`}
          >
            {linkStatusLabel(link.valid)}
          </span>
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-vellum/60">
            {link.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
