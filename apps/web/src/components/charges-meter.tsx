import { CHARGES, chargesLabel } from '../content/tickets';

interface ChargesMeterProps {
  /** Solde déjà dérivé par `useChargeCountdown`, jamais la valeur brute du serveur. */
  charges: number;
  cap: number;
  nextChargeAt: string | null;
}

function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1_000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Présentation pure du carnet : aucune horloge ici. Le parent rend à chaque tic
 * du hook, donc le compte à rebours est recalculé à l'affichage.
 */
export function ChargesMeter({ charges, cap, nextChargeAt }: ChargesMeterProps) {
  const countdown =
    nextChargeAt === null ? null : formatCountdown(new Date(nextChargeAt).getTime() - Date.now());
  // Les points sont numérotés une fois pour toutes : leur identité est le rang, jamais l'ordre d'un rendu.
  const slots = Array.from({ length: cap }, (_, slot) => slot + 1);

  return (
    <div className="space-y-2">
      <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-vellum/60">
        {CHARGES.title}
      </p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex min-w-0 flex-wrap items-center gap-1.5" aria-hidden="true">
          {slots.map((slot) => (
            <span
              key={slot}
              className={`h-2.5 w-2.5 rounded-full ${
                slot <= charges ? 'bg-brass' : 'bg-vellum-edge'
              }`}
            />
          ))}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-vellum/75">
          {chargesLabel(charges, cap)}
        </span>
        {countdown === null ? null : (
          <span
            role="timer"
            aria-live="off"
            className="font-mono text-[11px] tabular-nums text-vellum/65"
          >
            {CHARGES.nextCharge} {countdown}
          </span>
        )}
      </div>
    </div>
  );
}
