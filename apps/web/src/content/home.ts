// Vitrine publique du cabinet. Page de présentation rendue hors coquille : elle
// porte son propre en-tête, son `<main>` et son pied. Aucune donnée serveur n'y
// est lue, seuls des exemples figés de planches.

export const HOME_PAGE = {
  brand: 'Hexamap',
  brandTagline: 'Cabinet de cartographie',

  eyebrow: 'Cabinet de cartographie',
  title: 'La France se collectionne, case par case.',
  subtitle:
    'Un ticket à gratter toutes les trente minutes. Seize cases, une Pépite, et des milliers de lieux réels — régions, départements, communes, rues — à réunir en tableaux.',
  primaryCta: 'Ouvrir le cabinet',
  secondaryCta: 'Découvrir la Boutique',
  heroCaption:
    'Gratuit. Aucune installation. Le tirage, la Pépite et les récompenses sont décidés par le serveur, jamais par le navigateur.',
  heroPlates: [
    { type: 'REGION', rarity: 'MYTHIQUE', name: 'Bretagne', score: 3500, refCode: '53' },
    { type: 'DEPARTEMENT', rarity: 'EPIQUE', name: 'Finistère', score: 1250, refCode: '29' },
    { type: 'COMMUNE', rarity: 'LEGENDAIRE', name: 'Quimper', score: 2450, refCode: '29232' },
    { type: 'RUE', rarity: 'RARE', name: 'Rue des Écoles', score: 1000, refCode: '—' },
  ],

  gestureEyebrow: 'Salle I · Le Relevé',
  gestureTitle: 'Le Relevé Topographique',
  gestureSubtitle:
    'Une grille de seize cases, quatre coups de grattoir, et une Pépite qui ne dit jamais où elle se cache.',
  gestureSteps: [
    {
      title: 'Quatre coups de grattoir',
      body: 'La grille compte seize cases et quatre coups au départ. Une case est déjà ouverte à l’arrivée, avec son panneau kilométrique.',
    },
    {
      title: 'La Pépite',
      body: 'Une carte garantie Rare ou mieux dort sous la grille. Chaque case révélée annonce la distance de Manhattan qui vous en sépare.',
    },
    {
      title: 'Les Panneaux',
      body: 'Station-Service rend deux coups. Belvédère découvre une case voisine. Rénovation élève la rareté de la prochaine carte.',
    },
    {
      title: 'Le carnet de charges',
      body: 'Six tickets en réserve, une charge rendue toutes les trente minutes. Au plafond, le carnet se fige : rien ne s’accumule, rien ne se perd.',
    },
  ],

  categoriesEyebrow: 'Le barème · Les quatre catégories',
  categoriesTitle: 'Quatre façons de tenir un territoire',
  categories: [
    {
      type: 'REGION',
      title: 'Les 18 régions',
      body: 'Chaque région tombe dans une édition de rareté, du gris au rouge.',
      detail: '200 à 3 500 points selon l’édition',
    },
    {
      type: 'DEPARTEMENT',
      title: 'Les 101 départements',
      body: 'Même échelle d’éditions, avec un léger bonus de population.',
      detail: '200 à 3 500 points, bonus compris',
    },
    {
      type: 'COMMUNE',
      title: 'Près de 34 900 communes',
      body: 'La rareté suit la population municipale de l’INSEE.',
      detail: '400 points pour un hameau, 3 600 pour une métropole',
    },
    {
      type: 'RUE',
      title: 'Environ 450 000 odonymes',
      body: 'La rareté est inversée : un nom de voie unique vaut plus qu’un boulevard.',
      detail: '3 000 points si une seule commune la porte',
    },
  ],

  synergyEyebrow: 'Salle III · La Planche',
  synergyTitle: 'Quatre cartes, un seul territoire',
  synergyBody:
    'Un tableau expose une région, un département, une commune et une rue. Chaque lien géographique réel est vérifié par le serveur, puis multiplie le total.',
  synergyLinks: [
    'La région contient le département',
    'Le département contient la commune',
    'La commune possède réellement cette rue',
  ],
  synergyMultipliers: [
    { links: '0 lien', value: '×1,0' },
    { links: '1 lien', value: '×1,5' },
    { links: '2 liens', value: '×2,5' },
    { links: '3 liens', value: '×5,0' },
  ],
  synergyNote:
    'Aucun multiplicateur n’est calculé dans le navigateur : l’alignement vient du serveur, à la lecture comme à la soumission.',

  metalsEyebrow: 'Le barème · Les six métaux',
  metalsTitle: 'Six métaux, six raretés',
  metalsBody:
    'La rareté se lit au métal du cadre et au libellé, jamais à la couleur seule. Les poids ci-dessous sont ceux du tirage.',

  shopTitle: 'Les écus',
  shopBody:
    'La monnaie du cabinet. Elle s’obtient par les médailles — jamais par le hasard — ou s’achète en packs, du plus petit au plus généreux.',
  shopCta: 'Voir les packs',

  footerTagline: 'Cabinet de cartographie',
  footerSources:
    'Sources : Etalab (Licence Ouverte 2.0), Base Adresse Nationale, INSEE, IGN, Wikimedia Commons.',
  footerLegalLabel: 'Informations légales',
  footerCta: 'Revenir à l’accueil',
} as const;
