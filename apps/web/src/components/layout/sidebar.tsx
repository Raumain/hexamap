import { Link, useRouter, useRouterState } from '@tanstack/react-router';
import { CURRENCY, priceLabel } from '../../content/market';
import { signOut } from '../../lib/auth';
import { useInvalidateSession, useSession } from '../../lib/session';
import { HexSeal } from './hex-seal';
import { isNavItemActive, PRIMARY_NAV, SECONDARY_NAV } from './nav-items';

function NavGlyph({ path }: { path: string }) {
  return (
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
      <path d={path} />
    </svg>
  );
}

/** Le rail de cabinet, desktop uniquement (DESIGN_SYSTEM.md §9.1). */
export function Sidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const router = useRouter();
  const session = useSession();
  const invalidateSession = useInvalidateSession();
  const user = session.data?.user ?? undefined;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-veil bg-cabinet-raised pl-[env(safe-area-inset-left)] md:flex">
      <div className="pt-[env(safe-area-inset-top)]">
        <div className="px-5 pb-5 pt-6">
          <Link to="/" className="flex items-center gap-3 text-brass">
            <HexSeal size={30} />
            <span className="flex flex-col">
              <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-vellum">
                Hexamap
              </span>
              <span className="font-display text-[11px] italic leading-tight text-vellum/70">
                Cabinet de cartographie
              </span>
            </span>
          </Link>
        </div>
      </div>

      <div className="brass-rule mx-5 opacity-60" />

      <nav aria-label="Salles du cabinet" className="mt-5 flex-1 overflow-y-auto px-3">
        {user ? (
          <>
            <ul className="space-y-1">
              {PRIMARY_NAV.map((item) => {
                const active = isNavItemActive(item, pathname);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'group relative flex items-center gap-3 rounded-[3px] px-3 py-2.5 text-[13.5px] transition-colors duration-150',
                        active
                          ? 'bg-cabinet text-vellum'
                          : 'text-vellum/70 hover:bg-cabinet/60 hover:text-vellum',
                      ].join(' ')}
                    >
                      {active ? (
                        <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-brass" />
                      ) : null}
                      <span className={active ? 'text-brass' : 'text-vellum/60'}>
                        <NavGlyph path={item.glyph} />
                      </span>
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="brass-rule mx-2 my-4 opacity-40" />

            <ul className="space-y-0.5">
              {SECONDARY_NAV.map((item) => {
                const active = isNavItemActive(item, pathname);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'flex items-center gap-3 rounded-[3px] px-3 py-2 text-[12.5px] transition-colors duration-150',
                        active ? 'text-brass' : 'text-vellum/65 hover:text-vellum/80',
                      ].join(' ')}
                    >
                      <NavGlyph path={item.glyph} />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <p className="px-3 font-display text-[13px] italic leading-relaxed text-vellum/65">
            Le cabinet ouvre ses tiroirs à qui s'y présente.
          </p>
        )}
      </nav>

      <div className="border-t border-veil px-4 py-4">
        {user ? (
          <>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/60">
                {CURRENCY.label}
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[12px] font-medium tabular-nums text-brass">
                <span className="inline-block h-2 w-2 rounded-full bg-brass shadow-[0_0_0_2px_rgba(198,161,91,0.18)]" />
                {priceLabel(user.currency ?? 0)}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="truncate font-display text-[13px] text-vellum/75">
                {user.pseudo ?? user.name}
              </span>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  invalidateSession();
                  await router.navigate({ to: '/login' });
                }}
                className="font-mono text-[9px] uppercase tracking-[0.14em] text-vellum/55 transition-colors duration-150 hover:text-oxide"
              >
                Sortir
              </button>
            </div>
          </>
        ) : (
          <Link
            to="/login"
            className="flex items-center justify-center rounded-[2px] border border-brass/50 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-brass transition-colors duration-150 hover:bg-brass/10"
          >
            Entrer
          </Link>
        )}
      </div>
    </aside>
  );
}
