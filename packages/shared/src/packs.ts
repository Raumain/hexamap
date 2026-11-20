export type PackKey = 'PACK_500' | 'PACK_1200' | 'PACK_2500' | 'PACK_6000';

export interface PackDefinition {
  readonly key: PackKey;
  readonly ecus: number;
  readonly priceCents: number;
  readonly currency: 'EUR';
  readonly bonusPercent: number;
  readonly stripePriceEnv: string;
}

// Catalogue fermé des packs d'écus : aucune valeur ne se modifie depuis un écran d'administration.
export const PACKS: readonly PackDefinition[] = [
  {
    key: 'PACK_500',
    ecus: 500,
    priceCents: 499,
    currency: 'EUR',
    bonusPercent: 0,
    stripePriceEnv: 'STRIPE_PRICE_PACK_500',
  },
  {
    key: 'PACK_1200',
    ecus: 1200,
    priceCents: 999,
    currency: 'EUR',
    bonusPercent: 20,
    stripePriceEnv: 'STRIPE_PRICE_PACK_1200',
  },
  {
    key: 'PACK_2500',
    ecus: 2500,
    priceCents: 1999,
    currency: 'EUR',
    bonusPercent: 25,
    stripePriceEnv: 'STRIPE_PRICE_PACK_2500',
  },
  {
    key: 'PACK_6000',
    ecus: 6000,
    priceCents: 4499,
    currency: 'EUR',
    bonusPercent: 33,
    stripePriceEnv: 'STRIPE_PRICE_PACK_6000',
  },
];

export const PACK_KEYS: readonly PackKey[] = PACKS.map((pack) => pack.key);

export function packByKey(key: PackKey): PackDefinition | undefined {
  return PACKS.find((pack) => pack.key === key);
}

// Ratio écus par euro : il croît strictement d'un pack au suivant, c'est la preuve du bonus.
export function ecusPerEuro(pack: PackDefinition): number {
  return pack.ecus / (pack.priceCents / 100);
}
