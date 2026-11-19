import { Link, useRouterState } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { useSession } from '../../lib/session';
import { MoreSheet } from './more-sheet';
import { isNavItemActive, isSecondaryRoom, MORE_SHEET, PRIMARY_NAV } from './nav-items';

function TabGlyph({ path, strokeWidth = 1.3 }: { path: string; strokeWidth?: number }) {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

/** Les quatre onglets de la barre basse et la feuille des salles secondaires (DESIGN_SYSTEM.md §9.2). */
export function BottomTabBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = useSession();
  const [open, setOpen] = useState(false);
  const plusRef = useRef<HTMLButtonElement>(null);

  function close() {
    setOpen(false);
    plusRef.current?.focus();
  }

  const signedIn = Boolean(session.data?.user);
  const secondaryActive = isSecondaryRoom(pathname);

  return (
    <>
      <nav
        aria-label="Salles du cabinet"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-veil bg-cabinet-raised/95 pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
      >
        {PRIMARY_NAV.map((item) => {
          const active = isNavItemActive(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={[
                'relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 pb-1.5 pt-2 transition-colors duration-150',
                active ? 'text-brass' : 'text-vellum/70',
              ].join(' ')}
            >
              {active ? (
                <span className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-brass" />
              ) : null}
              <TabGlyph path={item.glyph} />
              <span className="font-mono text-[9px] uppercase tracking-[0.1em]">{item.short}</span>
            </Link>
          );
        })}

        {signedIn ? (
          <button
            ref={plusRef}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => (open ? close() : setOpen(true))}
            className={[
              'relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 px-1 pb-1.5 pt-2 transition-colors duration-150',
              secondaryActive ? 'text-brass' : 'text-vellum/70',
            ].join(' ')}
          >
            {secondaryActive ? (
              <span className="absolute inset-x-3 top-0 h-[2px] rounded-full bg-brass" />
            ) : null}
            <TabGlyph path="M6 12h.01M12 12h.01M18 12h.01" strokeWidth={2.2} />
            <span className="font-mono text-[9px] uppercase tracking-[0.1em]">
              {MORE_SHEET.control}
            </span>
          </button>
        ) : null}
      </nav>

      {open ? <MoreSheet pathname={pathname} onClose={close} /> : null}
    </>
  );
}
