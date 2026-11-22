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
  pickLabel: 'Carte à offrir',
  pickPlaceholder: 'Choisir une carte…',
  submit: 'Envoyer la proposition',
  close: 'Fermer',
  submitting: 'Envoi…',
  noFreeCard:
    'Aucune carte libre à proposer : une carte en vente ou déjà engagée dans un troc ne peut pas l’être.',
  sent: 'Proposition envoyée. La réponse arrivera au Guichet.',
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
