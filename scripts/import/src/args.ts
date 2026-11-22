import type { BlasonOptions } from './blasons';

/** Répertoire des CSV BAN (un fichier par département + un fichier national). */
export const BAN_CSV_DIR = 'https://adresse.data.gouv.fr/data/ban/adresses/latest/csv';
export const DEFAULT_BAN_URL = `${BAN_CSV_DIR}/adresses-france.csv.gz`;

/** Régions importées par défaut en mode `--lite` (Bretagne). */
export const LITE_REGION_CODES: readonly string[] = ['53'];

export interface CliOptions {
  lite: boolean;
  /** `null` = toutes les régions. */
  regionCodes: string[] | null;
  banFile: string | null;
  banUrl: string;
  banUrlProvided: boolean;
  skipGouv: boolean;
  skipBan: boolean;
  ifEmpty: boolean;
  /**
   * Réimport non destructeur : upsert puis élagage des seules lignes qu'aucune
   * carte ne cite. Sans ce drapeau, l'import repart d'un référentiel vide, ce
   * qu'un `TRUNCATE` gardé refuse dès qu'une collection cite une ligne.
   */
  merge: boolean;
  /** Étape atlas seule : ni API Gouv, ni BAN, ni blasons. */
  pathsOnly: boolean;
  /** Recalcule un `path_d` déjà écrit (et réécrit une `geom` déjà acquise). */
  pathsForce: boolean;
  /** Avec `--paths-only` : n'acquiert aucune géométrie, calcule `path_d` depuis `geom`. */
  pathsNoFetch: boolean;
  /** Ne traite que n entités par niveau de l'étape atlas. `null` = toutes. */
  pathsLimit: number | null;
  help: boolean;
}

const USAGE = `Usage : bun run src/index.ts [options]

Options :
  --lite                 Import réduit (Bretagne, code région 53) pour le développement.
  --regions=53,94        Limite l'import API Gouv à ces codes région (séparés par des virgules).
  --ban-file=<chemin>    Utilise un CSV BAN local au lieu de télécharger (gzip accepté).
  --ban-url=<url>        URL du CSV BAN (défaut : ${DEFAULT_BAN_URL}).
  --skip-ban             N'importe que les régions, départements et communes.
  --skip-gouv            N'importe que les odonymes (communes déjà en base).
  --if-empty             Ne fait rien si le référentiel demandé est déjà complet.
  --merge                Réimport non destructeur : met à jour les lignes existantes et
                         n'élague que celles qu'aucune carte ne cite (préserve les collections).
  --paths-only           N'exécute que l'étape atlas (\`geom\` puis \`path_d\`), sans
                         référentiel ni BAN.
  --no-fetch             Avec l'étape atlas : n'acquiert aucune géométrie (aucun appel WFS),
                         calcule seulement \`path_d\` depuis \`geom\`.
  --force                Étape atlas : recalcule \`path_d\` même s'il existe déjà, et réécrit
                         une \`geom\` déjà acquise.
  --limit=<n>            Étape atlas : ne calcule le tracé que pour n entités par niveau ;
                         l'acquisition de la géométrie reste complète (développement).
  --help                 Affiche cette aide.`;

export function parseArgs(argv: readonly string[]): CliOptions {
  const options: CliOptions = {
    lite: false,
    regionCodes: null,
    banFile: null,
    banUrl: DEFAULT_BAN_URL,
    banUrlProvided: false,
    skipGouv: false,
    skipBan: false,
    ifEmpty: false,
    merge: false,
    pathsOnly: false,
    pathsForce: false,
    pathsNoFetch: false,
    pathsLimit: null,
    help: false,
  };

  let explicitRegions: string[] | null = null;

  for (const arg of argv) {
    if (arg === '--lite') {
      options.lite = true;
      continue;
    }
    if (arg === '--skip-ban') {
      options.skipBan = true;
      continue;
    }
    if (arg === '--skip-gouv') {
      options.skipGouv = true;
      continue;
    }
    if (arg === '--if-empty') {
      options.ifEmpty = true;
      continue;
    }
    if (arg === '--merge') {
      options.merge = true;
      continue;
    }
    if (arg === '--paths-only') {
      options.pathsOnly = true;
      continue;
    }
    if (arg === '--no-fetch') {
      options.pathsNoFetch = true;
      continue;
    }
    if (arg === '--force') {
      options.pathsForce = true;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length).trim());
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('--limit attend un entier positif ou nul');
      }
      options.pathsLimit = value;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
      continue;
    }
    if (arg.startsWith('--regions=')) {
      explicitRegions = splitCodes(arg.slice('--regions='.length));
      continue;
    }
    if (arg.startsWith('--ban-file=')) {
      const value = arg.slice('--ban-file='.length).trim();
      if (value.length === 0) throw new Error('--ban-file attend un chemin non vide');
      options.banFile = value;
      continue;
    }
    if (arg.startsWith('--ban-url=')) {
      const value = arg.slice('--ban-url='.length).trim();
      if (value.length === 0) throw new Error('--ban-url attend une URL non vide');
      options.banUrl = value;
      options.banUrlProvided = true;
      continue;
    }
    throw new Error(`Argument inconnu : ${arg}\n\n${USAGE}`);
  }

  if (options.skipBan && options.skipGouv) {
    throw new Error('--skip-ban et --skip-gouv sont incompatibles');
  }

  if (explicitRegions !== null) {
    options.regionCodes = explicitRegions;
  } else if (options.lite) {
    options.regionCodes = [...LITE_REGION_CODES];
  }

  return options;
}

export function usage(): string {
  return USAGE;
}

function splitCodes(raw: string): string[] {
  const codes = raw
    .split(',')
    .map((code) => code.trim())
    .filter((code) => code.length > 0);

  if (codes.length === 0) throw new Error('--regions attend au moins un code région');
  return codes;
}

const BLASONS_USAGE = `Usage : bun run --cwd scripts/import blasons [options]

Options :
  --only=communes|departements|regions   Limite l'import à un niveau (défaut : les trois).
  --limit=<n>           Ne traite que n entités par niveau (développement).
  --contours            Génère les contours IGN pour les communes sans blason.
  --contours-only       Reprise : génère uniquement les contours manquants, sans
                        réimporter les blasons (aucun appel SPARQL/Commons).
  --force               Réécrit les fichiers SVG déjà présents.
  --help                Affiche cette aide.`;

export function parseBlasonArgs(argv: readonly string[]): BlasonOptions {
  const options: BlasonOptions = { contours: false };

  for (const arg of argv) {
    if (arg === '--contours') {
      options.contours = true;
      continue;
    }
    if (arg === '--contours-only') {
      options.contoursOnly = true;
      options.contours = true;
      continue;
    }
    if (arg === '--force') {
      options.force = true;
      continue;
    }
    if (arg.startsWith('--only=')) {
      const value = arg.slice('--only='.length).trim();
      if (value !== 'communes' && value !== 'departements' && value !== 'regions') {
        throw new Error(`--only attend communes, departements ou regions (reçu : ${value})`);
      }
      options.only = value;
      continue;
    }
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.slice('--limit='.length).trim());
      if (!Number.isInteger(value) || value < 0) {
        throw new Error('--limit attend un entier positif ou nul');
      }
      options.limit = value;
      continue;
    }
    throw new Error(`Argument inconnu : ${arg}\n\n${BLASONS_USAGE}`);
  }

  return options;
}

export function blasonsUsage(): string {
  return BLASONS_USAGE;
}
