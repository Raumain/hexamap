import { describe, expect, it } from 'bun:test';
import { RARITY_LABELS } from '@hexamap/shared';
import {
  EMPTY_PICKER_FILTERS,
  filterPickableCards,
  matchesPickerFilters,
  normalizePickerText,
  type PickableCardLike,
  type PickerFilters,
  pickableCardLabel,
} from '../../../apps/web/src/lib/card-picker';

// I-001 — le formulaire de vente choisit sa carte dans un tiroir de planches.
// Le module pur porte les trois filtres et le libellé d'une ligne : il est
// verrouillé ici, sans React ni requête.

const scoreFormatter = new Intl.NumberFormat('fr-FR');

function filtersOf(overrides: Partial<PickerFilters> = {}): PickerFilters {
  return { ...EMPTY_PICKER_FILTERS, ...overrides };
}

const commune: PickableCardLike = {
  id: 'card-commune',
  category: 'COMMUNE',
  rarity: 'RARE',
  refCode: '42218',
  nom: 'Saint-Étienne',
  score: 1600,
};

const rue: PickableCardLike = {
  id: 'card-rue',
  category: 'RUE',
  rarity: 'INHABITUELLE',
  refCode: '11824',
  nom: "Rue de l'Église",
  score: 750,
};

const region: PickableCardLike = {
  id: 'card-region',
  category: 'REGION',
  rarity: 'MYTHIQUE',
  refCode: '84',
  nom: 'Auvergne-Rhône-Alpes',
  score: 3500,
};

const cards: readonly PickableCardLike[] = [region, commune, rue];

function ids(listed: readonly PickableCardLike[]): string[] {
  return listed.map((card) => card.id);
}

describe('card-picker — normalisation du texte', () => {
  it('ignore la casse, les accents et les espaces superflus', () => {
    expect(normalizePickerText('  Saint-Étienne   DU   Rouvray ')).toBe('saint-etienne du rouvray');
  });

  it('normalise une chaîne vide en chaîne vide', () => {
    expect(normalizePickerText('   ')).toBe('');
  });
});

describe('card-picker — filtres', () => {
  it('filtre par catégorie, en conservant l’ordre de la collection', () => {
    expect(ids(filterPickableCards(cards, filtersOf({ categories: ['COMMUNE', 'RUE'] })))).toEqual([
      'card-commune',
      'card-rue',
    ]);
  });

  it('filtre par rareté', () => {
    expect(ids(filterPickableCards(cards, filtersOf({ rarities: ['MYTHIQUE'] })))).toEqual([
      'card-region',
    ]);
  });

  it('cherche par nom sans accent ni casse', () => {
    expect(ids(filterPickableCards(cards, filtersOf({ query: 'SAINT-ETIENNE' })))).toEqual([
      'card-commune',
    ]);
  });

  it('cherche par code de référence', () => {
    expect(ids(filterPickableCards(cards, filtersOf({ query: '42218' })))).toEqual([
      'card-commune',
    ]);
  });

  it('cherche aussi le code d’une rue, qui reste un filtre de texte', () => {
    expect(ids(filterPickableCards(cards, filtersOf({ query: '11824' })))).toEqual(['card-rue']);
  });

  it('combine catégorie, rareté et texte', () => {
    const combined = filtersOf({
      categories: ['COMMUNE', 'RUE'],
      rarities: ['INHABITUELLE'],
      query: 'eglise',
    });
    expect(ids(filterPickableCards(cards, combined))).toEqual(['card-rue']);
  });

  it('ne retient rien quand la combinaison ne s’accorde pas', () => {
    const combined = filtersOf({ categories: ['REGION'], rarities: ['RARE'] });
    expect(filterPickableCards(cards, combined)).toEqual([]);
  });

  it('rend toute la collection sur des filtres vides ou un texte blanc', () => {
    expect(ids(filterPickableCards(cards, EMPTY_PICKER_FILTERS))).toEqual(ids(cards));
    expect(ids(filterPickableCards(cards, filtersOf({ query: '   ' })))).toEqual(ids(cards));
  });

  it('ne mute jamais l’entrée ni ses cartes', () => {
    const source = [region, commune, rue];
    const snapshot = source.slice();

    filterPickableCards(source, filtersOf({ categories: ['RUE'], query: 'inconnu' }));

    expect(source).toEqual(snapshot);
    expect(source[0]).toBe(region);
    expect(Object.isFrozen(source)).toBe(false);
  });

  it('laisse `matchesPickerFilters` et `filterPickableCards` d’accord', () => {
    const filters = filtersOf({ rarities: ['RARE'] });
    expect(cards.filter((card) => matchesPickerFilters(card, filters))).toEqual(
      filterPickableCards(cards, filters),
    );
  });
});

describe('card-picker — libellé d’une ligne', () => {
  it('écrit « Nom — Rareté — Score pts » avec les libellés du domaine', () => {
    expect(pickableCardLabel(rue)).toBe(
      `Rue de l'Église — ${RARITY_LABELS.INHABITUELLE} — ${scoreFormatter.format(750)} pts`,
    );
  });

  it('emploie le libellé exact de la rareté peu commune', () => {
    expect(RARITY_LABELS.INHABITUELLE).toBe('Peu commune');
    expect(pickableCardLabel(rue)).toContain('Peu commune');
  });

  it('sépare les trois parties par un tiret cadratin', () => {
    expect(pickableCardLabel(region).split(' — ')).toEqual([
      'Auvergne-Rhône-Alpes',
      RARITY_LABELS.MYTHIQUE,
      `${scoreFormatter.format(3500)} pts`,
    ]);
  });
});
