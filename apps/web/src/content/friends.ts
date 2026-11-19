export const FRIENDS = {
  eyebrow: 'LES AMIS',
  title: 'Les Amis',
  subtitle:
    'Ajoutez un joueur par son pseudo, acceptez les demandes reçues et gardez votre cercle sous la main.',
  loadingSession: 'Ouverture de la salle…',
  loading: 'Chargement de vos relations…',
  retry: 'Réessayer',
  unknownPseudo: 'Joueur sans pseudo',
  search: {
    label: 'Pseudo du joueur',
    placeholder: 'pseudo',
    submit: 'Ajouter',
    emptyPseudo: 'Saisissez un pseudo avant d’ajouter un joueur.',
  },
  sections: {
    incoming: 'Demandes reçues',
    outgoing: 'Demandes envoyées',
    friends: 'Mes amis',
  },
  empty: {
    incoming: 'Aucune demande reçue pour le moment.',
    outgoing: 'Aucune demande envoyée.',
    friends: 'Aucun ami pour le moment.',
  },
  actions: {
    accept: 'Accepter',
    decline: 'Refuser',
    cancel: 'Annuler',
    remove: 'Retirer',
    block: 'Bloquer',
  },
  feedback: {
    requestSent: 'Demande envoyée.',
    requestAccepted: 'Vous êtes désormais amis.',
    accepted: 'Demande acceptée.',
    declined: 'Demande refusée.',
    cancelled: 'Demande annulée.',
    removed: 'Ami retiré.',
    blocked: 'Joueur bloqué.',
  },
  confirm: {
    blockLabel: 'Confirmation du blocage',
    block: (pseudo: string) =>
      `Bloquer ${pseudo} supprime votre amitié. Cette action est définitive.`,
    blockConfirm: 'Confirmer le blocage',
    blockCancel: 'Renoncer au blocage',
  },
  countLabel: (count: number) => `${count} ${count === 1 ? 'ligne' : 'lignes'}`,
} as const;
