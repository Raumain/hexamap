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
  running: 'border-warn/50 bg-warn/10 text-warn',
  done: 'border-ok/50 bg-ok/10 text-ok',
  failed: 'border-danger/50 bg-danger/10 text-danger',
  idle: 'border-veil bg-cabinet-sunk text-vellum/65',
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
    <section className="space-y-10">
      <header>
        <p className="salon-eyebrow">SALLE VII · LES ARCHIVES</p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-vellum md:text-5xl">
          Suivi de l'import
        </h1>
        <div className="brass-rule mt-5 w-24" />
        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-vellum/75">
          Cette page se rafraîchit automatiquement : le pipeline publie son avancement dans un
          fichier d'état partagé, relu chaque seconde par l'API.
        </p>
      </header>

      {query.isPending ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-vellum/65">
          Chargement du statut…
        </p>
      ) : query.isError ? (
        <p
          role="alert"
          className="rounded-sheet border border-danger/50 bg-danger/10 p-4 font-mono text-[11px] leading-relaxed text-danger"
        >
          {query.error instanceof Error ? query.error.message : 'Statut indisponible.'}
        </p>
      ) : (
        <StatusPanel status={query.data} />
      )}

      <p className="rounded-sheet border border-veil bg-cabinet-raised p-4 font-mono text-[10px] uppercase leading-relaxed tracking-[0.16em] text-vellum/60">
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
    <div className="space-y-5">
      <div
        aria-live="polite"
        className="space-y-6 rounded-sheet border border-veil bg-cabinet-raised p-5 md:p-6"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-display text-xl font-semibold text-vellum">{status.phaseLabel}</p>
            <p className="mt-1 font-mono text-[11px] tabular-nums text-vellum/65">
              {status.steps > 0
                ? `Étape ${status.step} / ${status.steps}`
                : 'Aucune étape en cours'}
            </p>
          </div>
          <span
            className={`rounded-[2px] border px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em] ${TONE_CLASSES[tone]}`}
          >
            {TONE_LABELS[tone]}
          </span>
        </div>

        <div>
          <div
            role="progressbar"
            aria-label="Progression de l'import"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent ?? undefined}
            className="h-1.5 w-full overflow-hidden rounded-full border border-veil bg-cabinet-sunk shadow-sunk"
          >
            <div
              className={percent === null ? 'h-full bg-brass/60' : 'h-full bg-brass'}
              style={{ width: `${percent ?? 100}%` }}
            />
          </div>
          <p className="mt-2 font-mono text-[11px] tabular-nums text-brass">
            {percent === null ? 'Progression indéterminée' : `${percent} %`}
          </p>
        </div>

        <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-sheet border border-veil bg-cabinet p-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
              Traité
            </dt>
            <dd className="mt-2 font-mono text-lg tabular-nums text-brass">
              {formatCount(status.done)}
            </dd>
          </div>
          <div className="rounded-sheet border border-veil bg-cabinet p-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
              Total
            </dt>
            <dd className="mt-2 font-mono text-lg tabular-nums text-brass">
              {status.total === null ? 'Indéterminé' : formatCount(status.total)}
            </dd>
          </div>
          <div className="rounded-sheet border border-veil bg-cabinet p-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
              Durée écoulée
            </dt>
            <dd className="mt-2 font-mono text-lg tabular-nums text-brass">
              {elapsed === null ? '—' : formatDuration(elapsed)}
            </dd>
          </div>
          <div className="rounded-sheet border border-veil bg-cabinet p-4">
            <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
              Restant estimé
            </dt>
            <dd className="mt-2 font-mono text-lg tabular-nums text-brass">
              {remaining === null ? '—' : formatDuration(remaining)}
            </dd>
          </div>
        </dl>

        {status.message !== '' && (
          <p className="text-[15px] leading-relaxed text-vellum/75">{status.message}</p>
        )}

        {status.error !== null && (
          <div
            role="alert"
            className="rounded-sheet border border-danger/50 bg-danger/10 p-4 font-mono text-[11px] leading-relaxed text-danger"
          >
            <p className="uppercase tracking-[0.16em]">Échec de l'import</p>
            <p className="mt-2 whitespace-pre-wrap">{status.error}</p>
          </div>
        )}
      </div>

      {status.log.length > 0 && (
        <div className="rounded-sheet border border-veil bg-cabinet-raised p-5">
          <h2 className="font-mono text-[10px] uppercase tracking-[0.16em] tabular-nums text-vellum/60">
            Journal ({status.log.length})
          </h2>
          <ol className="mt-3 space-y-1 border-t border-veil pt-3 font-mono text-[11px] leading-relaxed">
            {status.log.map((line, index) => (
              <li
                key={line}
                className={index === status.log.length - 1 ? 'text-brass' : 'text-vellum/65'}
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
