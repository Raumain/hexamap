/**
 * Constantes du compte (`.docs/01-architecture.md` §4.4).
 *
 * La longueur minimale du mot de passe est une seule décision : Better Auth la
 * tolère absente, la route la refuse et l'interface l'affiche. Une seule copie
 * pour que les trois ne divergent pas.
 */
export const PASSWORD_MIN_LENGTH = 8;
