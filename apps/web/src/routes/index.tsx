import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '../lib/api';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  const health = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const { data, error } = await api.api.v1.health.get();

      if (error) {
        throw new Error('API indisponible');
      }

      return data;
    },
  });

  return (
    <section className="space-y-8">
      <div className="space-y-3">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">
          Projet Hexagone
        </p>
        <h1 className="text-4xl font-bold tracking-tight">
          Grattez la France, collectionnez ses territoires.
        </h1>
        <p className="max-w-2xl text-slate-300">
          Hexamap est un jeu de cartes à collectionner communautaire basé sur les données
          géographiques françaises : régions, départements, communes et rues réelles.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-6">
        <h2 className="text-lg font-semibold">État du service</h2>
        {health.isPending ? <p className="mt-2 text-slate-400">Vérification de l'API…</p> : null}
        {health.isError ? (
          <p className="mt-2 text-rose-400">L'API n'est pas joignable pour le moment.</p>
        ) : null}
        {health.data ? (
          <p className="mt-2 text-emerald-400">API opérationnelle — {health.data.service}</p>
        ) : null}
      </div>
    </section>
  );
}
