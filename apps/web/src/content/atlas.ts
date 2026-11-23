const PERCENT_FORMAT = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Espace fine insécable : « 12,4 % » ne se coupe jamais avant son signe. */
const NARROW_NO_BREAK_SPACE = '\u202f';

export const ATLAS_ROOM = {
  eyebrow: 'LE GRAND LEVÉ',
  title: "L'Atlas",
  subtitle:
    'La carte se dessine depuis vos propres cartes, et la descente est guidée : de la France entière au département, puis à la commune.',
  legendFill: 'Remplissage vert : part des communes couvertes de chaque département.',
  legendFillet: 'Filet de laiton : carte de Région ou de Département possédée.',
  legendContour: 'Contour clair : limite de région ; contour vert : commune possédée.',
  nationalTitle: 'La France entière',
  tableCaption: 'Table équivalente de la carte',
  columnEntity: 'Entité',
  columnState: 'Possession',
  columnCoverage: 'Couverture',
  possessed: 'Possédée',
  missing: 'Manquante',
  cadastreLink: 'Cadastre',
  openDepartment: 'Ouvrir les communes de ',
  openCommune: 'Voir la commune au Cadastre : ',
  openDepartmentAtCadastre: 'Voir les cartes au Cadastre : ',
  backToNational: 'Revenir à la France entière',
  loadingSession: 'Chargement de votre session…',
  loadingSummary: 'Chargement de la carte…',
  loadingDepartement: 'Chargement des communes…',
  retry: 'Réessayer',
  emptyNational: 'Aucun contour n’est disponible : le référentiel de la carte est vide.',
  emptyDepartement: 'Aucune commune de ce département n’est référencée dans l’atlas.',
  copies: (n: number) => (n === 1 ? '1 exemplaire' : `${n} exemplaires`),
} as const;

export function coveragePercent(owned: number, total: number): string {
  const value = total > 0 ? (owned / total) * 100 : 0;
  return `${PERCENT_FORMAT.format(value)}${NARROW_NO_BREAK_SPACE}%`;
}

export function nationalSummary(regions: number, departements: number): string {
  const regionLabel = regions > 1 ? 'régions' : 'région';
  const departementLabel = departements > 1 ? 'départements' : 'département';
  return `Niveau national : ${regions} ${regionLabel} et ${departements} ${departementLabel}.`;
}

export function departementSummary(nom: string, communes: number, owned: number): string {
  const communeLabel = communes > 1 ? 'communes' : 'commune';
  const ownedLabel = owned > 1 ? 'couvertes' : 'couverte';
  return `Département ${nom} : ${communes} ${communeLabel}, ${owned} ${ownedLabel}.`;
}
