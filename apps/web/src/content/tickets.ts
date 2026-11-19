import type { Category } from '@hexamap/shared';

/** Les libellés de rareté appartiennent au domaine : une seule source. */
export { RARITY_LABELS } from '@hexamap/shared';

export const CATEGORY_LABELS: Record<Category, string> = {
  REGION: 'Région',
  DEPARTEMENT: 'Département',
  COMMUNE: 'Commune',
  RUE: 'Rue',
};

export const STATUS_LABELS: Record<'ACTIVE' | 'EXHAUSTED' | 'EXPIRED', string> = {
  ACTIVE: 'En cours',
  EXHAUSTED: 'Épuisé',
  EXPIRED: 'Expiré',
};

export type PanelKind = 'STATION' | 'BELVEDERE' | 'RENOVATION';

export interface PanelContent {
  label: string;
  description: string;
  /** Tracé SVG (viewBox 24×24, rendu en trait) — purement décoratif. */
  icon: string;
}

export const PANEL_CONTENT: Record<PanelKind, PanelContent> = {
  STATION: {
    label: 'Station-service',
    description: '+2 grattages.',
    icon: 'M5 21h14M8 21V9a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v12M9 4h6l-1 3h-4Z',
  },
  BELVEDERE: {
    label: 'Belvédère',
    description: 'Révèle une case voisine.',
    icon: 'M4 8V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3M16 8V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3M2 12a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2ZM14 12a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2ZM12 10v9',
  },
  RENOVATION: {
    label: 'Rénovation',
    description: '+1 palier de rareté sur la prochaine carte.',
    icon: 'M15 12l-8.5 8.5a2.12 2.12 0 1 1-3-3L12 9M18 15l4-4M21.5 11.5l-1.9-1.9a2 2 0 0 0-2.8 0l-4.8 4.8',
  },
};

export const TICKET = {
  title: 'Le Relevé Topographique',
  subtitle: 'Grattez les cases pour révéler des cartes, des panneaux et la Pépite.',
  loadingSession: 'Chargement de votre session…',
  loading: 'Chargement du ticket…',
  emptyTitle: 'Aucun ticket actif.',
  emptyDescription: 'Obtenez un ticket pour commencer à gratter.',
  getTicket: 'Obtenir un ticket',
  exhaustedTitle: 'Ticket épuisé',
  exhaustedDescription: 'Vous avez utilisé tous vos grattages sur ce ticket.',
  newTicket: 'Ouvrir un nouveau ticket',
  notCurrent: "Ce ticket n'est plus votre ticket actif.",
  goToCurrent: 'Reprendre le ticket actif',
  gridAriaLabel: 'Grille du ticket',
  renovationPending: 'Rénovation en attente : la prochaine carte gagne un palier.',
  treasureFound: 'Pépite trouvée !',
  treasureFoundLink: 'Voir dans le cadastre',
  treasureEyebrow: 'Découverte',
  treasureFallbackName: 'Pépite',
  treasureModalLink: 'Ranger dans le cadastre',
  closeModal: 'Fermer',
  retry: 'Réessayer',
};

export function scrapesLabel(count: number): string {
  return count === 1 ? '1 grattage restant' : `${count} grattages restants`;
}

export function cellLabel(index: number): string {
  return `Case ${index + 1} à gratter`;
}

export function lockedCellLabel(index: number): string {
  return `Case ${index + 1} : verrouillée`;
}

export function distanceLabel(distance: number): string {
  return distance === 0 ? 'Pépite' : `${distance} pas`;
}

export function distanceAriaLabel(distance: number): string {
  return distance === 0
    ? 'Distance à la pépite : aucune, vous y êtes.'
    : `Distance à la pépite : ${distance} pas.`;
}

export function revealAnnouncement(index: number, name: string): string {
  return `Case ${index + 1} révélée : ${name}.`;
}
