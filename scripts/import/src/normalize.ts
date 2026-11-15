const LIGATURES: ReadonlyArray<readonly [RegExp, string]> = [
  [/œ/g, 'oe'],
  [/Œ/g, 'OE'],
  [/æ/g, 'ae'],
  [/Æ/g, 'AE'],
  [/ß/g, 'ss'],
];

const DIACRITICS = /[\u0300-\u036f]/g;
const APOSTROPHES = /[\u2018\u2019\u02bc\u0060\u00b4']/g;
const SEPARATORS = /[\u2010-\u2015\-_/.,;:!?()[\]{}"«»#*+]/g;
const INVALID = /[^a-z0-9 ]/g;
const WHITESPACE = /\s+/g;

/**
 * Clé de regroupement d'un odonyme.
 * Minuscules, sans accents ni ligatures, tirets/apostrophes remplacés par des
 * espaces, espaces compactés. `Rue de l'Église-Notre-Dame` et
 * `rue de l eglise notre dame` produisent la même clé.
 */
export function normalizeStreetName(raw: string): string {
  let value = raw;
  for (const [pattern, replacement] of LIGATURES) {
    value = value.replace(pattern, replacement);
  }

  value = value
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(APOSTROPHES, ' ')
    .replace(SEPARATORS, ' ')
    .replace(INVALID, ' ')
    .replace(WHITESPACE, ' ')
    .trim();

  return value;
}

/**
 * Découpe une ligne CSV en respectant les champs entre guillemets.
 * Suffisant pour la BAN (`;`) sans dépendance externe.
 */
export function splitCsvLine(line: string, delimiter = ';'): string[] {
  const fields: string[] = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quoted) {
      if (char === '"') {
        if (line[index + 1] === '"') {
          current += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  fields.push(current);
  return fields;
}

/** Découpe un tableau en morceaux de taille fixe (limite de variables PostgreSQL). */
export function chunkArray<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size <= 0) {
    throw new Error(`Taille de lot invalide : ${size}`);
  }

  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}
