import { RARITY_ACCENT_HEX, RARITY_LABELS, type Rarity } from '@hexamap/shared';

export interface RarityTheme {
  /** Libellé français, propriété du domaine partagé. */
  label: string;
  /** Métal du carton de montage et du sceau. */
  metal: string;
  /** Initiale gravée dans le sceau. */
  initial: string;
  /** Épaisseur du filet du carton. */
  borderWidth: number;
  /** Encre lisible sur le métal. */
  sealInk: 'ink' | 'vellum';
  /** Traitement supplémentaire du carton. */
  treatment: 'etain' | 'cuivre' | 'argent' | 'email' | 'or' | 'electrum';
}

/**
 * Ramp métallique du cabinet (DESIGN_SYSTEM.md §7.3).
 * Aucun libellé ni aucune valeur hexadécimale n'est réécrit ici : tout vient de
 * `packages/shared/src/rarity.ts`.
 */
export const RARITY_THEME: Record<Rarity, RarityTheme> = {
  COMMUNE: {
    label: RARITY_LABELS.COMMUNE,
    metal: RARITY_ACCENT_HEX.COMMUNE,
    initial: 'C',
    borderWidth: 1,
    sealInk: 'ink',
    treatment: 'etain',
  },
  INHABITUELLE: {
    label: RARITY_LABELS.INHABITUELLE,
    metal: RARITY_ACCENT_HEX.INHABITUELLE,
    initial: 'P',
    borderWidth: 1,
    sealInk: 'vellum',
    treatment: 'cuivre',
  },
  RARE: {
    label: RARITY_LABELS.RARE,
    metal: RARITY_ACCENT_HEX.RARE,
    initial: 'R',
    borderWidth: 2,
    sealInk: 'ink',
    treatment: 'argent',
  },
  EPIQUE: {
    label: RARITY_LABELS.EPIQUE,
    metal: RARITY_ACCENT_HEX.EPIQUE,
    initial: 'É',
    borderWidth: 2,
    sealInk: 'vellum',
    treatment: 'email',
  },
  LEGENDAIRE: {
    label: RARITY_LABELS.LEGENDAIRE,
    metal: RARITY_ACCENT_HEX.LEGENDAIRE,
    initial: 'L',
    borderWidth: 2,
    sealInk: 'ink',
    treatment: 'or',
  },
  MYTHIQUE: {
    label: RARITY_LABELS.MYTHIQUE,
    metal: RARITY_ACCENT_HEX.MYTHIQUE,
    initial: 'M',
    borderWidth: 2,
    sealInk: 'ink',
    treatment: 'electrum',
  },
};

/** Accent de rareté, réexporté pour les usages non-Tailwind. */
export const rarityAccent = (rarity: Rarity): string => RARITY_THEME[rarity].metal;
