import { describe, expect, it } from 'bun:test';
import { CATEGORY, RARITY } from '@hexamap/shared';
import {
  type CollectionCardLike,
  type CollectionFilters,
  type CollectionSearchWire,
  collectionCardMatches,
  EMPTY_COLLECTION_FILTERS,
  filterCollectionCards,
  isDepartementCode,
  normalizeSearchText,
  parseCollectionSearch,
  parseCollectionWire,
  serializeCollectionSearch,
} from '../../../apps/web/src/lib/collection-search';
import { parseSearch, stringifySearch } from '../../../apps/web/src/lib/search-params';

function filtersOf(overrides: Partial<CollectionFilters> = {}): CollectionFilters {
  return { ...EMPTY_COLLECTION_FILTERS, ...overrides };
}

// `CollectionSearchWire` est une interface : elle n'a pas de signature d'index, donc
// elle n'est pas directement assignable à `Record<string, unknown>`.
function toSearch(wire: CollectionSearchWire): Record<string, unknown> {
  const search: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(wire)) search[key] = value;
  return search;
}

const paris: CollectionCardLike = {
  category: 'COMMUNE',
  rarity: 'MYTHIQUE',
  refCode: '75056',
  nom: 'Paris',
};

const rueEglise: CollectionCardLike = {
  category: 'RUE',
  rarity: 'RARE',
  refCode: '11824',
  nom: "Rue de l'Église",
};

const departement75: CollectionCardLike = {
  category: 'DEPARTEMENT',
  rarity: 'EPIQUE',
  refCode: '75',
  nom: 'Paris',
};

const regionIdf: CollectionCardLike = {
  category: 'REGION',
  rarity: 'COMMUNE',
  refCode: '11',
  nom: 'Île-de-France',
};

describe('Cadastre filtres §2.1 — lecture des paramètres d’URL', () => {
  it('Cadastre filtres §2.1 — une liste est séparée par des virgules, pas répétée', () => {
    const filters = parseCollectionSearch({ categorie: 'COMMUNE,RUE' });

    expect(filters.categorie).toEqual(['COMMUNE', 'RUE']);
  });

  it('Cadastre filtres §2.1 — les jetons sont coupés, rognés et insensibles à la casse', () => {
    const filters = parseCollectionSearch({ categorie: ' rue , Commune ', rarete: 'rArE' });

    expect(filters.categorie).toEqual(['COMMUNE', 'RUE']);
    expect(filters.rarete).toEqual(['RARE']);
  });

  it('Cadastre filtres §2.1 — les doublons sont retirés', () => {
    const filters = parseCollectionSearch({ categorie: 'RUE,COMMUNE,RUE,Commune' });

    expect(filters.categorie).toEqual(['COMMUNE', 'RUE']);
  });

  it('Cadastre filtres §2.1 — le tri suit l’ordre du domaine, jamais l’alphabet', () => {
    const categorie = parseCollectionSearch({ categorie: [...CATEGORY].reverse().join(',') });
    const rarete = parseCollectionSearch({ rarete: [...RARITY].reverse().join(',') });

    expect(categorie.categorie).toEqual([...CATEGORY]);
    expect(rarete.rarete).toEqual([...RARITY]);
    expect(parseCollectionSearch({ categorie: 'RUE,REGION' }).categorie).toEqual(['REGION', 'RUE']);
  });
});

describe('Cadastre filtres §2.2 — l’inconnu s’écarte sans lever', () => {
  it('Cadastre filtres §2.2 — une valeur inconnue rend une liste vide', () => {
    expect(parseCollectionSearch({ rarete: 'ANANAS' }).rarete).toEqual([]);
    expect(parseCollectionSearch({ categorie: 'CHATEAU' }).categorie).toEqual([]);
  });

  it('Cadastre filtres §2.2 — les valeurs connues survivent à côté des inconnues', () => {
    const filters = parseCollectionSearch({ rarete: 'MYTHIQUE,ANANAS,rare' });

    expect(filters.rarete).toEqual(['RARE', 'MYTHIQUE']);
  });

  it('Cadastre filtres §2.2 — une valeur déjà tabulaire est repliée, jamais levée', () => {
    const filters = parseCollectionSearch({ rarete: ['EPIQUE', 'RARE', 'RARE'] });

    expect(filters.rarete).toEqual(['RARE', 'EPIQUE']);
    expect(parseCollectionSearch({ categorie: ['RUE', 3, null] }).categorie).toEqual(['RUE']);
  });

  it('Cadastre filtres §2.2 — les valeurs non textuelles sont ignorées', () => {
    for (const value of [42, null, undefined, { a: 1 }, true]) {
      const filters = parseCollectionSearch({ categorie: value, rarete: value, q: value });

      expect(filters).toEqual(EMPTY_COLLECTION_FILTERS);
    }
  });

  it('Cadastre filtres §2.2 — une recherche vide rend les filtres vides', () => {
    expect(parseCollectionSearch({})).toEqual(EMPTY_COLLECTION_FILTERS);
  });
});

