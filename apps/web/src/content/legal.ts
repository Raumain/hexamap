// Contenu des deux documents légaux. Les données d'identité de l'éditeur
// restent des repères nommés, regroupés une seule fois dans `PUBLISHER` : le
// titulaire du site n'a qu'un endroit à compléter. Aucun autre fait n'est
// inventé ici.

export const PUBLISHER = {
  name: 'Thibaud',
  firstName: 'Romain',
  address: 'nd',
  phone: 'nd',
  email: 'nd',
} as const;

// Les deux documents sont rédigés, versionnés et publiés ; cet interrupteur les
// sert ou les retire du site. Aucun bandeau provisoire ne les précède : le texte
// est celui qui engage l'éditeur.
export const LEGAL_PAGES_ENABLED = true;

const CONSUMER_MEDIATOR = '[MÉDIATEUR DE LA CONSOMMATION À COMPLÉTER — nom, adresse et site]';

const LAST_UPDATED = '21 novembre 2026';

const EDITOR = `${PUBLISHER.firstName} ${PUBLISHER.name}`;

export interface LegalSegment {
  readonly heading: string;
  readonly paragraphs: string[];
}

export interface LegalDocument {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly segments: readonly LegalSegment[];
}

// Les deux documents ne sont pas des salles : aucun n'entre dans le rail, et
// `nav-items.ts` n'y gagne aucune entrée. Ce sont des destinations de pied de
// page. La CGV a été retirée de l'interface avec la boutique (retour R-004) :
// elle n'est ni publiée, ni liée, et sa route n'existe plus.
export const LEGAL_LINKS = [
  { to: '/mentions-legales', label: 'Mentions légales' },
  { to: '/confidentialite', label: 'Confidentialité' },
] as const;

