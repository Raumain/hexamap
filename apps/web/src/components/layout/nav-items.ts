import { SHOP_ENABLED } from '../../content/boutique';

export type SalonPath =
  | '/'
  | '/collection'
  | '/tableau'
  | '/tableaux'
  | '/friends'
  | '/guichet'
  | '/market'
  | '/market/mine'
  | '/achievements'
  | '/atlas'
  | '/palmares'
  | '/boutique'
  | '/rarete';

export interface NavItem {
  to: SalonPath;
  /** Nom de la salle, affiché dans le rail. */
  label: string;
  /** Libellé court de la barre mobile. */
  short: string;
  /** Tracé 24 × 24. */
  glyph: string;
}

/** Les quatre salles principales (DESIGN_SYSTEM.md §9.1). */
export const PRIMARY_NAV: readonly NavItem[] = [
  {
    to: '/',
    label: 'Le Relevé',
    short: 'Relevé',
    glyph: 'M4 7h16v10H4zM8 7v10M16 7v10M11 11h3M11 13.5h2',
  },
  {
    to: '/collection',
    label: 'Le Cadastre',
    short: 'Cadastre',
    glyph: 'M4 5h16v14H4zM4 10h16M4 14h16M7 7.5h.01M7 12h.01M7 16h.01',
  },
  {
    to: '/tableau',
    label: 'La Planche',
    short: 'Planche',
    glyph: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  },
  {
    to: '/market',
    label: 'Le Comptoir',
    short: 'Comptoir',
    glyph: 'M12 3l8 4-8 4-8-4zM4 11v5l8 4 8-4v-5M12 11v9',
  },
];

/** Les salles secondaires, avant l'interrupteur de la boutique. */
const SECONDARY_NAV_BASE: readonly NavItem[] = [
  {
    to: '/guichet',
    label: 'Le Guichet',
    short: 'Guichet',
    glyph: 'M12 3a5 5 0 0 1 5 5v4l2 3H5l2-3V8a5 5 0 0 1 5-5M10 18a2 2 0 0 0 4 0',
  },
  {
    to: '/tableaux',
    label: 'Les Planches',
    short: 'Planches',
    glyph: 'M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5L12 21l9-4.5',
  },
  {
    to: '/friends',
    label: 'Les Amis',
    short: 'Amis',
    glyph:
      'M9 11a3.5 3.5 0 0 1 0-7 3.5 3.5 0 0 1 0 7M2 20c0-3 3.1-5 7-5s7 2 7 5M16.5 5.2a3 3 0 0 1 0 5.6M19.5 20c-.2-2.3-1.2-3.9-3-4.5',
  },
  {
    to: '/market/mine',
    label: 'Mes Offres',
    short: 'Offres',
    glyph: 'M3 12l9-9 9 9-9 9zM8 12h8M12 8v8',
  },
  {
    to: '/achievements',
    label: 'Les Médailles',
    short: 'Médailles',
    glyph:
      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M12 7.5l1.4 2.9 3.1.4-2.3 2.2.6 3.1-2.8-1.5-2.8 1.5.6-3.1-2.3-2.2 3.1-.4z',
  },
  {
    to: '/atlas',
    label: "L'Atlas",
    short: 'Atlas',
    glyph: 'M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14',
  },
  {
    to: '/palmares',
    label: 'Le Palmarès',
    short: 'Palmarès',
    glyph: 'M8 21h8M12 17v4M7 4h10v3a5 5 0 0 1-10 0zM7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3',
  },
  {
    to: '/boutique',
    label: 'La Boutique',
    short: 'Boutique',
    glyph: 'M4 8h16l-1 12H5zM9 8V6a3 3 0 0 1 6 0v2M12 12v4M10 14h4',
  },
  {
    to: '/rarete',
    label: 'Les Raretés',
    short: 'Raretés',
    glyph: 'M12 3l7 9-7 9-7-9zM5 12h14',
  },
];

/**
 * Les salles secondaires réellement servies. La boutique se filtre ici, à la
 * source : le rail, la feuille mobile et `isSecondaryRoom` lisent tous cette
 * liste, donc aucun d'eux ne peut rendre une salle que les routes refusent.
 */
export const SECONDARY_NAV: readonly NavItem[] = SHOP_ENABLED
  ? SECONDARY_NAV_BASE
  : SECONDARY_NAV_BASE.filter((item) => item.to !== '/boutique');

/** La copie de la feuille mobile des salles secondaires. */
export const MORE_SHEET = { control: 'Plus', title: 'Autres salles', close: 'Fermer' } as const;

const SALON_TITLES: Record<string, string> = {
  '/': 'Le Relevé',
  '/collection': 'Le Cadastre',
  '/tableau': 'La Planche',
  '/tableaux': 'Les Planches',
  '/friends': 'Les Amis',
  '/guichet': 'Le Guichet',
  '/market': 'Le Comptoir',
  '/market/mine': 'Mes Offres',
  '/achievements': 'Les Médailles',
  '/atlas': "L'Atlas",
  '/palmares': 'Le Palmarès',
  '/boutique': 'La Boutique',
  '/boutique/succes': 'La Boutique',
  '/rarete': 'Les Raretés',
  '/mentions-legales': 'Mentions légales',
  '/confidentialite': 'Confidentialité',
  '/login': 'Le Seuil',
  '/register': 'Le Seuil',
};

export function salonForPath(pathname: string): string {
  if (SALON_TITLES[pathname]) return SALON_TITLES[pathname];
  if (pathname.startsWith('/tickets/')) return 'Le Relevé';
  if (pathname.startsWith('/card/')) return 'Le Cartel';
  if (pathname.startsWith('/players/')) return 'La Vitrine';
  if (pathname.startsWith('/market')) return 'Le Comptoir';
  return 'Le Cabinet';
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.to === '/') return pathname === '/' || pathname.startsWith('/tickets/');
  if (item.to === '/market')
    return (
      pathname === '/market' || (pathname.startsWith('/market/') && pathname !== '/market/mine')
    );
  if (item.to === '/boutique') return pathname === '/boutique' || pathname.startsWith('/boutique/');
  return pathname === item.to;
}

export function isSecondaryRoom(pathname: string): boolean {
  return SECONDARY_NAV.some((item) => isNavItemActive(item, pathname));
}
