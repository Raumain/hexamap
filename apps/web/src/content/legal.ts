// Contenu des trois documents légaux. Les données d'identité de l'éditeur
// restent des repères nommés, regroupés une seule fois dans `PUBLISHER` : le
// titulaire du site n'a qu'un endroit à compléter. Aucun autre fait n'est
// inventé ici.

export const PUBLISHER = {
  name: '[NOM À COMPLÉTER]',
  firstName: '[PRÉNOM À COMPLÉTER]',
  address: '[ADRESSE À COMPLÉTER]',
  phone: '[TÉLÉPHONE À COMPLÉTER]',
  email: '[ADRESSE ÉLECTRONIQUE À COMPLÉTER]',
  siren: '[SIREN À COMPLÉTER]',
} as const;

// Les trois documents restent rédigés et versionnés ; cet interrupteur les retire
// du site tant que l'identité de l'éditeur (SIREN, domicile, téléphone) n'est pas
// renseignée. Le repasser à `true` suffit à les rallumer.
export const LEGAL_PAGES_ENABLED = false;

const CONSUMER_MEDIATOR = '[MÉDIATEUR DE LA CONSOMMATION À COMPLÉTER — nom, adresse et site]';

const LAST_UPDATED = '21 novembre 2026';

const EDITOR = `${PUBLISHER.firstName} ${PUBLISHER.name}`;

export const LEGAL_BANNER =
  'Texte provisoire — les mentions d’identité (nom, prénoms, domicile, téléphone, SIREN) seront complétées à l’immatriculation de l’éditeur, avant la mise en vente.';

export interface LegalSegment {
  readonly heading: string;
  readonly paragraphs: string[];
}

