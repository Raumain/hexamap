import { describe, expect, it } from 'bun:test';
import {
  alignmentMultiplier,
  communeRarity,
  communeScore,
  editionScore,
  type Rarity,
  rueRarity,
  rueScore,
  tableauScore,
} from '@hexamap/shared';

describe('GDD §3.B.1 — score d’une commune', () => {
  const cases = [
    { population: 100, expected: 400 },
    { population: 1_000, expected: 900 },
    { population: 10_000, expected: 1_600 },
    { population: 100_000, expected: 2_500 },
    { population: 1_000_000, expected: 3_600 },
  ];

  for (const { population, expected } of cases) {
    it(`${population} habitants => ${expected} points`, () => {
      expect(communeScore(population)).toBe(expected);
    });
  }

  it('plancher à 10 habitants pour éviter les villages inhabités', () => {
    expect(communeScore(0)).toBe(communeScore(10));
  });
});

describe('GDD §3.B.2 — score d’une rue', () => {
  const cases = [
    { nbCommunes: 10_000, expected: 600 },
    { nbCommunes: 1_000, expected: 750 },
    { nbCommunes: 100, expected: 1_000 },
    { nbCommunes: 10, expected: 1_500 },
    { nbCommunes: 1, expected: 3_000 },
  ];

  for (const { nbCommunes, expected } of cases) {
    it(`présente dans ${nbCommunes} communes => ${expected} points`, () => {
      expect(rueScore(nbCommunes)).toBe(expected);
    });
  }
});

describe('GDD §3.A — score des éditions Région / Département', () => {
  const cases: Array<{ rarity: Rarity; expected: number }> = [
    { rarity: 'COMMUNE', expected: 200 },
    { rarity: 'INHABITUELLE', expected: 400 },
    { rarity: 'RARE', expected: 750 },
    { rarity: 'EPIQUE', expected: 1_250 },
    { rarity: 'LEGENDAIRE', expected: 2_000 },
    { rarity: 'MYTHIQUE', expected: 3_500 },
  ];

  for (const { rarity, expected } of cases) {
    it(`${rarity} => ${expected} points`, () => {
      expect(editionScore(rarity)).toBe(expected);
    });
  }
});

describe('GDD §3.A — paliers de rareté des communes', () => {
  const cases: Array<{ population: number; expected: Rarity }> = [
    { population: 500, expected: 'COMMUNE' },
    { population: 1_500, expected: 'INHABITUELLE' },
    { population: 10_000, expected: 'RARE' },
    { population: 50_000, expected: 'EPIQUE' },
    { population: 150_000, expected: 'LEGENDAIRE' },
    { population: 300_000, expected: 'MYTHIQUE' },
  ];

  for (const { population, expected } of cases) {
    it(`${population} habitants => ${expected}`, () => {
      expect(communeRarity(population)).toBe(expected);
    });
  }

  it('respecte les bornes exactes des paliers', () => {
    expect(communeRarity(1_000)).toBe('INHABITUELLE');
    expect(communeRarity(5_000)).toBe('RARE');
    expect(communeRarity(20_000)).toBe('EPIQUE');
    expect(communeRarity(100_000)).toBe('LEGENDAIRE');
    expect(communeRarity(250_000)).toBe('MYTHIQUE');
  });
});

describe('GDD §3.A — paliers de rareté des rues', () => {
  const cases: Array<{ nbCommunes: number; expected: Rarity }> = [
    { nbCommunes: 501, expected: 'COMMUNE' },
    { nbCommunes: 500, expected: 'INHABITUELLE' },
    { nbCommunes: 100, expected: 'INHABITUELLE' },
    { nbCommunes: 99, expected: 'RARE' },
    { nbCommunes: 20, expected: 'RARE' },
    { nbCommunes: 19, expected: 'EPIQUE' },
    { nbCommunes: 5, expected: 'EPIQUE' },
    { nbCommunes: 4, expected: 'LEGENDAIRE' },
    { nbCommunes: 2, expected: 'LEGENDAIRE' },
    { nbCommunes: 1, expected: 'MYTHIQUE' },
  ];

  for (const { nbCommunes, expected } of cases) {
    it(`présente dans ${nbCommunes} communes => ${expected}`, () => {
      expect(rueRarity(nbCommunes)).toBe(expected);
    });
  }
});

describe('GDD §3.C — multiplicateur d’alignement', () => {
  it('aucun lien => ×1,0', () => {
    expect(alignmentMultiplier(0)).toBe(1.0);
  });

  it('1 lien => ×1,5', () => {
    expect(alignmentMultiplier(1)).toBe(1.5);
  });

  it('2 liens => ×2,5', () => {
    expect(alignmentMultiplier(2)).toBe(2.5);
  });

  it('3 liens (combo complet) => ×5,0', () => {
    expect(alignmentMultiplier(3)).toBe(5.0);
  });
});

describe('GDD §3.C — score total d’un tableau', () => {
  const scores = { region: 200, departement: 400, commune: 900, rue: 1_000 };

  it('additionne les quatre cartes puis applique le multiplicateur', () => {
    expect(tableauScore(scores, 0)).toBe(2_500);
    expect(tableauScore(scores, 1)).toBe(3_750);
    expect(tableauScore(scores, 2)).toBe(6_250);
    expect(tableauScore(scores, 3)).toBe(12_500);
  });
});
