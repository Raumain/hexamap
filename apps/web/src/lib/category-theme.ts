import type { Category } from '@hexamap/shared';

/** Accent de catégorie, exprimé uniquement avec les tokens du design system. */
export const CATEGORY_ACCENT: Record<Category, string> = {
  REGION: 'text-sign-ochre',
  DEPARTEMENT: 'text-sign-blue',
  COMMUNE: 'text-sign-green',
  RUE: 'text-ink-inverse',
};

/** Tracés décoratifs (viewBox 24×24) utilisés par les visuels procéduraux. */
export const CATEGORY_MOTIF: Record<Category, string> = {
  REGION:
    'M12 7.2 13.7 10.6 17.4 11.2 14.8 13.8 15.4 17.5 12 15.7 8.6 17.5 9.2 13.8 6.6 11.2 10.3 10.6z',
  DEPARTEMENT: 'M6 10h12v4H6z',
  COMMUNE: 'M9 19v-5h2v-3h2v3h2v5z',
  RUE: '',
};
