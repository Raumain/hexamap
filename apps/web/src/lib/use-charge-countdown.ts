import { chargesAt } from '@hexamap/shared';
import { useEffect, useState } from 'react';

export interface ChargeCountdown {
  charges: number;
  nextChargeAt: string | null;
}

/**
 * Le décompte local du carnet, unique propriétaire du tic.
 *
 * Les valeurs du serveur restent la source : chaque tic les dérive avec
 * `chargesAt`, aucun solde n'est recopié dans un état qui dériverait.
 */
export function useChargeCountdown(
  charges: number,
  nextChargeAt: string | null,
  cap: number,
  regenMs: number,
): ChargeCountdown {
  const [now, setNow] = useState(() => Date.now());
  const nextAt = nextChargeAt === null ? null : new Date(nextChargeAt).getTime();
  const local = chargesAt(charges, nextAt, { cap, regenMs }, now);

  // Un seul intervalle pour toute la salle. Il se recale sur chaque réponse du
  // serveur (montage, mutation) et s'arrête dès que le carnet dérivé est plein :
  // le serveur ne l'apprendra qu'à la prochaine lecture, donc c'est le solde
  // dérivé qui porte la décision, jamais la valeur brute.
  useEffect(() => {
    setNow(Date.now());
    if (nextAt === null || local.charges >= cap) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [nextAt, local.charges, cap]);

  return {
    charges: local.charges,
    nextChargeAt: local.nextChargeAt === null ? null : new Date(local.nextChargeAt).toISOString(),
  };
}
