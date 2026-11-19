import { Link } from '@tanstack/react-router';
import { useEffect, useId } from 'react';
import { OverlayPortal } from '../ui/overlay-portal';
import { isNavItemActive, MORE_SHEET, SECONDARY_NAV } from './nav-items';

interface MoreSheetProps {
  pathname: string;
  onClose: () => void;
}

/** La feuille des salles secondaires, ouverte par le cinquième onglet mobile. */
export function MoreSheet({ pathname, onClose }: MoreSheetProps) {
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <OverlayPortal>
      <div className="fixed inset-0 z-50 md:hidden" role="presentation">
        <div className="absolute inset-0 bg-cabinet/80" onClick={onClose} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[76vh] flex-col rounded-t-panel border-t border-brass/30 bg-cabinet-raised pt-5 pl-[max(1.25rem,env(safe-area-inset-left))] pr-[max(1.25rem,env(safe-area-inset-right))] pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lifted"
        >
          <div aria-hidden="true" className="mx-auto mb-4 h-1 w-10 rounded-full bg-veil-strong" />

          <div className="flex items-center justify-between gap-4">
            <h2 id={titleId} className="font-display text-xl text-vellum">
              {MORE_SHEET.title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={MORE_SHEET.close}
              className="rounded-[2px] border border-veil px-2 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/70 transition-colors duration-150 hover:border-brass/40 hover:text-brass"
            >
              {MORE_SHEET.close}
            </button>
          </div>

          <ul className="mt-3 flex flex-col">
            {SECONDARY_NAV.map((item) => {
              const active = isNavItemActive(item, pathname);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onClose}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'flex min-h-[44px] items-center gap-3 rounded-[2px] px-1 text-[13.5px] transition-colors duration-150',
                      active ? 'text-brass' : 'text-vellum/70',
                    ].join(' ')}
                  >
                    <svg
                      aria-hidden="true"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      <path d={item.glyph} />
                    </svg>
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </OverlayPortal>
  );
}
