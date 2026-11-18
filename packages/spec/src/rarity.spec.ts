import { describe, expect, it } from 'bun:test';
import { RARITY, RARITY_ACCENT_HEX, RARITY_LABELS, RARITY_WEIGHTS } from '@hexamap/shared';

describe('GDD §3.A — les libellés couvrent exactement les six paliers', () => {
  it('expose une entrée par palier de rareté', () => {
    expect(Object.keys(RARITY_LABELS).sort()).toEqual([...RARITY].sort());
  });
});

describe('GDD §3.A — chaque palier possède un accent', () => {
  it('expose une entrée par palier de rareté', () => {
    expect(Object.keys(RARITY_ACCENT_HEX).sort()).toEqual([...RARITY].sort());
  });

  it('utilise des couleurs hexadécimales à six chiffres', () => {
    for (const rarity of RARITY) {
      expect(RARITY_ACCENT_HEX[rarity]).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
});

describe('GDD §3.A — les libellés français sont exacts', () => {
  const cases = [
    ['COMMUNE', 'Commune'],
    ['INHABITUELLE', 'Peu commune'],
    ['RARE', 'Rare'],
    ['EPIQUE', 'Épique'],
    ['LEGENDAIRE', 'Légendaire'],
    ['MYTHIQUE', 'Mythique'],
  ] as const;

  for (const [rarity, label] of cases) {
    it(`${rarity} => ${label}`, () => {
      expect(RARITY_LABELS[rarity]).toBe(label);
    });
  }
});

describe('GDD §3.A — les poids de rareté somment à 100', () => {
  it('répartit les six paliers sur un total de 100', () => {
    expect(RARITY.reduce((sum, rarity) => sum + RARITY_WEIGHTS[rarity], 0)).toBeCloseTo(100, 3);
  });
});
