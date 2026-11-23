import { describe, expect, test } from 'bun:test';
import { craftGroupKey, type ExemplaireEntry, groupExemplaires } from '@hexamap/shared';

function card(overrides: Partial<ExemplaireEntry> & Pick<ExemplaireEntry, 'id'>): ExemplaireEntry {
  return {
    category: 'COMMUNE',
    refCode: '75056',
    rarity: 'RARE',
    acquiredAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('groupExemplaires — les exemplaires multiples', () => {
  test('trois exemplaires identiques forment un seul groupe de trois', () => {
    const cards = [
      card({ id: 'a', acquiredAt: '2026-01-01T00:00:00.000Z' }),
      card({ id: 'b', acquiredAt: '2026-02-01T00:00:00.000Z' }),
      card({ id: 'c', acquiredAt: '2026-03-01T00:00:00.000Z' }),
    ];

    const groups = groupExemplaires(cards);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.count).toBe(3);
    expect(groups[0]?.key).toBe(
      craftGroupKey({ category: 'COMMUNE', refCode: '75056', rarity: 'RARE' }),
    );
  });

  test('deux éditions de même référence sont deux groupes', () => {
    const rare = card({ id: 'rare', rarity: 'RARE' });
    const epique = card({ id: 'epique', rarity: 'EPIQUE' });

    const groups = groupExemplaires([rare, epique]);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.count)).toEqual([1, 1]);
    expect(groups[0]?.key).not.toBe(groups[1]?.key);
  });

  test('le représentant est le plus récent, même sans tri d’entrée', () => {
    const older = card({ id: 'older', acquiredAt: '2026-01-01T00:00:00.000Z' });
    const newest = card({ id: 'newest', acquiredAt: '2026-09-01T00:00:00.000Z' });
    const middle = card({ id: 'middle', acquiredAt: '2026-05-01T00:00:00.000Z' });

    const [group] = groupExemplaires([older, newest, middle]);

    expect(group?.representative.id).toBe('newest');
    expect(group?.count).toBe(3);
  });

  test('l’entrée n’est jamais mutée', () => {
    const cards = [
      card({ id: 'a', acquiredAt: '2026-01-01T00:00:00.000Z' }),
      card({ id: 'b', acquiredAt: '2026-02-01T00:00:00.000Z' }),
    ];
    const before = JSON.stringify(cards);
    const snapshot = structuredClone(cards);

    groupExemplaires(cards);

    expect(JSON.stringify(cards)).toBe(before);
    expect(cards).toEqual(snapshot);
    expect(cards[0]).toEqual(snapshot[0]);
    expect(cards[1]).toEqual(snapshot[1]);
  });

  test('le rang suit l’ordre de première apparition', () => {
    const first = card({ id: 'a1', refCode: '75056' });
    const second = card({ id: 'b1', refCode: '13055' });
    const firstAgain = card({ id: 'a2', refCode: '75056' });

    const groups = groupExemplaires([first, second, firstAgain]);

    expect(groups.map((group) => group.rank)).toEqual([0, 1]);
    expect(groups.map((group) => group.key)).toEqual([
      craftGroupKey({ category: first.category, refCode: first.refCode, rarity: first.rarity }),
      craftGroupKey({ category: second.category, refCode: second.refCode, rarity: second.rarity }),
    ]);
    expect(groups.map((group) => group.count)).toEqual([2, 1]);
  });

  test('même référence mais catégories différentes : deux groupes', () => {
    const commune = card({ id: 'commune', category: 'COMMUNE', refCode: '75' });
    const departement = card({ id: 'departement', category: 'DEPARTEMENT', refCode: '75' });

    const groups = groupExemplaires([commune, departement]);

    expect(groups).toHaveLength(2);
  });
});
