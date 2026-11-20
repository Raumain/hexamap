// Structure des trois documents légaux. Ce module ne contient **aucune prose
// juridique** : uniquement des titres et des repères entre crochets, que le
// titulaire du site remplace par le texte définitif rédigé par un professionnel.
// Tant qu'un repère subsiste, la page affiche le bandeau provisoire.

export const LEGAL_BANNER = 'Texte provisoire — à compléter avant la mise en vente.';

export interface LegalSegment {
  readonly heading: string;
  readonly placeholder: string;
}

export interface LegalDocument {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly segments: readonly LegalSegment[];
}

// Les trois documents ne sont pas des salles : aucun n'entre dans le rail, et
// `nav-items.ts` reste inchangé. Ce sont des destinations de pied de page.
export const LEGAL_LINKS = [
  { to: '/cgv', label: 'CGV' },
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/confidentialite', label: 'Confidentialité' },
] as const;

export const CGV_LEGAL: LegalDocument = {
  eyebrow: 'Le cabinet · Le Seuil',
  title: 'Conditions générales de vente',
  subtitle:
    'Les conditions ci-dessous s’appliquent à l’achat de packs d’écus dans La Boutique. Aucun écu n’est vendu séparément d’un pack.',
  segments: [
    {
      heading: 'Identité du vendeur',
      placeholder:
        '[À COMPLÉTER — raison sociale, forme juridique, adresse du siège, numéro SIREN et numéro de TVA intracommunautaire du vendeur]',
    },
    {
      heading: 'Prix TTC',
      placeholder:
        '[À COMPLÉTER — mention que les prix sont affichés en euros toutes taxes comprises, et que le prix applicable est celui affiché au moment du paiement]',
    },
    {
      heading: 'Droit de rétractation et exception pour contenu numérique',
      placeholder:
        '[À COMPLÉTER — délai légal de rétractation, et renoncement exprès à ce droit pour un contenu numérique fourni immédiatement, recueilli au moment du paiement]',
    },
    {
      heading: 'Modalités de livraison des écus',
      placeholder:
        '[À COMPLÉTER — moment du crédit des écus après encaissement, absence de support physique, et ce qu’il advient d’un paiement resté en attente]',
    },
    {
      heading: 'Réclamations et médiation',
      placeholder:
        '[À COMPLÉTER — adresse de réclamation, délai de réponse, et coordonnées du médiateur de la consommation compétent]',
    },
  ],
};

export const MENTIONS_LEGALES: LegalDocument = {
  eyebrow: 'Le cabinet · Le Seuil',
  title: 'Mentions légales',
  subtitle: 'Les informations d’identification exigées pour un service en ligne édité en France.',
  segments: [
    {
      heading: 'Éditeur du site',
      placeholder:
        '[À COMPLÉTER — nom ou raison sociale de l’éditeur, forme juridique, adresse, SIREN, responsable de la publication et adresse électronique de contact]',
    },
    {
      heading: 'Hébergeur',
      placeholder:
        '[À COMPLÉTER — nom, raison sociale, adresse et numéro de téléphone de l’hébergeur du service]',
    },
    {
      heading: 'Contact',
      placeholder:
        '[À COMPLÉTER — adresse électronique et, le cas échéant, adresse postale auxquelles le joueur peut écrire]',
    },
  ],
};

export const CONFIDENTIALITE: LegalDocument = {
  eyebrow: 'Le cabinet · Le Seuil',
  title: 'Politique de confidentialité',
  subtitle:
    'Ce que le service conserve, pourquoi, combien de temps, et comment exercer ses droits.',
  segments: [
    {
      heading: 'Données collectées',
      placeholder:
        '[À COMPLÉTER — liste des données traitées : identifiants de compte, pseudo, adresse électronique, adresse IP de session, historique de jeu]',
    },
    {
      heading: 'Sous-traitant de paiement',
      placeholder:
        '[À COMPLÉTER — mention que Stripe traite les données de paiement pour le compte de l’éditeur, et que les numéros de carte ne sont jamais reçus par le service]',
    },
    {
      heading: 'Durées de conservation',
      placeholder:
        '[À COMPLÉTER — durée de conservation des données de compte, des journaux de session et des pièces comptables]',
    },
    {
      heading: 'Droits des personnes',
      placeholder:
        '[À COMPLÉTER — modalités d’exercice des droits d’accès, de rectification, d’effacement, de limitation et d’opposition, et coordonnées du délégué à la protection des données s’il existe]',
    },
  ],
};
