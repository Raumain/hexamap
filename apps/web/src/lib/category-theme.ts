import type { Category } from '@hexamap/shared';

export interface CategoryMeta {
  /** Libellé français affiché. */
  label: string;
  /** Libellé court de navigation. */
  short: string;
  /** Nom de la gravure dans le cabinet. */
  plate: string;
  /** Glyphe 24 × 24 (tracé unique). */
  glyph: string;
}

/**
 * Identité de catégorie (DESIGN_SYSTEM.md §7.2).
 * Quatre gravures, quatre glyphes, aucun emprunt à la signalétique routière.
 */
export const CATEGORY_META: Record<Category, CategoryMeta> = {
  REGION: {
    label: 'Région',
    short: 'Régions',
    plate: 'La planche topographique',
    glyph: 'M3 7l5-3 4 2 5-3 4 2v13l-5 3-4-2-5 3-4-2zM8 4v13M12 6v13M17 3v13',
  },
  DEPARTEMENT: {
    label: 'Département',
    short: 'Départements',
    plate: "L'écu",
    glyph: 'M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z',
  },
  COMMUNE: {
    label: 'Commune',
    short: 'Communes',
    plate: 'La vue',
    glyph: 'M4 19v-6l3-2 3 2v6M10 19V9l3-2 3 2v10M16 19v-4l2-1 2 1v4M3 19h18M12 5V3',
  },
  RUE: {
    label: 'Rue',
    short: 'Rues',
    plate: 'Le spécimen',
    glyph: 'M6 3v18M18 3v18M6 8h12M6 13h12M6 18h12',
  },
};

export const categoryLabel = (category: Category): string => CATEGORY_META[category].label;
