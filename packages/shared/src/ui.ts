/**
 * Shared UI constants — values the scratch cell must not re-declare locally.
 * They are pure numbers, so they live here rather than in either app.
 */

/**
 * Fraction de pixels effacés qui révèle une case grattée.
 * Le seuil est passé de 40 % à 65 % : à 40 %, le geste était déjà fini avant
 * que le joueur ait eu le temps d'y prendre plaisir. Il ne descend plus.
 */
export const SCRATCH_REVEAL_THRESHOLD = 0.65;

const BRUSH_RATIO = 0.18;
const BRUSH_MIN_RADIUS = 18;
const BRUSH_MAX_RADIUS = 40;

/**
 * Eraser radius, in CSS pixels, for a scratch cell of the given CSS size.
 * The radius follows the smaller side so a cell keeps the same feel at any size.
 */
export function scratchBrushRadius(cssWidth: number, cssHeight: number): number {
  const smaller = Math.min(cssWidth, cssHeight);
  if (!Number.isFinite(smaller) || smaller <= 0) return BRUSH_MIN_RADIUS;
  const radius = smaller * BRUSH_RATIO;
  return Math.round(Math.min(BRUSH_MAX_RADIUS, Math.max(BRUSH_MIN_RADIUS, radius)));
}

function clamp(min: number, max: number, value: number): number {
  return Math.min(max, Math.max(min, value));
}

function clamp01(value: number): number {
  return clamp(0, 1, value);
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Pas de lecture des pixels pour mesurer la couverture : un pixel sur deux
 * suffit à décider d'une révélation et divise le coût par quatre.
 */
export const SCRATCH_COVERAGE_STRIDE = 2;

/**
 * Un seul trait ne creuse jamais à fond : deux passes effacent, une seule
 * voile la carte. Sans ce plancher, un geste rapide vaudrait un grattage.
 */
export const SCRATCH_MIN_ALPHA = 0.78;

/** Vitesse (px/ms) en dessous de laquelle le trait creuse à plein. */
export const SCRATCH_SLOW_SPEED = 0.35;

/** Vitesse (px/ms) à partir de laquelle le trait est au plus mince. */
export const SCRATCH_FAST_SPEED = 4;

/**
 * Opacité d'un tampon de grattoir selon la vitesse du geste.
 * La main rapide n'arrache qu'une pellicule, la main lente creuse : c'est ce
 * qui distingue un grattage d'un effleurement. Un appui immobile et un doigt
 * restent pleinement opaques — sinon un tap ne révélerait rien.
 */
export function scratchStampAlpha(speed: number, pressure = 0.5): number {
  const s = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const t = clamp01((s - SCRATCH_SLOW_SPEED) / (SCRATCH_FAST_SPEED - SCRATCH_SLOW_SPEED));
  const speedAlpha = 1 - t * (1 - SCRATCH_MIN_ALPHA);
  const p = Number.isFinite(pressure) ? clamp01(pressure) : 0.5;
  const pressureAlpha = p < 0.5 ? 0.8 + 0.2 * p : 1;
  return round3(clamp(0.7, 1, speedAlpha * pressureAlpha));
}

/**
 * Écart entre deux tampons, proportionnel au rayon : un pinceau large doit
 * déposer plus de tampons pour laisser un trait continu, sans quoi la ligne
 * devient un chapelet de points.
 */
export function scratchStampSpacing(radius: number): number {
  return Math.max(1, Math.round(Math.max(0, radius) * 0.25));
}

/**
 * Nombre de gravats projetés par un tampon : rien à faible vitesse, quelques
 * éclats quand la main s'emballe. Purement décoratif, donc borné à quatre.
 */
export function scratchDebrisCount(speed: number): number {
  const s = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  return s < 1.2 ? 0 : Math.min(4, Math.floor((s - 1.2) / 0.7) + 1);
}

/**
 * Hauteur et force du son de grattoir : plus la main va vite, plus le trait
 * monte et s'entend. Le gain reste faible pour ne jamais couvrir le reste.
 */
export function scratchAudioTone(speed: number): { frequency: number; gain: number } {
  const s = Number.isFinite(speed) ? Math.max(0, speed) : 0;
  const t = clamp01(s / 4);
  return { frequency: Math.round(900 + t * 2700), gain: round3(0.02 + t * 0.06) };
}
