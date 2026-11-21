import { describe, expect, it } from 'bun:test';
import {
  evaluateTableau,
  evaluateTableauAlignment,
  hasConstrainingSelection,
  rankCardsByCompatibility,
  rueExistsInCommune,
  slotMatchesCategory,
  TABLEAU_CANDIDATE_LINKS,
  TABLEAU_LINK_KEYS,
  TABLEAU_LINK_SLOTS,
  type TableauGeography,
  type TableauSlot,
} from '@hexamap/shared';

function geography(overrides: Partial<TableauGeography> = {}): TableauGeography {
  return {
    regionCode: '84',
    departementCode: '69',
    departementRegionCode: '84',
    communeInsee: '69123',
    communeDepartementCode: '69',
    rueOdonymeId: '42',
    rueInCommune: true,
    ...overrides,
  };
}

describe('GDD §3.C — un slot accepte la catégorie homonyme', () => {
  it('REGION ⇔ REGION', () => {
    expect(slotMatchesCategory('REGION', 'REGION')).toBe(true);
  });

  it('DEPARTEMENT ⇔ DEPARTEMENT', () => {
    expect(slotMatchesCategory('DEPARTEMENT', 'DEPARTEMENT')).toBe(true);
  });

  it('COMMUNE ⇔ COMMUNE', () => {
    expect(slotMatchesCategory('COMMUNE', 'COMMUNE')).toBe(true);
  });

  it('RUE ⇔ RUE', () => {
    expect(slotMatchesCategory('RUE', 'RUE')).toBe(true);
  });

  it('rejette les catégories croisées', () => {
    expect(slotMatchesCategory('REGION', 'DEPARTEMENT')).toBe(false);
    expect(slotMatchesCategory('DEPARTEMENT', 'COMMUNE')).toBe(false);
    expect(slotMatchesCategory('COMMUNE', 'RUE')).toBe(false);
    expect(slotMatchesCategory('RUE', 'REGION')).toBe(false);
  });
});

describe('GDD §3.C / Architecture §2.5 — multiplicateur selon le nombre de liens', () => {
  it('0 lien → ×1,0', () => {
    const alignment = evaluateTableauAlignment(
      geography({
        departementRegionCode: '11',
        communeDepartementCode: '13',
        rueInCommune: false,
      }),
    );
    expect(alignment.links).toBe(0);
    expect(alignment.multiplier).toBe(1.0);
  });

  it('1 lien → ×1,5', () => {
    const alignment = evaluateTableauAlignment(
      geography({ communeDepartementCode: '13', rueInCommune: false }),
    );
    expect(alignment.links).toBe(1);
    expect(alignment.multiplier).toBe(1.5);
  });

  it('2 liens → ×2,5', () => {
    const alignment = evaluateTableauAlignment(geography({ rueInCommune: false }));
    expect(alignment.links).toBe(2);
    expect(alignment.multiplier).toBe(2.5);
  });

  it('3 liens (combo complet) → ×5,0', () => {
    const alignment = evaluateTableauAlignment(geography());
    expect(alignment.links).toBe(3);
    expect(alignment.multiplier).toBe(5.0);
  });

  it('breakdown de 3 entrées avec les bons valid', () => {
    const alignment = evaluateTableauAlignment(geography());
    expect(alignment.breakdown).toHaveLength(3);
    expect(alignment.breakdown.map((link) => link.key)).toEqual([...TABLEAU_LINK_KEYS]);
    expect(alignment.breakdown.map((link) => link.valid)).toEqual([true, true, true]);
  });
});

describe('GDD §3.C — sélection partielle : jamais de faux positif', () => {
  it('région absente → lien région-département invalide', () => {
    const alignment = evaluateTableauAlignment(geography({ regionCode: null }));
    expect(alignment.breakdown[0]?.valid).toBe(false);
    expect(alignment.links).toBe(2);
  });

  it('département absent → lien département-commune invalide', () => {
    const alignment = evaluateTableauAlignment(
      geography({ departementCode: null, departementRegionCode: null }),
    );
    expect(alignment.breakdown[1]?.valid).toBe(false);
    expect(alignment.breakdown[0]?.valid).toBe(false);
  });

  it('commune absente → lien commune-rue invalide', () => {
    const alignment = evaluateTableauAlignment(
      geography({ communeInsee: null, communeDepartementCode: null }),
    );
    expect(alignment.breakdown[1]?.valid).toBe(false);
    expect(alignment.breakdown[2]?.valid).toBe(false);
  });

  it('rue absente → lien commune-rue invalide', () => {
    const alignment = evaluateTableauAlignment(geography({ rueOdonymeId: null }));
    expect(alignment.breakdown[2]?.valid).toBe(false);
    expect(alignment.links).toBe(2);
  });

  it('champs de référence manquants → lien invalide, jamais de crash', () => {
    const alignment = evaluateTableauAlignment({
      regionCode: null,
      departementCode: null,
      departementRegionCode: null,
      communeInsee: null,
      communeDepartementCode: null,
      rueOdonymeId: null,
      rueInCommune: false,
    });
    expect(alignment.links).toBe(0);
    expect(alignment.multiplier).toBe(1.0);
  });
});

