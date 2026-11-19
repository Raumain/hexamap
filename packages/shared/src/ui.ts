/**
 * Shared UI constants — values the scratch cell must not re-declare locally.
 * They are pure numbers, so they live here rather than in either app.
 */

/** Fraction of erased pixels that reveals a scratched cell. */
export const SCRATCH_REVEAL_THRESHOLD = 0.4;

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
