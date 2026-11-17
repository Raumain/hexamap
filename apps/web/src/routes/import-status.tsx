import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { type ImportStatus, importStatusQueryOptions } from '../lib/import-status';

export const Route = createFileRoute('/import-status')({
  component: ImportStatusPage,
});

const countFormatter = new Intl.NumberFormat('fr-FR');

function formatCount(value: number): string {
  return countFormatter.format(value);
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number): string => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}

type StatusTone = 'running' | 'done' | 'failed' | 'idle';

const TONE_CLASSES: Record<StatusTone, string> = {
  running: 'border-amber-400/40 bg-amber-400/10 text-amber-300 animate-pulse',
  done: 'border-emerald-400/40 bg-emerald-400/10 text-emerald-300',
  failed: 'border-red-500/40 bg-red-500/10 text-red-300',
  idle: 'border-slate-700 bg-slate-800/60 text-slate-300',
};

const TONE_LABELS: Record<StatusTone, string> = {
  running: 'En cours',
  done: 'Terminé',
  failed: 'Échec',
  idle: 'Inactif',
};

function statusTone(status: ImportStatus): StatusTone {
  if (status.error !== null) return 'failed';
  if (status.running) return 'running';
  if (status.finishedAt !== null) return 'done';
  return 'idle';
}

function ImportStatusPage() {
  const query = useQuery(importStatusQueryOptions);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-widest text-amber-400">
          Import Open Data
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Suivi de l'import</h1>
        <p className="text-slate-400">
          Cette page se rafraîchit automatiquement : le pipeline publie son avancement dans un
          fichier d'état partagé, relu chaque seconde par l'API.
        </p>
      </header>

      {query.isPending ? (
        <p className="text-slate-400">Chargement du statut…</p>
      ) : query.isError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300"
        >
          {query.error instanceof Error ? query.error.message : 'Statut indisponible.'}
        </p>
      ) : (
        <StatusPanel status={query.data} />
      )}

      <p className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-500">
        Outil de développement — cette page peut être supprimée une fois l'import terminé.
      </p>
    </section>
  );
}

function StatusPanel({ status }: { status: ImportStatus }) {
  const tone = statusTone(status);
  const percent =
    status.total !== null && status.total > 0
      ? Math.min(100, Math.round((status.done / status.total) * 100))
      : null;

  const startedAt = status.startedAt === null ? null : Date.parse(status.startedAt);
  const endsAt = status.finishedAt === null ? Date.now() : Date.parse(status.finishedAt);
  const elapsed =
    startedAt !== null && Number.isFinite(startedAt) && Number.isFinite(endsAt)
      ? endsAt - startedAt
      : null;
  const remaining =
    elapsed !== null && status.done > 0 && status.total !== null
      ? (elapsed / status.done) * Math.max(0, status.total - status.done)
      : null;

  return (
    <div
      aria-live="polite"
      className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/60 p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-lg font-semibold">{status.phaseLabel}</p>
          <p className="text-sm text-slate-400">
            {status.steps > 0 ? `Étape ${status.step} / ${status.steps}` : 'Aucune étape en cours'}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-sm font-medium ${TONE_CLASSES[tone]}`}>
          {TONE_LABELS[tone]}
        </span>
      </div>

      <div className="space-y-2">
        <div
          role="progressbar"
          aria-label="Progression de l'import"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent ?? undefined}
          className="h-2 w-full overflow-hidden rounded-full bg-slate-800"
        >
          <div
            className={
              percent === null
                ? 'h-full animate-pulse rounded-full bg-amber-400/60'
                : 'h-full rounded-full bg-amber-400'
            }
            style={{ width: `${percent ?? 100}%` }}
          />
        </div>
        <p className="text-sm text-slate-400">
          {percent === null ? 'Progression indéterminée' : `${percent} %`}
        </p>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <dt className="text-xs uppercase tracking-widest text-slate-500">Traité</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">{formatCount(status.done)}</dd>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <dt className="text-xs uppercase tracking-widest text-slate-500">Total</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {status.total === null ? 'Indéterminé' : formatCount(status.total)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <dt className="text-xs uppercase tracking-widest text-slate-500">Durée écoulée</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {elapsed === null ? '—' : formatDuration(elapsed)}
          </dd>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
          <dt className="text-xs uppercase tracking-widest text-slate-500">Restant estimé</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums">
            {remaining === null ? '—' : formatDuration(remaining)}
          </dd>
        </div>
      </dl>

      {status.message !== '' && <p className="text-slate-300">{status.message}</p>}

      {status.error !== null && (
        <div
          role="alert"
          className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
        >
          <p className="font-medium">Échec de l'import</p>
          <p className="mt-1 whitespace-pre-wrap">{status.error}</p>
        </div>
      )}

      {status.log.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-widest text-slate-500">
            Journal ({status.log.length})
          </h2>
          <ol className="space-y-1 rounded-lg border border-slate-800 bg-slate-950/60 p-3 font-mono text-xs">
            {status.log.map((line, index) => (
              <li
                key={line}
                className={index === status.log.length - 1 ? 'text-amber-300' : 'text-slate-400'}
              >
                {line}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
