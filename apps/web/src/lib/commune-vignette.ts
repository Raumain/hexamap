/**
 * La vue communale : une silhouette de village dessinée de façon déterministe
 * à partir du code INSEE. Deux communes ne produisent jamais la même vue
 * (DESIGN_SYSTEM.md §7.2).
 *
 * Aucun état, aucun aléatoire non seedé, aucun accès réseau : le rendu est une
 * fonction pure du code.
 */

export interface CommuneVignette {
  /** Deux crêtes successives, fermées sur la ligne de sol. */
  ridges: string;
  /** Toits et murs du village. */
  roofline: string;
  /** Clocher : position et hauteur. */
  steeple: { x: number; height: number; width: number };
  /** Astre : disque ou croissant. */
  orb: { cx: number; cy: number; r: number };
  /** Orientation de la lumière (0–1). */
  light: number;
}

const WIDTH = 100;
const HEIGHT = 66;
const GROUND = 54;

function hashCode(code: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < code.length; index += 1) {
    hash ^= code.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function ridge(rand: () => number, base: number, amplitude: number): string {
  const steps = 5;
  const step = WIDTH / steps;
  let path = `M0 ${GROUND} L0 ${base.toFixed(1)}`;
  for (let index = 0; index < steps; index += 1) {
    const startX = index * step;
    const peakX = startX + step * (0.35 + rand() * 0.3);
    const peakY = base - amplitude * (0.4 + rand() * 0.6);
    const endY = base - amplitude * rand() * 0.25;
    path += ` Q ${peakX.toFixed(1)} ${peakY.toFixed(1)} ${(startX + step).toFixed(1)} ${endY.toFixed(1)}`;
  }
  return `${path} L${WIDTH} ${GROUND} Z`;
}

function village(rand: () => number): string {
  let path = '';
  let x = 4 + rand() * 4;
  while (x < WIDTH - 8) {
    const width = 6 + rand() * 6;
    const height = 5 + rand() * 9;
    const top = GROUND - height;
    const roof = width * (0.42 + rand() * 0.22);
    if (rand() > 0.34) {
      path += `M${x.toFixed(1)} ${GROUND} L${x.toFixed(1)} ${top.toFixed(1)} L${(
        x + width / 2
      ).toFixed(1)} ${(top - roof).toFixed(1)} L${(x + width).toFixed(1)} ${top.toFixed(
        1,
      )} L${(x + width).toFixed(1)} ${GROUND} Z `;
    } else {
      path += `M${x.toFixed(1)} ${GROUND} L${x.toFixed(1)} ${top.toFixed(1)} L${(x + width).toFixed(
        1,
      )} ${top.toFixed(1)} L${(x + width).toFixed(1)} ${GROUND} Z `;
    }
    x += width + 0.8 + rand() * 2.4;
  }
  return path.trim();
}

export function communeVignette(codeInsee: string): CommuneVignette {
  const rand = mulberry32(hashCode(codeInsee));

  const orbX = 12 + rand() * 70;
  const orbY = 10 + rand() * 14;
  const light = rand();

  return {
    ridges: `${ridge(rand, 38 + rand() * 6, 8 + rand() * 6)} ${ridge(rand, 46, 5 + rand() * 5)}`,
    roofline: village(rand),
    steeple: {
      x: 14 + rand() * 66,
      height: 18 + rand() * 12,
      width: 4 + rand() * 2,
    },
    orb: {
      cx: orbX,
      cy: orbY,
      r: 3.4 + rand() * 2.6,
    },
    light,
  };
}

export const COMMUNE_VIGNETTE_BOX = { width: WIDTH, height: HEIGHT, ground: GROUND };
