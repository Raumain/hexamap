import { PASSWORD_MIN_LENGTH, PSEUDO_MAX_LENGTH, PSEUDO_MIN_LENGTH } from '@hexamap/shared';

/**
 * Les libellés de la salle « Mon compte ». Les clés sont anglaises, les valeurs
 * françaises, et aucune phrase n’est écrite dans le composant.
 */

/** Bornes d’affichage : le serveur reste seul juge des deux règles. */
export const ACCOUNT_BIO_MAX_LENGTH = 280;
export const ACCOUNT_PASSWORD_MIN_LENGTH = PASSWORD_MIN_LENGTH;

export const ACCOUNT_ROOM = {
  eyebrow: 'Le registre du titulaire',
  title: 'Mon compte',
  subtitle:
    'Votre identité au cabinet : pseudo, courriel, mot de passe, vitrine et données. Tout se reprend ici, et le compte peut s’y fermer.',
  loadingSession: 'Chargement de votre session…',
  retry: 'Réessayer',
  identity: {
    title: 'Identité',
    description:
      'Votre pseudo est votre nom public : il sert d’adresse dans la vitrine et dans les relations.',
    currentLabel: 'Pseudo actuel',
    label: 'Nouveau pseudo',
    placeholder: `De ${PSEUDO_MIN_LENGTH} à ${PSEUDO_MAX_LENGTH} caractères`,
    hint: `De ${PSEUDO_MIN_LENGTH} à ${PSEUDO_MAX_LENGTH} caractères : lettres, chiffres, tirets et traits de soulignement, sans espace.`,
    unchanged: 'C’est déjà votre pseudo.',
    submit: 'Changer de pseudo',
    success: 'Votre pseudo est à jour.',
  },
  email: {
    title: 'Courriel',
    description:
      'Chaque compte s’identifie par une adresse. Votre adresse actuelle est affichée ci-dessous, et vous pouvez la changer à tout moment.',
    currentLabel: 'Adresse actuelle',
    label: 'Nouvelle adresse',
    placeholder: 'prenom@exemple.fr',
    invalid: 'Saisissez une adresse électronique valide.',
    submit: 'Changer d’adresse',
    success: 'Votre demande de changement d’adresse est enregistrée.',
  },
  password: {
    title: 'Mot de passe',
    description: '',
    currentLabel: 'Mot de passe actuel',
    newLabel: 'Nouveau mot de passe',
    confirmLabel: 'Confirmation du nouveau mot de passe',
    currentRequired: 'Saisissez votre mot de passe actuel.',
    tooShort: `Le nouveau mot de passe doit contenir au moins ${ACCOUNT_PASSWORD_MIN_LENGTH} caractères.`,
    mismatch: 'Les deux saisies ne correspondent pas.',
    submit: 'Changer de mot de passe',
    success: 'Votre mot de passe est à jour.',
  },
  profile: {
    title: 'Bio et visibilité',
    description:
      'La vitrine montre votre pseudo, votre ancienneté, vos cartes et vos médailles. Jamais votre adresse, jamais votre solde.',
    loading: 'Chargement de votre vitrine…',
    loadError: 'Impossible de lire votre vitrine.',
    bioLabel: 'Biographie',
    bioPlaceholder: 'Quelques mots sur votre collection…',
    bioHint: `${ACCOUNT_BIO_MAX_LENGTH} caractères au plus.`,
    publicLabel: 'Vitrine publique',
    publicHint:
      'Décochée, votre vitrine répond « introuvable » à tous les autres joueurs. Vous continuez de la voir depuis votre profil.',
    submit: 'Enregistrer la vitrine',
    success: 'Votre vitrine est à jour.',
  },
  export: {
    title: 'Vos données',
    description:
      'Un fichier JSON réunit vos cartes, vos tableaux, vos médailles, votre grand-livre, vos relations et votre profil. Il se télécharge depuis votre session et ne circule nulle part ailleurs.',
    submit: 'Télécharger mes données',
    hint: 'Le fichier s’ouvre dans un éditeur de texte. Il porte la date de l’export dans son profil.',
  },
  danger: {
    title: 'Fermer le compte',
    description:
      'La fermeture supprime votre compte et tout ce qu’il porte : cartes, tickets, tableaux, annonces, médailles, grand-livre, relations. Aucune copie n’est conservée, aucune restauration n’est possible.',
    warning: 'Vos écus et vos cartes ne sont jamais remboursés. Cette action est définitive.',
    passwordLabel: 'Mot de passe',
    passwordRequired: 'Saisissez votre mot de passe.',
    confirmationLabel: 'Recopiez votre pseudo',
    confirmationPlaceholder: 'Votre pseudo',
    confirmationHint: 'La saisie doit correspondre exactement à votre pseudo.',
    confirmationRequired: 'Recopiez votre pseudo pour confirmer.',
    mismatch: 'La saisie ne correspond pas à votre pseudo.',
    submit: 'Supprimer définitivement mon compte',
    success: 'Votre compte est fermé. Vous allez être redirigé.',
    closed:
      'La fermeture de compte n’est pas encore ouverte : elle sera proposée une fois les pages légales définitives publiées.',
  },
} as const;

/** Un message français par code stable du contrat, plus un repli générique. */
const FALLBACK_ACCOUNT_ERROR = 'Une erreur est survenue. Réessayez.';

const ACCOUNT_ERROR_MESSAGES: Record<string, string> = {
  PSEUDO_INVALID: 'Ce pseudo n’est pas conforme. Vérifiez sa longueur et ses caractères.',
  PSEUDO_TAKEN: 'Ce pseudo est déjà pris. Essayez-en un autre.',
  EMAIL_ALREADY_EXISTS: 'Un compte utilise déjà cette adresse.',
  EMAIL_VERIFICATION_DISABLED:
    'Le changement de courriel est momentanément indisponible. Votre adresse n’a pas été modifiée.',
  CURRENT_PASSWORD_REQUIRED: 'Saisissez votre mot de passe actuel pour le remplacer.',
  INVALID_PASSWORD: 'Le mot de passe saisi est incorrect.',
  PASSWORD_TOO_SHORT: 'Le nouveau mot de passe est trop court.',
  CONFIRMATION_MISMATCH: 'La saisie ne correspond pas à votre pseudo.',
  ACCOUNT_DELETION_DISABLED:
    'La fermeture de compte est momentanément indisponible. Rien n’a été supprimé.',
  ACCOUNT_PURGE_INCOMPLETE:
    'La suppression a laissé des données derrière elle. Signalez ce défaut : il est côté serveur.',
  UNAUTHORIZED: 'Votre session a expiré. Reconnectez-vous.',
};

export function accountErrorMessage(code: string | null): string {
  if (code === null) {
    return FALLBACK_ACCOUNT_ERROR;
  }
  return ACCOUNT_ERROR_MESSAGES[code] ?? FALLBACK_ACCOUNT_ERROR;
}
