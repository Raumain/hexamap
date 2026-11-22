import type { NotificationKind } from '@hexamap/shared';

/**
 * Copie française du Guichet. Les neuf `kind` sont nommés ici, dans l'ordre
 * d'affichage des sections : la salle ne décide d'aucun libellé.
 */
export const GUICHIET = {
  eyebrow: 'LE GUICHIET',
  title: 'Le Guichet',
  subtitle:
    'Ce que le cabinet vous adresse : une demande d’ami, une vente conclue, une médaille frappée. Les avis restent ici quatre-vingt-dix jours.',
  loadingSession: 'Ouverture de la salle…',
  loading: 'Chargement des avis…',
  retry: 'Réessayer',
  emptyTitle: 'Le guichet est vide',
  emptyBody:
    'Les avis arriveront ici : une demande d’ami, une vente au Comptoir, une médaille frappée. Rien à dépouiller pour le moment.',
  unknownPseudo: 'un joueur',
  unknownLabel: 'une médaille',
  markAll: 'Tout marquer comme lu',
  markAllDone: (count: number) =>
    count === 1 ? '1 avis marqué comme lu.' : `${count} avis marqués comme lus.`,
  showMore: 'Afficher plus',
  otherSection: 'Autres avis',
  sections: {
    FRIEND_REQUEST: 'Demandes d’ami',
    FRIEND_ACCEPTED: 'Amitiés acceptées',
    ACHIEVEMENT: 'Médailles',
    MARKET_SOLD: 'Ventes',
    MARKET_BOUGHT: 'Achats',
    TRADE_OFFER: 'Propositions d’échange',
    TRADE_ACCEPTED: 'Échanges acceptés',
    TRADE_DECLINED: 'Échanges refusés',
    TRADE_EXPIRED: 'Échanges expirés',
  } satisfies Record<NotificationKind, string>,
  actions: {
    markRead: 'Marquer comme lu',
    viewPlayer: 'Voir le joueur',
  },
  descriptions: {
    FRIEND_REQUEST: (pseudo: string) => `${pseudo} vous demande en ami.`,
    FRIEND_ACCEPTED: (pseudo: string) => `${pseudo} a accepté votre demande d’ami.`,
    ACHIEVEMENT: (label: string, payout: number | null) =>
      payout === null || payout === 0
        ? `Médaille obtenue : ${label}.`
        : `Médaille obtenue : ${label} — ${payout} écus versés.`,
    MARKET_SOLD: (price: number | null, buyerPseudo: string | null) => {
      const amount = price === null ? 'au prix convenu' : `pour ${price} écus`;
      return buyerPseudo === null
        ? `Une carte de votre Comptoir est partie ${amount}.`
        : `Une carte de votre Comptoir est partie ${amount} à ${buyerPseudo}.`;
    },
    MARKET_BOUGHT: (price: number | null) =>
      price === null
        ? 'Vous avez acheté une carte au Comptoir.'
        : `Vous avez acheté une carte au Comptoir pour ${price} écus.`,
    TRADE_OFFER: (pseudo: string) => `${pseudo} vous propose un échange.`,
    TRADE_ACCEPTED: 'Votre échange a été accepté.',
    TRADE_DECLINED: 'Votre échange a été refusé.',
    TRADE_WITHDRAWN: 'L’auteur a retiré sa proposition d’échange.',
    TRADE_EXPIRED: 'Votre échange a expiré sans réponse.',
    unknown: 'Un avis est arrivé au guichet.',
  },
  when: {
    now: 'à l’instant',
    minutes: (count: number) => (count === 1 ? 'il y a 1 minute' : `il y a ${count} minutes`),
    hours: (count: number) => (count === 1 ? 'il y a 1 heure' : `il y a ${count} heures`),
    days: (count: number) => (count === 1 ? 'il y a 1 jour' : `il y a ${count} jours`),
  },
  unreadSuffix: (count: number) => (count === 1 ? 'non lue' : 'non lues'),
  countLabel: (count: number) => `${count} avis`,
  readLabel: 'lu',
  unreadLabel: 'non lue',
  feedback: {
    markedOne: 'Avis marqué comme lu.',
  },
  bell: {
    label: 'Le Guichet',
    labelUnread: (count: number) => `Le Guichet, ${count} non lues`,
    announce: (count: number) =>
      count === 0
        ? 'Aucune notification non lue.'
        : count === 1
          ? '1 notification non lue.'
          : `${count} notifications non lues.`,
    cap: 99,
  },
} as const;