describe('Cadastre filtres §2.3 — le département', () => {
  it('Cadastre filtres §2.3 — un code valide est retenu, en majuscules', () => {
    expect(parseCollectionSearch({ departement: '75' }).departement).toBe('75');
    expect(parseCollectionSearch({ departement: '971' }).departement).toBe('971');
    expect(parseCollectionSearch({ departement: '2a' }).departement).toBe('2A');
    expect(parseCollectionSearch({ departement: ' 75 ' }).departement).toBe('75');
  });

  it('Cadastre filtres §2.3 — un code invalide devient null', () => {
    expect(parseCollectionSearch({ departement: 'E2E-D1' }).departement).toBeNull();
    expect(parseCollectionSearch({ departement: '2' }).departement).toBeNull();
    expect(parseCollectionSearch({ departement: '75056' }).departement).toBeNull();
    expect(parseCollectionSearch({ departement: '' }).departement).toBeNull();
    expect(parseCollectionSearch({}).departement).toBeNull();
  });

  it('Cadastre filtres §2.3 — isDepartementCode juge la forme', () => {
    expect(isDepartementCode('75')).toBe(true);
    expect(isDepartementCode('2a')).toBe(true);
    expect(isDepartementCode('971')).toBe(true);
    expect(isDepartementCode('E2E-D1')).toBe(false);
    expect(isDepartementCode('75056')).toBe(false);
    expect(isDepartementCode('')).toBe(false);
  });
});

describe('Cadastre filtres §2.4 — le texte recherché', () => {
  it('Cadastre filtres §2.4 — q est rogné', () => {
    expect(parseCollectionSearch({ q: '  Église  ' }).q).toBe('Église');
    expect(parseCollectionSearch({ q: '   ' }).q).toBe('');
    expect(parseCollectionSearch({}).q).toBe('');
  });

  it('Cadastre filtres §2.4 — normalizeSearchText ignore la casse et les accents', () => {
    expect(normalizeSearchText('Église')).toBe('eglise');
    expect(normalizeSearchText('ILE-DE-FRANCE')).toBe('ile-de-france');
    expect(normalizeSearchText("Rue de l'Église")).toBe("rue de l'eglise");
  });
});

describe('Cadastre filtres §2.5 — écriture de l’URL', () => {
  it('Cadastre filtres §2.5 — une forme vide ne sérialise aucune clé', () => {
    const wire = serializeCollectionSearch(EMPTY_COLLECTION_FILTERS);

    expect(wire).toEqual({});
    expect('q' in wire).toBe(false);
    expect('rarete' in wire).toBe(false);
    expect('categorie' in wire).toBe(false);
    expect('departement' in wire).toBe(false);
  });

  it('Cadastre filtres §2.5 — les clés vides sont omises une à une', () => {
    const wire = serializeCollectionSearch(filtersOf({ categorie: ['RUE'], q: '' }));

    expect(wire).toEqual({ categorie: 'RUE' });
    expect(serializeCollectionSearch(filtersOf({ q: 'Paris' }))).toEqual({ q: 'Paris' });
    expect(serializeCollectionSearch(filtersOf({ departement: '75' }))).toEqual({
      departement: '75',
    });
  });

  it('Cadastre filtres §2.5 — la lecture et l’écriture sont inverses', () => {
    const normalised: CollectionFilters = {
      categorie: ['COMMUNE', 'RUE'],
      rarete: ['RARE', 'MYTHIQUE'],
      departement: '75',
      q: 'eglise',
    };

    expect(serializeCollectionSearch(normalised)).toEqual({
      categorie: 'COMMUNE,RUE',
      rarete: 'RARE,MYTHIQUE',
      departement: '75',
      q: 'eglise',
    });
    expect(parseCollectionSearch(toSearch(serializeCollectionSearch(normalised)))).toEqual(
      normalised,
    );
    expect(
      parseCollectionSearch(toSearch(serializeCollectionSearch(EMPTY_COLLECTION_FILTERS))),
    ).toEqual(EMPTY_COLLECTION_FILTERS);
  });
});

