/**
 * Utilitaires de tirage aléatoire purs et injectables (déterministes via seed).
 * Aucune dépendance : utilisables dans les services et les specs.
 */

export type Rng = () => number;

/**
 * PRNG mulberry32, déterministe pour un seed donné. Retourne un flottant dans [0, 1).
 */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Index uniforme dans [0, length[. */
export function pickIndex(length: number, rng: Rng = Math.random): number {
  return Math.floor(rng() * length);
}

/** Tirage pondéré parmi une liste `{ value, weight }`. Les poids doivent être > 0. */
export function pickWeighted<T>(
  items: ReadonlyArray<{ value: T; weight: number }>,
  rng: Rng = Math.random,
): T {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  if (total <= 0) {
    throw new Error('pickWeighted: total weight must be positive');
  }
  let roll = rng() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll < 0) {
      return item.value;
    }
  }
  // Garde-fou pour l'imprécision flottante (roll ≈ total).
  const last = items[items.length - 1];
  if (!last) {
    throw new Error('pickWeighted: empty items');
  }
  return last.value;
}

/** Mélange de Fisher–Yates, sans muter l'entrée. */
export function shuffle<T>(items: readonly T[], rng: Rng = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const current = result[i];
    const other = result[j];
    if (current === undefined || other === undefined) {
      continue;
    }
    result[i] = other;
    result[j] = current;
  }
  return result;
}
