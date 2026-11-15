import { createFileRoute, Navigate } from '@tanstack/react-router';
import { useSession } from '../lib/session';

export const Route = createFileRoute('/')({
  component: DashboardPage,
});

function DashboardPage() {
  const session = useSession();

  if (session.isPending) {
    return <p className="text-slate-400">Chargement de votre session…</p>;
  }

  const user = session.data?.user ?? undefined;
  if (!user) {
    return <Navigate to="/login" />;
  }

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">
          Tableau de bord
        </p>
        <h1 className="text-4xl font-bold tracking-tight">Bienvenue, {user.pseudo}.</h1>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <p className="text-slate-300">Votre collection est vide pour l'instant.</p>
        <p className="mt-2 text-slate-400">
          Le marché et la carte arrivent dans les prochaines phases.
        </p>
      </div>
    </section>
  );
}
