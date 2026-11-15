import { createRootRoute, Link, Outlet } from '@tanstack/react-router';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800">
        <nav className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-4">
          <Link to="/" className="text-lg font-semibold tracking-tight">
            Hexamap
          </Link>
          <span className="text-sm text-slate-400">TCG géographique français</span>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Outlet />
      </main>
    </div>
  );
}