describe('GDD §3.C — la rue existe dans la commune', () => {
  const rows = [{ codeInsee: '69123', odonymeId: '42' }];

  it('ligne présente → true', () => {
    expect(rueExistsInCommune(rows, '69123', '42')).toBe(true);
  });

  it('mauvaise commune → false', () => {
    expect(rueExistsInCommune(rows, '75056', '42')).toBe(false);
  });

  it('mauvais odonyme → false', () => {
    expect(rueExistsInCommune(rows, '69123', '99')).toBe(false);
  });

  it('commune null → false', () => {
    expect(rueExistsInCommune(rows, null, '42')).toBe(false);
  });

  it('odonyme null → false', () => {
    expect(rueExistsInCommune(rows, '69123', null)).toBe(false);
  });
});

describe('GDD §3.C — score total d’un tableau', () => {
  const scores = { region: 200, departement: 400, commune: 900, rue: 1_000 };

  it('3 liens → 12 500 points (parité avec le GDD)', () => {
    const evaluation = evaluateTableau(scores, geography());
    expect(evaluation.alignment.links).toBe(3);
    expect(evaluation.total).toBe(12_500);
  });

  it('réutilise tableauScore pour les autres multiplicateurs', () => {
    expect(evaluateTableau(scores, geography({ rueInCommune: false })).total).toBe(6_250);
    expect(
      evaluateTableau(scores, geography({ communeDepartementCode: '13', rueInCommune: false }))
        .total,
    ).toBe(3_750);
    expect(
      evaluateTableau(
        scores,
        geography({
          departementRegionCode: '11',
          communeDepartementCode: '13',
          rueInCommune: false,
        }),
      ).total,
    ).toBe(2_500);
  });
});

describe('Archi §2.5 — liens qu’une carte candidate peut valider', () => {
  it('chaque emplacement ne considère que ses liens adjacents', () => {
    expect(TABLEAU_CANDIDATE_LINKS).toEqual({
      REGION: ['region-departement'],
      DEPARTEMENT: ['region-departement', 'departement-commune'],
      COMMUNE: ['departement-commune', 'commune-rue'],
      RUE: ['commune-rue'],
    });
  });

  it('chaque lien relie deux emplacements distincts et connus', () => {
    expect(TABLEAU_LINK_SLOTS).toEqual({
      'region-departement': ['REGION', 'DEPARTEMENT'],
      'departement-commune': ['DEPARTEMENT', 'COMMUNE'],
      'commune-rue': ['COMMUNE', 'RUE'],
    });
  });
});

describe('Archi §2.5 — un tri par compatibilité n’a de sens qu’avec une extrémité choisie', () => {
  function filled(...slots: TableauSlot[]): Set<TableauSlot> {
    return new Set(slots);
  }

  it('REGION seule remplie ne contraint pas REGION elle-même', () => {
    expect(hasConstrainingSelection('REGION', filled('REGION'))).toBe(false);
  });

  it('REGION + DEPARTEMENT contraignent les deux extrémités', () => {
    expect(hasConstrainingSelection('DEPARTEMENT', filled('REGION', 'DEPARTEMENT'))).toBe(true);
    expect(hasConstrainingSelection('REGION', filled('REGION', 'DEPARTEMENT'))).toBe(true);
  });

  it('COMMUNE seule remplie ne contraint pas COMMUNE elle-même', () => {
    expect(hasConstrainingSelection('COMMUNE', filled('COMMUNE'))).toBe(false);
  });

  it('COMMUNE + RUE contraignent les deux extrémités', () => {
    expect(hasConstrainingSelection('COMMUNE', filled('COMMUNE', 'RUE'))).toBe(true);
    expect(hasConstrainingSelection('RUE', filled('COMMUNE', 'RUE'))).toBe(true);
  });

  it('REGION seule ne contraint ni RUE ni COMMUNE (aucun lien direct)', () => {
    expect(hasConstrainingSelection('RUE', filled('REGION'))).toBe(false);
    expect(hasConstrainingSelection('COMMUNE', filled('REGION'))).toBe(false);
  });
});

describe('Archi §2.5 — compatibles d’abord, ordre d’origine conservé', () => {
  const cards = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('ensemble vide → ordre inchangé', () => {
    expect(rankCardsByCompatibility(cards, new Set()).map((card) => card.id)).toEqual([
      'a',
      'b',
      'c',
      'd',
    ]);
  });

  it('sous-ensemble → compatibles en tête, le reste ensuite', () => {
    expect(rankCardsByCompatibility(cards, new Set(['c', 'a'])).map((card) => card.id)).toEqual([
      'a',
      'c',
      'b',
      'd',
    ]);
  });

  it('tout compatible → ordre inchangé', () => {
    expect(
      rankCardsByCompatibility(cards, new Set(['a', 'b', 'c', 'd'])).map((card) => card.id),
    ).toEqual(['a', 'b', 'c', 'd']);
  });

  it('ne mute jamais l’entrée', () => {
    const input = [...cards];
    rankCardsByCompatibility(input, new Set(['d', 'b']));
    expect(input.map((card) => card.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});