export interface LegalDocument {
  readonly eyebrow: string;
  readonly title: string;
  readonly subtitle: string;
  readonly banner?: string;
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
  banner: LEGAL_BANNER,
  segments: [
    {
      heading: 'Objet et champ d’application',
      paragraphs: [
        'Les présentes conditions générales régissent l’achat de packs d’écus auprès de l’éditeur d’Hexamap, dans La Boutique du jeu. Elles s’appliquent à toute personne qui passe une commande depuis un compte Hexamap.',
        'Le jeu est intégralement jouable sans rien acheter. Les tickets à gratter sont gratuits et restent la seule source de cartes : aucun ticket n’est vendu, et l’achat d’écus ne donne accès qu’à la monnaie interne du jeu.',
        'Les présentes conditions ne régissent pas les transactions que les joueurs concluent entre eux sur le marché. Ces transactions portent sur des écus déjà détenus et ne donnent lieu à aucun paiement en euros.',
      ],
    },
    {
      heading: 'Identité du vendeur',
      paragraphs: [
        `Le vendeur est ${EDITOR}, agissant en qualité de micro-entrepreneur.`,
        `Domicile : ${PUBLISHER.address}. Téléphone : ${PUBLISHER.phone}. Adresse électronique : ${PUBLISHER.email}. Numéro d’immatriculation (SIREN) : ${PUBLISHER.siren}.`,
        'TVA non applicable, article 293 B du CGI.',
      ],
    },
    {
      heading: 'Prix',
      paragraphs: [
        'Les prix sont indiqués en euros, toutes taxes comprises, avant la validation du paiement. Le prix applicable est celui affiché au moment de la commande.',
        'Le vendeur peut modifier ses prix à tout moment. Une modification ne remet pas en cause une commande déjà payée.',
      ],
    },
    {
      heading: 'Commande',
      paragraphs: [
        'L’acheteur choisit un pack d’écus, puis est redirigé vers la page de paiement sécurisée de Stripe pour régler par carte bancaire.',
        'La commande n’est formée qu’à l’encaissement effectif du paiement. Un paiement resté en attente ne crédite aucun écu et ne crée aucune obligation de livraison.',
      ],
    },
    {
      heading: 'Livraison des écus',
      paragraphs: [
        'Les écus sont crédités immédiatement sur le compte du joueur après confirmation de l’encaissement par le prestataire de paiement. La livraison ne comporte aucun support physique.',
        `Si un incident technique empêche le crédit après un encaissement, l’acheteur écrit à ${PUBLISHER.email} et le crédit est régularisé.`,
      ],
    },
    {
      heading: 'Droit de rétractation',
      paragraphs: [
        'Le délai légal de rétractation est de quatorze jours.',
        'Les écus constituent un contenu numérique fourni immédiatement. En validant le paiement, l’acheteur renonce expressément à son droit de rétractation, conformément à l’article L. 221-28, 13° du code de la consommation. Ce renoncement est recueilli et mentionné au moment du paiement.',
        `L’acheteur peut néanmoins demander l’annulation d’un achat avant d’avoir utilisé les écus achetés, en écrivant à ${PUBLISHER.email}. La demande est alors étudiée gratuitement.`,
      ],
    },
    {
      heading: 'Nature des écus',
      paragraphs: [
        'L’écu est la monnaie interne du jeu. Il n’a aucune valeur monétaire, n’est pas convertible en euros et n’est pas remboursable en numéraire. Il ne peut pas être transféré hors du jeu.',
        'Les écus ne constituent ni un titre financier, ni un avoir, ni un dépôt.',
      ],
    },
    {
      heading: 'Compte et usage',
      paragraphs: [
        'Un compte correspond à une personne. L’usage du compte est strictement personnel.',
        'Il est interdit de revendre des écus ou un compte contre de l’argent réel en dehors du jeu, comme de recourir à une manipulation technique du service.',
        'Un manquement peut être sanctionné de façon proportionnée : avertissement, suspension ou fermeture du compte. En cas de fermeture pour manquement, les écus non dépensés sont perdus, sans remboursement.',
      ],
    },
    {
      heading: 'Garanties légales',
      paragraphs: [
        'L’acheteur bénéficie de la garantie légale de conformité prévue aux articles L. 217-3 et suivants du code de la consommation, ainsi que de la garantie des vices cachés prévue aux articles 1641 et suivants du code civil.',
        'Ces garanties s’appliquent indépendamment de toute garantie commerciale qui serait consentie en plus.',
      ],
    },
    {
      heading: 'Réclamations et médiation',
      paragraphs: [
        `Toute réclamation s’adresse par écrit à ${PUBLISHER.email}. Une réponse est apportée sous quinze jours.`,
        `À défaut de solution amiable, l’acheteur peut recourir gratuitement au médiateur de la consommation : ${CONSUMER_MEDIATOR}. Ce recours suppose une réclamation écrite préalable auprès du vendeur. Les conditions et modalités de saisine sont celles publiées par le médiateur.`,
      ],
    },
    {
      heading: 'Droit applicable et litiges',
      paragraphs: [
        'Les présentes conditions sont soumises au droit français. En cas de litige, les parties recherchent d’abord une solution amiable avant toute action.',
        'À défaut d’accord, le litige relève de la juridiction compétente de droit commun. Lorsque l’acheteur est un consommateur, les règles de compétence qui le protègent restent applicables.',
      ],
    },
    {
      heading: 'Modifications',
      paragraphs: [
        `Dernière mise à jour : ${LAST_UPDATED}.`,
        'Les conditions applicables à une commande sont celles en vigueur au jour de cette commande.',
      ],
    },
  ],
};

export const MENTIONS_LEGALES: LegalDocument = {
  eyebrow: 'Le cabinet · Le Seuil',
  title: 'Mentions légales',
  subtitle: 'Les informations d’identification exigées pour un service en ligne édité en France.',
  banner: LEGAL_BANNER,
  segments: [
    {
      heading: 'Éditeur du site',
      paragraphs: [
        `Nom : ${PUBLISHER.name}. Prénoms : ${PUBLISHER.firstName}. L’éditeur agit en qualité de micro-entrepreneur.`,
        `Domicile : ${PUBLISHER.address}. Téléphone : ${PUBLISHER.phone}. Adresse électronique : ${PUBLISHER.email}.`,
        `Numéro d’immatriculation (SIREN) : ${PUBLISHER.siren}. TVA non applicable, article 293 B du CGI.`,
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
