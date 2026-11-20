import type { PackKey } from '@hexamap/shared';

// Le prix TTC est un montant en centimes : le formateur est construit une seule
// fois, au module, et la division par 100 n'est jamais laissée à l'appelant.
const euroFormatter = new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency: 'EUR',
});

export function packPriceLabel(cents: number): string {
  return euroFormatter.format(cents / 100);
}

export function packBonusLabel(percent: number): string {
  return percent === 0 ? '' : `+${percent} % d’écus`;
}

export const BOUTIQUE = {
  eyebrow: 'Le cabinet · La Boutique',
  title: 'La Boutique',
  subtitle:
    'Les écus s’achètent ici, pack par pack. Le ticket gratuit reste la seule source de cartes : la boutique est un raccourci, jamais le chemin.',
  balanceLabel: 'Votre bourse',
  priceTtc: 'Prix TTC',
  bonusLabel: 'Bonus',
  buy: 'Acheter',
  buying: 'Achat…',
  redirecting: 'Redirection vers le paiement…',
  loadingSession: 'Chargement de votre session…',
  retry: 'Réessayer',
  errors: {
    SHOP_DISABLED: "La boutique n'est pas encore ouverte.",
    SHOP_DAILY_CAP_REACHED: 'Vous avez atteint le plafond d’achat de la journée. Revenez demain.',
    SHOP_PROVIDER_ERROR:
      'Le prestataire de paiement n’a pas pu préparer la commande. Aucun écu n’a été débité : réessayez dans un instant.',
    UNKNOWN_PACK: "Ce pack n'existe pas.",
    UNAUTHORIZED: 'Votre session a expiré. Reconnectez-vous.',
    ORDER_NOT_FOUND: 'Cette commande est introuvable.',
    fallback: 'Une erreur est survenue. Réessayez.',
  },
} as const;

export const BOUTIQUE_SUCCESS = {
  eyebrow: 'Le cabinet · La Boutique',
  title: 'Votre achat',
  pending: 'Paiement en cours de confirmation…',
  pendingDetail:
    'Le prestataire de paiement nous prévient par un message signé. Cette page se rafraîchit seule quelques secondes.',
  credited: 'Écus crédités',
  newBalance: 'Nouveau solde',
  balanceLoading: 'Lecture du solde…',
  refresh: 'Rafraîchir',
  missingSession: 'Aucune référence de paiement : revenez à la boutique pour choisir un pack.',
  backToShop: 'Retour à la boutique',
  redirectIn: (seconds: number) => `Retour à la boutique dans ${seconds} s.`,
  loading: 'Lecture de la commande…',
} as const;

export const PACK_LABELS: Record<PackKey, { name: string; tagline: string }> = {
  PACK_500: {
    name: 'Le Pécule',
    tagline: 'De quoi compléter quelques séries.',
  },
  PACK_1200: {
    name: 'La Bourse',
    tagline: 'Une bourse pleine pour tenir la saison.',
  },
  PACK_2500: {
    name: 'Le Coffre',
    tagline: 'Le coffre du cabinet, pour les collections patientes.',
  },
  PACK_6000: {
    name: 'Le Trésor',
    tagline: 'Le trésor complet, au meilleur rapport.',
  },
};
