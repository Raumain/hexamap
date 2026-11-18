import { createRootRoute, Link, Outlet, useRouter } from '@tanstack/react-router';
import { CURRENCY, priceLabel } from '../content/market';
import { signOut } from '../lib/auth';
import { useInvalidateSession, useSession } from '../lib/session';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="border-b border-border">
        <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-4 py-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold tracking-tight">
              Hexamap
            </Link>
            <span className="text-sm text-ink-secondary">TCG géographique français</span>
          </div>
          <SessionNav />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-ink-muted">
          Hexamap — TCG géographique français · {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

function SessionNav() {
  const router = useRouter();
  const session = useSession();
  const invalidateSession = useInvalidateSession();
  const user = session.data?.user ?? undefined;

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <Link
          to="/collection"
          className="text-sm text-ink transition-colors duration-150 hover:text-sign-ochre"
        >
          Collection
        </Link>
        <Link
          to="/tableaux"
          className="text-sm text-ink transition-colors duration-150 hover:text-sign-ochre"
        >
          Mes tableaux
        </Link>
        <Link
          to="/tableau"
          className="text-sm text-ink transition-colors duration-150 hover:text-sign-ochre"
        >
          Tableau
        </Link>
        <Link
          to="/market"
          className="text-sm text-ink transition-colors duration-150 hover:text-sign-ochre"
        >
          Marché
        </Link>
        <Link
          to="/market/mine"
          className="text-sm text-ink transition-colors duration-150 hover:text-sign-ochre"
        >
          Mes ventes
        </Link>
        <span className="rounded-full border-2 border-sign-gold bg-amber-100 px-3 py-1 font-mono text-sm font-medium tabular-nums text-sign-ochre">
          {CURRENCY.label} : {priceLabel(user.currency ?? 0)}
        </span>
        <span className="text-sm text-ink">Bonjour, {user.pseudo}</span>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            invalidateSession();
            await router.navigate({ to: '/login' });
          }}
          className="rounded-md border-2 border-border bg-surface px-3 py-1.5 text-sm text-ink shadow-tactile-sm transition-colors duration-150 hover:bg-muted"
        >
          Déconnexion
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        to="/login"
        className="text-sm text-ink transition-colors duration-150 hover:text-sign-ochre"
      >
        Connexion
      </Link>
      <Link
        to="/register"
        className="rounded-md border-2 border-border bg-sign-blue px-3 py-1.5 text-sm font-medium text-ink-inverse shadow-tactile-sm transition-colors duration-150 hover:shadow-tactile"
      >
        S'inscrire
      </Link>
    </div>
  );
}
