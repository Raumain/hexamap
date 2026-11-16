import { createRootRoute, Link, Outlet, useRouter } from '@tanstack/react-router';
import { signOut } from '../lib/auth';
import { useInvalidateSession, useSession } from '../lib/session';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <nav className="mx-auto flex w-full max-w-5xl items-center justify-between gap-6 px-4 py-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="text-lg font-semibold tracking-tight">
              Hexamap
            </Link>
            <span className="text-sm text-slate-400">TCG géographique français</span>
          </div>
          <SessionNav />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-slate-800">
        <div className="mx-auto max-w-5xl px-4 py-6 text-sm text-slate-500">
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
          className="text-sm text-slate-200 transition-colors hover:text-amber-400"
        >
          Collection
        </Link>
        <Link
          to="/tableaux"
          className="text-sm text-slate-200 transition-colors hover:text-amber-400"
        >
          Mes tableaux
        </Link>
        <Link
          to="/tableau"
          className="text-sm text-slate-200 transition-colors hover:text-amber-400"
        >
          Tableau
        </Link>
        <span className="text-sm text-slate-200">Bonjour, {user.pseudo}</span>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            invalidateSession();
            await router.navigate({ to: '/login' });
          }}
          className="rounded-md border border-slate-700 px-3 py-1.5 text-sm text-slate-200 transition-colors hover:bg-slate-800"
        >
          Déconnexion
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link to="/login" className="text-sm text-slate-200 transition-colors hover:text-amber-400">
        Connexion
      </Link>
      <Link
        to="/register"
        className="rounded-md bg-amber-400 px-3 py-1.5 text-sm font-medium text-slate-950 transition-colors hover:bg-amber-300"
      >
        S'inscrire
      </Link>
    </div>
  );
}