describe('Cadastre filtres §2.6 — la commune traverse la forme de transport', () => {
  it('Cadastre filtres §2.6 — parseCollectionSearch ignore la commune', () => {
    expect(parseCollectionSearch({ commune: '75056', q: 'Paris' })).toEqual(
      filtersOf({ q: 'Paris' }),
    );
  });

  it('Cadastre filtres §2.6 — parseCollectionWire rend la commune telle quelle', () => {
    const wire = parseCollectionWire({ categorie: 'rue', commune: '75056' });

    expect(wire).toEqual({ categorie: 'RUE', commune: '75056' });
    expect(parseCollectionWire({ commune: '  ' })).toEqual({});
    expect(parseCollectionWire({ commune: 42 })).toEqual({});
  });

  it('Cadastre filtres §2.6 — parseCollectionWire est idempotent', () => {
    const wire = parseCollectionWire({
      categorie: 'rue,REGION',
      rarete: 'ANANAS',
      departement: '2a',
      q: ' Église ',
      commune: '75056',
    });

    expect(wire).toEqual({
      categorie: 'REGION,RUE',
      departement: '2A',
      q: 'Église',
      commune: '75056',
    });
    expect(parseCollectionWire(toSearch(wire))).toEqual(wire);
  });
});

describe('Cadastre filtres §2.7 — appariement d’une carte', () => {
  it('Cadastre filtres §2.7 — un filtre vide retient tout', () => {
    expect(collectionCardMatches(paris, EMPTY_COLLECTION_FILTERS)).toBe(true);
    expect(filterCollectionCards([paris, rueEglise, regionIdf], EMPTY_COLLECTION_FILTERS)).toEqual([
      paris,
      rueEglise,
      regionIdf,
    ]);
  });

  it('Cadastre filtres §2.7 — la catégorie et la rareté s’appliquent en appartenance', () => {
    expect(collectionCardMatches(paris, filtersOf({ categorie: ['COMMUNE', 'RUE'] }))).toBe(true);
    expect(collectionCardMatches(regionIdf, filtersOf({ categorie: ['COMMUNE', 'RUE'] }))).toBe(
      false,
    );
    expect(collectionCardMatches(rueEglise, filtersOf({ rarete: ['RARE'] }))).toBe(true);
    expect(collectionCardMatches(paris, filtersOf({ rarete: ['RARE'] }))).toBe(false);
  });

  it('Cadastre filtres §2.7 — le département s’applique par le code de référence', () => {
    expect(collectionCardMatches(departement75, filtersOf({ departement: '75' }))).toBe(true);
    expect(collectionCardMatches(paris, filtersOf({ departement: '75' }))).toBe(true);
    expect(collectionCardMatches(paris, filtersOf({ departement: '971' }))).toBe(false);
    expect(collectionCardMatches(regionIdf, filtersOf({ departement: '75' }))).toBe(false);
    expect(collectionCardMatches(rueEglise, filtersOf({ departement: '75' }))).toBe(false);
    expect(collectionCardMatches(paris, filtersOf({ departement: null }))).toBe(true);
  });

  it('Cadastre filtres §2.7 — q cherche dans le nom comme dans le code, sans casse ni accent', () => {
    expect(collectionCardMatches(rueEglise, filtersOf({ q: 'eglise' }))).toBe(true);
    expect(collectionCardMatches(rueEglise, filtersOf({ q: 'ÉGLISE' }))).toBe(true);
    expect(collectionCardMatches(departement75, filtersOf({ q: '75' }))).toBe(true);
    expect(collectionCardMatches(paris, filtersOf({ q: 'rue' }))).toBe(false);
    expect(collectionCardMatches(paris, filtersOf({ q: '' }))).toBe(true);
  });

  it('Cadastre filtres §2.7 — q ne cherche pas dans l’identifiant interne d’une rue', () => {
    const rueId: CollectionCardLike = {
      category: 'RUE',
      rarity: 'RARE',
      refCode: '12345',
      nom: "Rue de l'Église",
    };
    const communeId: CollectionCardLike = {
      category: 'COMMUNE',
      rarity: 'RARE',
      refCode: '12345',
      nom: 'Village',
    };

    // Le `refCode` d’une rue est l’identifiant de `ref_odonymes`, jamais affiché : le
    // chercher retiendrait des rues au hasard. Le code INSEE d’une commune, lui, est public.
    expect(collectionCardMatches(rueId, filtersOf({ q: '12345' }))).toBe(false);
    expect(collectionCardMatches(rueId, filtersOf({ q: 'eglise' }))).toBe(true);
    expect(collectionCardMatches(communeId, filtersOf({ q: '12345' }))).toBe(true);
  });

  it('Cadastre filtres §2.7 — les quatre conditions se cumulent', () => {
    const filters = filtersOf({ categorie: ['COMMUNE'], rarete: ['MYTHIQUE'], q: 'paris' });

    expect(collectionCardMatches(paris, filters)).toBe(true);
    expect(collectionCardMatches(paris, { ...filters, departement: '75' })).toBe(true);
    expect(collectionCardMatches(paris, { ...filters, departement: '971' })).toBe(false);
    expect(collectionCardMatches(departement75, filters)).toBe(false);
  });

  it('Cadastre filtres §2.7 — le filtrage rend un tableau neuf et laisse l’entrée intacte', () => {
    const input: CollectionCardLike[] = [paris, rueEglise];
    const output = filterCollectionCards(input, filtersOf({ categorie: ['RUE'] }));

    expect(output).not.toBe(input);
    expect(input).toHaveLength(2);
    expect(output).toHaveLength(1);
    expect(output[0]).toBe(rueEglise);
  });

  it('Cadastre filtres §2.7 — les champs inconnus traversent sans être touchés', () => {
    const rows = [
      { id: 'c1', score: 3200, category: 'RUE', rarity: 'MYTHIQUE', refCode: '1', nom: 'Rue' },
    ];
    const kept = filterCollectionCards(rows, filtersOf({ rarete: ['MYTHIQUE'] }));

    expect(kept[0]?.id).toBe('c1');
    expect(kept[0]?.score).toBe(3200);
  });
});

