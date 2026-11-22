/**
 * Validation du pseudo — identité publique du joueur
 * (`.docs/01-architecture.md` §2.9).
 *
 * Le pseudo est l'adresse lisible du joueur dans les relations et la vitrine ;
 * la vitrine `/players/:id` se lit par identifiant de compte, jamais par pseudo.
 * Il est donc validé **une seule fois ici**, par le hook d'inscription de
 * Better Auth et par la route de changement. Aucune autre copie de ces bornes
 * ne doit exister.
 */

export const PSEUDO_MIN_LENGTH = 3;
export const PSEUDO_MAX_LENGTH = 24;

export type PseudoProblem = 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS';

export type PseudoValidation = { ok: true; pseudo: string } | { ok: false; problem: PseudoProblem };

/**
 * Lettres Unicode (accents compris), chiffres, tiret et trait de soulignement.
 * Aucun espace, aucune ponctuation, aucun symbole.
 */
const ALLOWED_PSEUDO = /^[\p{L}\p{N}_-]+$/u;

/** Le trim est la seule normalisation : la casse reste une décision du joueur. */
export function normalizePseudo(raw: string): string {
  return raw.trim();
}

export function validatePseudo(raw: string): PseudoValidation {
  const pseudo = normalizePseudo(raw);

  if (pseudo.length < PSEUDO_MIN_LENGTH) {
    return { ok: false, problem: 'TOO_SHORT' };
  }
  if (pseudo.length > PSEUDO_MAX_LENGTH) {
    return { ok: false, problem: 'TOO_LONG' };
  }
  if (!ALLOWED_PSEUDO.test(pseudo)) {
    return { ok: false, problem: 'INVALID_CHARACTERS' };
  }

  return { ok: true, pseudo };
}

export function pseudoErrorMessage(problem: PseudoProblem): string {
  switch (problem) {
    case 'TOO_SHORT':
      return `Le pseudo doit contenir au moins ${PSEUDO_MIN_LENGTH} caractères.`;
    case 'TOO_LONG':
      return `Le pseudo ne peut pas dépasser ${PSEUDO_MAX_LENGTH} caractères.`;
    case 'INVALID_CHARACTERS':
      return 'Le pseudo ne peut contenir que des lettres, des chiffres, des tirets et des traits de soulignement.';
  }
}
