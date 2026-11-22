/**
 * Les libellés de « La Sonnette ». Les clés sont anglaises, les valeurs
 * françaises, et aucune phrase n'est écrite dans le composant.
 */
export const PUSH_ROOM = {
  title: 'La Sonnette',
  description:
    'Une seule chose se pousse : le retour d’une charge quand votre carnet est vide. Les ventes, les médailles et les offres de troc restent dans Le Guichet, où elles vous attendent.',

  detecting: 'Vérification de ce navigateur…',

  unsupported:
    'Ce navigateur ne sait pas recevoir de notifications. La Sonnette reste éteinte ; votre carnet, lui, se remplit normalement.',
  iosInstall:
    'Sur iPhone et iPad, la Sonnette ne fonctionne qu’une fois Hexamap installée sur l’écran d’accueil, avec iOS 16.4 ou plus récent.',
  disabled:
    'La Sonnette n’est pas configurée sur ce serveur : il n’y a rien à activer de votre côté.',
  permissionDenied:
    'Les notifications sont bloquées pour ce site. Autorisez-les dans les réglages du navigateur, puis revenez ici.',

  subscribed: 'La Sonnette est active sur ce navigateur.',
  notSubscribed: 'La Sonnette est éteinte sur ce navigateur.',
  enable: 'Activer la Sonnette',
  disable: 'Éteindre la Sonnette',
  working: 'Enregistrement…',

  quiet: {
    title: 'Heures calmes',
    description:
      'Aucune notification entre ces deux heures, exprimées en temps universel. Un envoi reporté n’est pas perdu : il part à la première heure autorisée, et le report ne consomme aucun quota.',
    from: 'À partir de',
    to: 'Jusqu’à',
    save: 'Enregistrer les heures calmes',
    saved: 'Heures calmes enregistrées.',
    disabled: 'Les deux bornes sont égales : les heures calmes sont désactivées.',
    hour: (hour: number): string => `${String(hour).padStart(2, '0')} h`,
  },

  enableFailed: 'La Sonnette n’a pas pu être activée. Réessayez.',
  disableFailed: 'La Sonnette n’a pas pu être éteinte. Réessayez.',
  preferencesFailed: 'Les heures calmes n’ont pas pu être enregistrées. Réessayez.',

  /** Ce que l'écran montre à qui n'a pas le droit d'activer la sonnette. */
  loading: 'Chargement de vos réglages…',
} as const;