describe('Cadastre filtres §2.8 — la forme de transport de l’URL', () => {
  it('Cadastre filtres §2.8 — la virgule est restaurée littérale dans l’adresse', () => {
    // Sans restauration, `encodeURIComponent` écrirait `COMMUNE%2CRUE`.
    expect(encodeURIComponent('COMMUNE,RUE')).toBe('COMMUNE%2CRUE');
    expect(stringifySearch({ categorie: 'COMMUNE,RUE' })).toBe('?categorie=COMMUNE,RUE');
  });

  it('Cadastre filtres §2.8 — le `?` appartient au sérialiseur, le routeur ne l’ajoute pas', () => {
    // `buildLocation` concatène `pathname + searchStr` : sans `?`, l’adresse devenait
    // `/collectioncategorie=REGION`, un chemin inconnu.
    expect(stringifySearch({ categorie: 'REGION' }).startsWith('?')).toBe(true);
    expect(stringifySearch({})).toBe('');
  });

  it('Cadastre filtres §2.8 — une valeur indéfinie ne s’écrit pas', () => {
    expect(stringifySearch({ a: undefined, b: 'x' })).toBe('?b=x');
  });

  it('Cadastre filtres §2.8 — une valeur relue est toujours une chaîne', () => {
    const parsed = parseSearch('?departement=99');

    expect(parsed).toEqual({ departement: '99' });
    expect(typeof parsed.departement).toBe('string');
  });

  it('Cadastre filtres §2.8 — une clé répétée devient une liste, une seule reste simple', () => {
    expect(parseSearch('rarete=RARE&rarete=EPIQUE')).toEqual({ rarete: ['RARE', 'EPIQUE'] });
    expect(parseSearch('rarete=RARE')).toEqual({ rarete: 'RARE' });
  });

  it('Cadastre filtres §2.8 — écrire puis relire rend l’objet de départ', () => {
    const wire = { categorie: 'COMMUNE,RUE', q: 'paris' };

    expect(parseSearch(stringifySearch(wire))).toEqual(wire);
    expect(parseSearch(stringifySearch(wire))).toEqual(
      parseSearch('?categorie=COMMUNE,RUE&q=paris'),
    );
  });
});