export const MENTIONS_LEGALES: LegalDocument = {
  eyebrow: 'Le cabinet · Le Seuil',
  title: 'Mentions légales',
  subtitle: 'Les informations d’identification exigées pour un service en ligne édité en France.',
  segments: [
    {
      heading: 'Éditeur du site',
      paragraphs: [
        `Nom : ${PUBLISHER.name}. Prénoms : ${PUBLISHER.firstName}. L’éditeur est un particulier, éditeur non professionnel du jeu Hexamap.`,
        `Domicile : ${PUBLISHER.address}. Téléphone : ${PUBLISHER.phone}. Adresse électronique : ${PUBLISHER.email}.`,
      ],
    },
    {
      heading: 'Directeur de la publication',
      paragraphs: [
        `Le directeur de la publication est ${EDITOR}, au sens de l’article 93-2 de la loi n° 82-652 du 29 juillet 1982.`,
      ],
    },
    {
      heading: 'Hébergeur',
      paragraphs: [
        'Le service est hébergé par OVH SAS, 2 rue Kellermann, 59100 Roubaix, France, téléphone 1007. Cette mention est imposée par l’article 1-1, I, 4° de la loi n° 2004-575 du 21 juin 2004.',
        'Le nom de domaine est enregistré auprès d’IONOS, qui n’assure pas l’hébergement du service.',
      ],
    },
    {
      heading: 'Stockage de données',
      paragraphs: [
        'L’ensemble des données du service est hébergé sur l’infrastructure d’OVHcloud, dans l’Union européenne.',
        'Le prestataire de paiement Stripe conserve de son côté les données nécessaires à la transaction, en application de l’article 1-1, I, 5° de la même loi.',
      ],
    },
    {
      heading: 'Propriété intellectuelle',
      paragraphs: [
        'Les textes, l’interface, les planches, les gravures, les marques et les éléments graphiques propres à Hexamap appartiennent à l’éditeur. Toute reproduction non autorisée est interdite.',
        'Les éléments issus de sources tierces restent soumis aux licences décrites à la section suivante.',
      ],
    },
    {
      heading: 'Sources de données et attributions',
      paragraphs: [
        'Les données publiques utilisées par Hexamap le sont sous Licence Ouverte 2.0 (Etalab).',
        'La Base Adresse Nationale est produite par l’IGN, La Poste et Etalab ; elle fournit les adresses et les odonymes.',
        'L’INSEE, par l’intermédiaire de geo.api.gouv.fr, fournit les populations légales et les codes officiels géographiques.',
        'IGN Admin Express fournit les contours des régions, des départements et des communes.',
        'Les blasons proviennent de Wikimedia Commons et de Wikidata, sous des licences hétérogènes, le plus souvent CC BY-SA. L’attribution est affichée sur chaque carte.',
        'L’affichage d’une image ne constitue pas une adaptation et n’emporte donc aucune obligation de partage à l’identique sur le site.',
        'Hexamap n’est ni affilié à l’IGN, ni à l’INSEE, ni à Etalab, ni à la Wikimedia Foundation.',
      ],
    },
    {
      heading: 'Nature du service',
      paragraphs: [
        'Hexamap est un jeu de divertissement. Il n’offre aucun gain en argent réel, aucune conversion des écus en euros et aucun mécanisme de pari.',
        'Le ticket à gratter est gratuit et ne peut pas être acheté.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [`Pour toute question relative au service : ${PUBLISHER.email}.`],
    },
    {
      heading: 'Médiation de la consommation',
      paragraphs: [
        `Les conditions de vente et la procédure de réclamation figurent dans les conditions générales de vente. Le médiateur de la consommation compétent est : ${CONSUMER_MEDIATOR}.`,
      ],
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
      heading: 'Qui est responsable du traitement',
      paragraphs: [
        `Hexamap est édité par ${EDITOR}, joignable à ${PUBLISHER.email}. L’éditeur est le responsable du traitement des données décrites ci-dessous.`,
        'Aucun délégué à la protection des données n’a été désigné. Les traitements mis en œuvre ne sont ni réguliers et massifs, ni à grande échelle, et ne portent pas sur des données sensibles : cette désignation ne relève donc d’aucune obligation.',
      ],
    },
    {
      heading: 'Ce qui est collecté',
      paragraphs: [
        'Données de compte : adresse électronique, mot de passe stocké sous forme hachée et jamais lisible en clair, et pseudo.',
        'Données de session : adresse IP, agent utilisateur du navigateur et date d’expiration de la session.',
        'Données de jeu : tickets obtenus, cases révélées, cartes possédées, tableaux composés, annonces déposées sur le marché, lignes du grand-livre des écus et médailles obtenues.',
        'Préférence d’activation du son : conservée dans le navigateur du joueur et jamais transmise au serveur.',
        'Ne sont pas collectés : aucune mesure d’audience, aucun traceur publicitaire, aucune donnée bancaire.',
      ],
    },
    {
      heading: 'Pourquoi ces données',
      paragraphs: [
        'L’exécution du contrat, au sens de l’article 6.1.b du RGPD, couvre le compte, le jeu et les achats.',
        'L’intérêt légitime, au sens de l’article 6.1.f du RGPD, couvre la sécurité du service ainsi que la prévention de la fraude et des abus.',
        'L’obligation légale, au sens de l’article 6.1.c du RGPD, couvre la conservation des pièces comptables.',
      ],
    },
    {
      heading: 'Le paiement',
      paragraphs: [
        'Les paiements sont traités par Stripe Payments Europe, Ltd. Aucun numéro de carte ne transite ni n’est stocké sur les serveurs d’Hexamap.',
        'Stripe agit comme sous-traitant pour l’encaissement des achats effectués dans La Boutique.',
        'Stripe agit également comme responsable de traitement indépendant pour ses propres obligations, notamment la vérification d’identité et la lutte contre le blanchiment.',
      ],
    },
    {
      heading: 'Combien de temps',
      paragraphs: [
        'Le compte et les données de jeu sont supprimés six mois après la dernière connexion. Un courriel d’avertissement est adressé trente jours avant cette suppression.',
        'Les lignes du grand-livre, les factures et les justificatifs d’achat sont conservés dix ans, en application de l’article L. 123-22 du code de commerce, et sont exclus de cette purge.',
        'Les journaux techniques sont conservés au plus quatre-vingt-dix jours.',
      ],
    },
    {
      heading: 'Qui reçoit ces données',
      paragraphs: [
        'OVHcloud héberge le service, dans l’Union européenne. Stripe traite les paiements.',
        'Aucune donnée n’est revendue, louée ou transférée hors de l’Union européenne.',
      ],
    },
    {
      heading: 'Vos droits',
      paragraphs: [
        'Vous disposez des droits d’accès, de rectification, d’effacement, de limitation, d’opposition et de portabilité.',
        `Une demande s’adresse à ${PUBLISHER.email}. Une réponse est apportée dans un délai d’un mois.`,
        'Une réclamation peut être adressée à la CNIL, 3 place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, ou depuis cnil.fr.',
        'La suppression du compte entraîne la perte définitive des cartes, des tickets et des écus qu’il contient.',
      ],
    },
    {
      heading: 'Mineurs',
      paragraphs: [
        'Le service est accessible à partir de quinze ans. En dessous de cet âge, l’inscription suppose l’accord du représentant légal.',
        'L’achat de packs d’écus est réservé aux personnes majeures. À défaut, l’achat doit être effectué par le représentant légal.',
      ],
    },
    {
      heading: 'Sécurité',
      paragraphs: [
        'Les mots de passe sont hachés et les connexions sont chiffrées par HTTPS.',
        'L’accès aux serveurs est restreint, et aucune donnée de carte bancaire n’est stockée par le service.',
      ],
    },
    {
      heading: 'Cookies et stockage local',
      paragraphs: [
        'Un unique cookie de session est déposé. Il est indispensable à l’authentification et porte les attributs HttpOnly, SameSite=Lax et, en production, Secure. Étant strictement nécessaire au service, il ne requiert aucun consentement préalable.',
        'La préférence hexamap.scratch.sound est conservée dans le stockage local du navigateur. Elle ne quitte jamais l’appareil et ne permet aucun suivi.',
        'Aucun autre traceur n’est employé : ni mesure d’audience, ni publicité, ni bouton de réseau social. Aucune bannière de consentement n’est donc nécessaire.',
        'Vous pouvez effacer ce cookie et cette préférence depuis les paramètres de votre navigateur. La session est alors perdue et une reconnexion devient nécessaire.',
      ],
    },
    {
      heading: 'Modifications',
      paragraphs: [
        `Dernière mise à jour : ${LAST_UPDATED}.`,
        'En cas de changement substantiel, cette page est mise à jour et l’information est portée à la connaissance des joueurs.',
      ],
    },
  ],
};
