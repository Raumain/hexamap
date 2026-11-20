export type SalonPath =
  | '/'
  | '/collection'
  | '/tableau'
  | '/tableaux'
  | '/friends'
  | '/market'
  | '/market/mine'
  | '/achievements'
  | '/import-status'
  | '/assemblage'
  | '/boutique';

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

/** Les salles secondaires. */
export const SECONDARY_NAV: readonly NavItem[] = [
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
    to: '/import-status',
    label: 'Les Archives',
    short: 'Archives',
    glyph: 'M4 5h16v4H4zM6 9v10h12V9M10 13h4',
  },
  {
    to: '/assemblage',
    label: "L'Assemblage",
    short: 'Assemblage',
    glyph: 'M4 6l5-2 6 2 5-2v14l-5 2-6-2-5 2zM9 4v14M15 6v14',
  },
  {
    to: '/boutique',
    label: 'La Boutique',
    short: 'Boutique',
    glyph: 'M4 8h16l-1 12H5zM9 8V6a3 3 0 0 1 6 0v2M12 12v4M10 14h4',
  },
];

/** La copie de la feuille mobile des salles secondaires. */
export const MORE_SHEET = { control: 'Plus', title: 'Autres salles', close: 'Fermer' } as const;

const SALON_TITLES: Record<string, string> = {
  '/': 'Le Relevé',
  '/collection': 'Le Cadastre',
  '/tableau': 'La Planche',
  '/tableaux': 'Les Planches',
  '/friends': 'Les Amis',
  '/market': 'Le Comptoir',
  '/market/mine': 'Mes Offres',
  '/achievements': 'Les Médailles',
  '/import-status': 'Les Archives',
  '/assemblage': "L'Assemblage",
  '/boutique': 'La Boutique',
  '/boutique/succes': 'La Boutique',
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
  return pathname === item.to;
}

export function isSecondaryRoom(pathname: string): boolean {
  return SECONDARY_NAV.some((item) => isNavItemActive(item, pathname));
}
