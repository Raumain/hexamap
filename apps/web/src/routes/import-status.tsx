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
  running: 'border-sign-gold bg-amber-100 text-sign-ochre',
  done: 'border-sign-green bg-sign-green/10 text-sign-green',
  failed: 'border-sign-red bg-sign-red/10 text-sign-red',
  idle: 'border-border bg-muted text-ink-secondary',
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
        <p className="text-sm font-medium uppercase tracking-widest text-sign-ochre">
          Import Open Data
        </p>
        <h1 className="text-3xl font-bold tracking-tight">Suivi de l'import</h1>
        <p className="text-ink-secondary">
          Cette page se rafraîchit automatiquement : le pipeline publie son avancement dans un
          fichier d'état partagé, relu chaque seconde par l'API.
        </p>
      </header>

      {query.isPending ? (
        <p className="text-ink-secondary">Chargement du statut…</p>
      ) : query.isError ? (
        <p
          role="alert"
          className="rounded-md border border-sign-red/40 bg-sign-red/10 p-4 text-sm text-sign-red"
        >
          {query.error instanceof Error ? query.error.message : 'Statut indisponible.'}
        </p>
      ) : (
        <StatusPanel status={query.data} />
      )}

      <p className="rounded-md border border-border bg-paper p-3 text-xs text-ink-muted">
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
      className="space-y-6 rounded-md border-2 border-border bg-surface shadow-tactile p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-lg font-semibold">{status.phaseLabel}</p>
          <p className="text-sm text-ink-secondary">
            {status.steps > 0 ? `Étape ${status.step} / ${status.steps}` : 'Aucune étape en cours'}
          </p>
        </div>
        <span className={`rounded-sm border px-3 py-1 text-sm font-medium ${TONE_CLASSES[tone]}`}>
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
          className="h-2 w-full overflow-hidden rounded-sm bg-muted"
        >
          <div
            className={
              percent === null
                ? 'h-full rounded-sm bg-sign-ochre/60'
                : 'h-full rounded-sm bg-sign-ochre'
            }
            style={{ width: `${percent ?? 100}%` }}
          />
        </div>
        <p className="text-sm text-ink-secondary">
          {percent === null ? 'Progression indéterminée' : `${percent} %`}
        </p>
      </div>

      <dl className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border border-border bg-paper p-3 shadow-tactile-sm">
          <dt className="text-xs uppercase tracking-widest text-ink-muted">Traité</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {formatCount(status.done)}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-paper p-3 shadow-tactile-sm">
          <dt className="text-xs uppercase tracking-widest text-ink-muted">Total</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {status.total === null ? 'Indéterminé' : formatCount(status.total)}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-paper p-3 shadow-tactile-sm">
          <dt className="text-xs uppercase tracking-widest text-ink-muted">Durée écoulée</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {elapsed === null ? '—' : formatDuration(elapsed)}
          </dd>
        </div>
        <div className="rounded-md border border-border bg-paper p-3 shadow-tactile-sm">
          <dt className="text-xs uppercase tracking-widest text-ink-muted">Restant estimé</dt>
          <dd className="mt-1 font-mono text-lg font-semibold tabular-nums">
            {remaining === null ? '—' : formatDuration(remaining)}
          </dd>
        </div>
      </dl>

      {status.message !== '' && <p className="text-ink-secondary">{status.message}</p>}

      {status.error !== null && (
        <div
          role="alert"
          className="rounded-md border border-sign-red/40 bg-sign-red/10 p-3 text-sm text-sign-red"
        >
          <p className="font-medium">Échec de l'import</p>
          <p className="mt-1 whitespace-pre-wrap">{status.error}</p>
        </div>
      )}

      {status.log.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs font-medium uppercase tracking-widest tabular-nums text-ink-muted">
            Journal ({status.log.length})
          </h2>
          <ol className="space-y-1 rounded-md border border-border bg-paper p-3 font-mono text-xs">
            {status.log.map((line, index) => (
              <li
                key={line}
                className={
                  index === status.log.length - 1 ? 'text-sign-ochre' : 'text-ink-secondary'
                }
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
