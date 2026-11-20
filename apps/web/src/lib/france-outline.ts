/**
 * La silhouette schématique de la France métropolitaine, pour la salle
 * « L'Assemblage » (aperçu d'une fonction V2).
 *
 * Ce tracé est **volontairement** une esquisse : quelques pixels d'écart avec le
 * trait de côte ne se voient pas sur un aperçu, et un teaser n'a pas à peser un
 * référentiel géographique. La V2 remplacera ce module par la géométrie importée
 * des tables `ref_*` (ROADMAP.md §2.C), jamais par un appel réseau au rendu :
 * aucune API externe n'est joignable à l'exécution. Ne pas « corriger » ce tracé
 * en ajoutant un `fetch` de GeoJSON.
 *
 * Module pur : aucun import de React, aucun état, aucune date, aucun aléatoire.
 */

export const FRANCE_VIEWBOX = '0 0 1000 1000';

export const FRANCE_MAINLAND_PATH =
  'M558 81L523 87L507 107L507 150L472 173L407 209L383 227L292 196L293 264L265 279L197 268L101 301L85 330L127 344L175 354L216 362L253 393L281 458L323 487L331 532L322 612L296 710L282 720L367 758L440 773L493 783L540 796L587 796L603 796L603 775L600 735L647 717L660 700L707 712L757 725L795 740L843 727L885 692L900 685L867 642L860 567L857 514L810 483L800 450L906 368L917 285L947 252L930 248L870 241L823 211L784 207L729 192L721 153L664 143L604 114Z';

export const FRANCE_CORSICA_PATH =
  'M930 790L945 800L952 835L948 870L935 885L918 878L905 855L902 825L912 800Z';
