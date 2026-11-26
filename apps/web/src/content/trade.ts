import type { TradeStatus } from '@hexamap/shared';

/**
 * Copie française du Troc. Une carte contre une carte, sans un écu : la salle
 * n'est pas ouverte à elle seule, ces libellés servent Le Cartel et Le Guichet.
 */
export const TROC = {
  propose: 'Proposer un troc',
  proposeHint:
    'Une carte contre une carte, sans un écu. La carte offerte et la carte demandée restent engagées jusqu’à la réponse.',
  dialogTitle: 'Proposer un troc',
  dialogIntro: (nom: string) =>
    `Choisissez la carte que vous mettez dans la balance, en échange de « ${nom} ».`,
  changeRequested: 'Changer la carte demandée',
  summary: (requested: string, offered: string) => `« ${requested} » contre « ${offered} »`,
  submit: 'Envoyer la proposition',
  close: 'Fermer',
  submitting: 'Envoi…',
  loading: 'Chargement des cartes…',
  retry: 'Réessayer',
  noFreeCard:
    'Aucune carte libre à proposer : une carte en vente ou déjà engagée dans un troc ne peut pas l’être.',
  sent: 'Proposition envoyée. La réponse arrivera au Guichet.',
  friend: {
    open: 'Proposer un troc',
    requestStepTitle: (pseudo: string) => `Choisissez une carte de ${pseudo} à demander.`,
    offerStepTitle: 'Choisissez maintenant la carte que vous mettez dans la balance.',
    empty: 'Cet ami n’a aucune carte libre à échanger pour le moment.',
    limit: 'Les cinquante plus hautes cartes libres sont proposées.',
  },
  sectionTitle: 'Le Troc',
  sectionBody:
    'Les échanges en cours : ce qu’on vous propose, et ce que vous avez proposé. Une offre dure sept jours.',
  receivedTitle: 'Offres reçues',
  sentTitle: 'Offres envoyées',
  empty: 'Aucune offre d’échange pour le moment.',
  offerLine: (nom: string) => `« ${nom} »`,
  against: 'contre',
  from: (pseudo: string) => `De ${pseudo}`,
  to: (pseudo: string) => `À ${pseudo}`,
  expires: (date: string) => `Expire le ${date}`,
  accept: 'Accepter',
  decline: 'Refuser',
  withdraw: 'Annuler l’offre',
  accepted: 'Échange accepté : les deux cartes ont changé de main.',
  declined: 'Offre refusée.',
  cancelled: 'Offre annulée.',
  status: {
    PENDING: 'En attente',
    ACCEPTED: 'Acceptée',
    DECLINED: 'Refusée',
    CANCELLED: 'Annulée',
    EXPIRED: 'Expirée',
  } satisfies Record<TradeStatus, string>,
};
