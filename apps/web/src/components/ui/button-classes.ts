/**
 * Les deux boutons du cabinet, partagés par Le Cartel et La Vitrine.
 *
 * Le Cadastre, Le Comptoir et Mes Offres gardent leurs variantes locales : leurs
 * lignes de registre et de lot mesurent leur hauteur, et les aligner sur la cible
 * tactile de 44 px est un travail de mise en page qui n'appartient pas à cette
 * salle. Ce module existe pour qu'une salle neuve n'ajoute pas une cinquième
 * copie de la même chaîne.
 */
export const primaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] border border-brass bg-brass px-5 font-mono text-[10px] uppercase tracking-[0.16em] text-cabinet shadow-brass transition-colors duration-150 hover:bg-brass-pale active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60';

export const outlineButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-[2px] border border-brass/50 px-4 font-mono text-[10px] uppercase tracking-[0.14em] text-brass transition-colors duration-150 hover:border-brass hover:text-brass-pale disabled:cursor-not-allowed disabled:opacity-40';
