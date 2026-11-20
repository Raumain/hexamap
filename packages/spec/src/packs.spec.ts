import { describe, expect, it } from 'bun:test';
import {
  ACHIEVEMENT_PAYOUT_TOTAL,
  ecusPerEuro,
  PACK_KEYS,
  PACKS,
  type PackKey,
  packByKey,
} from '@hexamap/shared';

describe('ROADMAP §2.B (phase 30.0) — le catalogue expose quatre packs', () => {
  it('rend exactement quatre packs', () => {
    expect(PACKS).toHaveLength(4);
  });

  it('ordonne les clés du plus petit au plus gros pack', () => {
    expect(PACK_KEYS).toEqual(['PACK_500', 'PACK_1200', 'PACK_2500', 'PACK_6000']);
  });

  it('ordonne PACKS comme PACK_KEYS', () => {
    expect(PACKS.map((pack) => pack.key)).toEqual([...PACK_KEYS]);
  });
});

describe('ROADMAP §2.B (phase 30.0) — chaque pack est une offre entière en euros', () => {
  for (const pack of PACKS) {
    it(`décrit ${pack.key} avec des montants entiers et positifs`, () => {
      expect(pack.ecus).toBeGreaterThan(0);
      expect(pack.priceCents).toBeGreaterThan(0);
      expect(Number.isInteger(pack.ecus)).toBe(true);
      expect(Number.isInteger(pack.priceCents)).toBe(true);
      expect(Number.isInteger(pack.bonusPercent)).toBe(true);
      expect(pack.bonusPercent).toBeGreaterThanOrEqual(0);
      expect(pack.currency).toBe('EUR');
    });
  }
});

describe('ROADMAP §2.B (phase 30.0) — le ratio écus par euro croît strictement', () => {
  it('rend chaque pack plus généreux que le précédent', () => {
    let previousRatio = 0;
    for (const pack of PACKS) {
      const ratio = ecusPerEuro(pack);
      expect(ratio).toBeGreaterThan(previousRatio);
      previousRatio = ratio;
    }
  });
});

describe('ROADMAP §2.B (phase 30.0) — le catalogue des médailles vaut un PACK_6000', () => {
  it('vaut 6 000 écus, comme le total des 37 primes', () => {
    expect(packByKey('PACK_6000')?.ecus).toBe(6000);
    expect(ACHIEVEMENT_PAYOUT_TOTAL).toBe(6000);
    expect(packByKey('PACK_6000')?.ecus).toBe(ACHIEVEMENT_PAYOUT_TOTAL);
  });
});

describe('ROADMAP §2.B (phase 30.0) — packByKey ne rend rien hors catalogue', () => {
  it('rend undefined pour une clé inconnue', () => {
    const unknownKey = 'PACK_9999' as unknown as PackKey;
    expect(packByKey(unknownKey)).toBeUndefined();
  });
});

describe('ROADMAP §2.B (phase 30.0) — les variables Stripe sont des noms', () => {
  it('nomme une variable unique par pack, préfixée STRIPE_PRICE_', () => {
    const names = PACKS.map((pack) => pack.stripePriceEnv);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name.startsWith('STRIPE_PRICE_')).toBe(true);
      expect(name.startsWith('price_')).toBe(false);
    }
  });
});
