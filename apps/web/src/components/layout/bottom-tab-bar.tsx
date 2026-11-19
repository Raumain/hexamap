import { Link, useRouterState } from '@tanstack/react-router';
import { isNavItemActive, PRIMARY_NAV } from './nav-items';

function TabGlyph({ path }: { path: string }) {
  return (
    <svg
      aria-hidden="true"
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}

/** Les quatre onglets de la barre basse (DESIGN_SYSTEM.md §9.2). */
export function BottomTabBar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav
      aria-label="Salles du cabinet"
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-veil bg-cabinet-raised/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden"
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
    </nav>
  );
}
