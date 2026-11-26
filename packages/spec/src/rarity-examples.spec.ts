import { describe, expect, it } from 'bun:test';
import {
  COMMUNE_RARITY_BOUNDS,
  COMMUNE_SCORE_EXAMPLES,
  communeRarity,
  communeScore,
  RARITY,
  RUE_RARITY_BOUNDS,
  RUE_SCORE_EXAMPLES,
  rueRarity,
  rueScore,
} from '@hexamap/shared';

/**
 * Les exemples de la salle « Les Raretés » sont figés dans le domaine pour
 * qu'un changement de formule rende cette spécification rouge : la page ne peut
 * pas annoncer un barème que le serveur n'applique plus.
 */
describe('Archi §2.4 — les exemples normatifs de score d’une commune', () => {
  it('en publie cinq, dans l’ordre croissant de population', () => {
    expect(COMMUNE_SCORE_EXAMPLES.map((example) => example.population)).toEqual([
      100, 1_000, 10_000, 100_000, 1_000_000,
    ]);
  });

  it('publie exactement les scores du barème', () => {
    expect(COMMUNE_SCORE_EXAMPLES.map((example) => example.score)).toEqual([
      400, 900, 1_600, 2_500, 3_600,
    ]);
  });

  it('fait correspondre chaque exemple à communeScore', () => {
    for (const example of COMMUNE_SCORE_EXAMPLES) {
      expect(communeScore(example.population), `${example.population} habitants`).toBe(
        example.score,
      );
    }
  });

  it('produit un score strictement croissant', () => {
    for (let index = 1; index < COMMUNE_SCORE_EXAMPLES.length; index += 1) {
      const previous = COMMUNE_SCORE_EXAMPLES[index - 1];
      const current = COMMUNE_SCORE_EXAMPLES[index];
      if (!previous || !current) throw new Error('exemple manquant');
      expect(current.score).toBeGreaterThan(previous.score);
    }
  });
});

describe('Archi §2.4 — les exemples normatifs de score d’une rue', () => {
  it('en publie cinq, dans l’ordre décroissant de nombre de communes', () => {
    expect(RUE_SCORE_EXAMPLES.map((example) => example.nbCommunes)).toEqual([
      10_000, 1_000, 100, 10, 1,
    ]);
  });

  it('publie exactement les scores du barème', () => {
    expect(RUE_SCORE_EXAMPLES.map((example) => example.score)).toEqual([
      600, 750, 1_000, 1_500, 3_000,
    ]);
  });

  it('fait correspondre chaque exemple à rueScore', () => {
    for (const example of RUE_SCORE_EXAMPLES) {
      expect(rueScore(example.nbCommunes), `${example.nbCommunes} communes`).toBe(example.score);
    }
  });

  it('retrouve le score maximal d’une rue présente dans une seule commune', () => {
    expect(RUE_SCORE_EXAMPLES.find((example) => example.nbCommunes === 1)?.score).toBe(3_000);
  });
});

describe('Archi §2.2 — les bornes de rareté d’une commune', () => {
  it('couvre les six paliers dans l’ordre du barème', () => {
    expect(COMMUNE_RARITY_BOUNDS.map((band) => band.rarity)).toEqual([...RARITY]);
  });

  it('nomme le palier rendu par communeRarity à chaque borne', () => {
    for (const band of COMMUNE_RARITY_BOUNDS) {
      if (band.min !== null) {
        expect(communeRarity(band.min), `plancher ${band.rarity}`).toBe(band.rarity);
      }
      if (band.max !== null) {
        expect(communeRarity(band.max), `plafond ${band.rarity}`).toBe(band.rarity);
        expect(communeRarity(band.max + 1), `au-delà de ${band.rarity}`).not.toBe(band.rarity);
      } else if (band.min !== null) {
        expect(communeRarity(band.min - 1), `sous ${band.rarity}`).not.toBe(band.rarity);
      }
    }
  });
});

describe('Archi §2.2 — les bornes de rareté d’une rue', () => {
  it('couvre les six paliers dans l’ordre du barème', () => {
    expect(RUE_RARITY_BOUNDS.map((band) => band.rarity)).toEqual([...RARITY]);
  });

  it('nomme le palier rendu par rueRarity à chaque borne', () => {
    for (const band of RUE_RARITY_BOUNDS) {
      if (band.min !== null) {
        expect(rueRarity(band.min), `plancher ${band.rarity}`).toBe(band.rarity);
      }
      if (band.max !== null) {
        expect(rueRarity(band.max), `plafond ${band.rarity}`).toBe(band.rarity);
        expect(rueRarity(band.max + 1), `au-delà de ${band.rarity}`).not.toBe(band.rarity);
      } else if (band.min !== null) {
        expect(rueRarity(band.min - 1), `sous ${band.rarity}`).not.toBe(band.rarity);
      }
    }
  });

  it('donne le palier mythique à une rue présente dans une seule commune', () => {
    const mythique = RUE_RARITY_BOUNDS.find((band) => band.rarity === 'MYTHIQUE');
    expect(mythique).toEqual({ rarity: 'MYTHIQUE', min: 1, max: 1 });
  });
});
