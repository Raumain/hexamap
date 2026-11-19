import { describe, expect, it } from 'bun:test';
import { SCRATCH_REVEAL_THRESHOLD, scratchBrushRadius } from '@hexamap/shared';

describe('Archi §4.6 — le geste de grattage', () => {
  it('Archi §4.6 — le seuil de révélation reste à 40 %', () => {
    expect(SCRATCH_REVEAL_THRESHOLD).toBe(0.4);
  });

  it('Archi §4.6 — le rayon du pinceau suit la taille de la case', () => {
    const small = scratchBrushRadius(76, 76);
    const large = scratchBrushRadius(140, 140);

    expect(small).toBe(18);
    expect(large).toBe(25);
    expect(small).toBeLessThan(large);
  });

  it('Archi §4.6 — le rayon est borné', () => {
    expect(scratchBrushRadius(10, 10)).toBe(18);
    expect(scratchBrushRadius(400, 400)).toBe(40);
  });
});
