import { Link, useRouterState } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { LEGAL_LINKS, LEGAL_PAGES_ENABLED } from '../../content/legal';
import { CURRENCY, priceLabel } from '../../content/market';
import { useSession } from '../../lib/session';
import { BottomTabBar } from './bottom-tab-bar';
import { HexSeal } from './hex-seal';
import { salonForPath } from './nav-items';
import { NotificationBell } from './notification-bell';
import { PwaUpdatePrompt } from './pwa-update-prompt';
import { Sidebar } from './sidebar';

function MobileHeader() {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const session = useSession();
  const user = session.data?.user ?? undefined;

  return (
    <header className="sticky top-0 z-30 border-b border-veil bg-cabinet/90 pt-[env(safe-area-inset-top)] backdrop-blur-sm md:hidden">
      <div className="flex h-14 items-center justify-between gap-3 pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]">
        <Link to="/" className="flex min-w-0 items-center gap-2.5 text-brass">
          <HexSeal size={22} />
          <span className="truncate font-display text-[17px] font-semibold leading-none text-vellum">
            {salonForPath(pathname)}
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1">
          <NotificationBell />
          {user ? (
            <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-medium tabular-nums text-brass">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-brass" />
              {priceLabel(user.currency ?? 0)}
              <span className="sr-only">{CURRENCY.label}</span>
            </span>
          ) : (
            <Link
              to="/login"
              className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-brass"
            >
              Entrer
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** La coquille du cabinet : rail, en-tête mobile, contenu, barre basse. */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  // La vitrine publique porte sa propre coquille (en-tête, `<main>`, pied) :
  // le rail et la barre d'onglets ne s'y montent pas. L'invitation de mise à
  // jour reste, elle ne dépend d'aucune salle.
  if (pathname === '/home') {
    return (
      <>
        {children}
        <PwaUpdatePrompt />
      </>
    );
  }

  const year = new Date().getFullYear();

  return (
    <div className="min-h-dvh">
      <Sidebar />
      <MobileHeader />

      <div className="md:pl-[calc(232px+env(safe-area-inset-left))]">
        <main
          key={pathname}
          className="enter-salon gutter-safe mx-auto w-full max-w-[1600px] pb-28 pt-6 md:pb-16 md:pt-10"
        >
          {children}
        </main>

        <footer className="gutter-safe mx-auto w-full max-w-[1600px] pb-28 md:pb-10">
          <div className="brass-rule opacity-25" />
          {LEGAL_PAGES_ENABLED ? (
            <nav
              className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2"
              aria-label="Informations légales"
            >
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/60 transition-colors duration-150 hover:text-brass"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.18em] text-vellum/50">
            Hexamap · Cabinet de cartographie · {year}
          </p>
        </footer>
      </div>

      <BottomTabBar />
      <PwaUpdatePrompt />
    </div>
  );
}
