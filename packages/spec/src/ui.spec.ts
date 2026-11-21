import { describe, expect, it } from 'bun:test';
import {
  SCRATCH_COVERAGE_STRIDE,
  SCRATCH_MIN_ALPHA,
  SCRATCH_REVEAL_THRESHOLD,
  scratchAudioTone,
  scratchBrushRadius,
  scratchDebrisCount,
  scratchStampAlpha,
  scratchStampSpacing,
} from '@hexamap/shared';

describe('Archi §4.6 — le geste de grattage', () => {
  it('Archi §4.6 — le seuil de révélation est à 65 %', () => {
    expect(SCRATCH_REVEAL_THRESHOLD).toBe(0.65);
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

  it('Archi §4.6 — la couverture se mesure un pixel sur deux', () => {
    expect(SCRATCH_COVERAGE_STRIDE).toBe(2);
  });

  it('Archi §4.6 — le tampon creuse à plein à l’arrêt, au minimum à pleine vitesse', () => {
    expect(scratchStampAlpha(0)).toBe(1);
    expect(scratchStampAlpha(10)).toBe(0.78);
    expect(scratchStampAlpha(10)).toBe(SCRATCH_MIN_ALPHA);
  });

  it('Archi §4.6 — l’opacité du tampon décroît avec la vitesse', () => {
    let previous = scratchStampAlpha(0);

    for (let speed = 0.5; speed <= 10; speed += 0.5) {
      const current = scratchStampAlpha(speed);

      expect(current).toBeLessThanOrEqual(previous);
      previous = current;
    }

    expect(previous).toBe(0.78);
  });

  it('Archi §4.6 — un tap n’est jamais aminci par la pression', () => {
    expect(scratchStampAlpha(0, 0.5)).toBe(1);
    expect(scratchStampAlpha(0, 1)).toBe(1);
  });

  it('Archi §4.6 — un contact léger de stylet amincit le trait', () => {
    const light = scratchStampAlpha(0, 0.2);

    expect(light).toBeLessThan(1);
    expect(light).toBeGreaterThanOrEqual(0.7);
  });

  it('Archi §4.6 — l’écart des tampons suit le rayon', () => {
    expect(scratchStampSpacing(18)).toBe(5);
    expect(scratchStampSpacing(25)).toBe(6);
    expect(scratchStampSpacing(0)).toBe(1);
  });

  it('Archi §4.6 — les gravats n’apparaissent qu’au-delà d’un seuil de vitesse', () => {
    expect(scratchDebrisCount(0)).toBe(0);
    expect(scratchDebrisCount(1)).toBe(0);
    expect(scratchDebrisCount(1.2)).toBe(1);
    expect(scratchDebrisCount(9)).toBe(4);
  });

  it('Archi §4.6 — le son du grattoir monte avec la vitesse', () => {
    expect(scratchAudioTone(0)).toEqual({ frequency: 900, gain: 0.02 });
    expect(scratchAudioTone(4)).toEqual({ frequency: 3600, gain: 0.08 });
  });

  it('Archi §4.6 — une entrée non finie reste dans les bornes', () => {
    expect(scratchStampAlpha(Number.NaN)).toBe(1);
  });
});
