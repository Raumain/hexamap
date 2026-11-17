import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { sanitizeSvg } from './blasons';

const DEFAULT_BLASONS_DIR = '/data/blasons';

/** Répertoires réparés, relatifs à `BLASONS_DIR`. Les `.webp` ne sont jamais touchés. */
const SVG_DIRECTORIES = [
  'communes',
  'departements',
  'regions',
  'contours/communes',
  'contours/departements',
  'contours/regions',
] as const;

const REPAIR_CONCURRENCY = 8;
const PROGRESS_EVERY = 2_000;
/** Côté maximal du rendu de validation : assez pour parser, trop petit pour saturer la mémoire. */
const VALIDATION_SIZE = 256;
/** Longueur maximale du message sharp conservé dans le rapport. */
const MAX_ERROR_LENGTH = 200;

interface RepairReport {
  total: number;
  modified: number;
  unchanged: number;
  invalid: number;
  invalidPaths: string[];
  errors: string[];
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

/** Liste les `.svg` d'un répertoire ; un répertoire absent n'est pas une erreur. */
async function listSvgs(dir: string): Promise<string[]> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.svg'))
      .map((entry) => join(dir, entry.name))
      .sort();
  } catch (error) {
    if (errorCode(error) === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Taille de rendu respectant le ratio du `viewBox` : un `resize` en largeur
 * seule multiplierait la hauteur d'un blason très étroit au-delà de la limite
 * de 32 767 px de sharp.
 */
function validationSize(content: string): { width: number; height: number } {
  const match = content.match(/viewBox\s*=\s*"([^"]+)"/);
  if (match !== null) {
    const parts = (match[1] ?? '')
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    const width = parts[2];
    const height = parts[3];
    if (
      width !== undefined &&
      height !== undefined &&
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width > 0 &&
      height > 0
    ) {
      const scale = VALIDATION_SIZE / Math.max(width, height);
      return {
        width: Math.max(1, Math.round(width * scale)),
        height: Math.max(1, Math.round(height * scale)),
      };
    }
  }
  return { width: VALIDATION_SIZE, height: VALIDATION_SIZE };
}

/**
 * `sharp` est le seul validateur SVG disponible : un document non well-formed
 * fait échouer son parseur, alors qu'il n'existe pas de `DOMParser` sous Bun.
 * Retourne `null` quand le rendu passe, sinon le message d'erreur du décodeur.
 */
async function svgDecodeError(content: string): Promise<string | null> {
  try {
    // `limitInputPixels: false` : certains blasons déclarent 19 500 × 25 000 px,
    // au-delà de la limite par défaut, sans être invalides pour autant.
    await sharp(Buffer.from(content, 'utf8'), { limitInputPixels: false })
      .resize({ ...validationSize(content), fit: 'fill' })
      .png()
      .toBuffer();
    return null;
  } catch (error) {
    return errorText(error).replace(/\s+/g, ' ').trim().slice(0, MAX_ERROR_LENGTH);
  }
}

async function repairFile(path: string, report: RepairReport): Promise<void> {
  const raw = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '');
  const sanitized = sanitizeSvg(raw);
  const content = sanitized ?? raw;

  if (sanitized !== null && sanitized !== raw) {
    await writeFile(path, sanitized, 'utf8');
    report.modified += 1;
  } else {
    report.unchanged += 1;
  }

  const decodeError = await svgDecodeError(content);
  if (decodeError !== null) {
    report.invalid += 1;
    report.invalidPaths.push(`${path} — ${decodeError}`);
  }
}

async function runPool<T>(
  items: readonly T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  const queue = [...items];
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    for (;;) {
      const item = queue.shift();
      if (item === undefined) return;
      await worker(item);
      index += 1;
      if (index % PROGRESS_EVERY === 0) {
        console.log(`[repair] ${index.toLocaleString('fr-FR')} fichiers examinés`);
      }
    }
  });
  await Promise.all(workers);
}

async function main(): Promise<number> {
  const blasonsDir = process.env.BLASONS_DIR?.trim() || DEFAULT_BLASONS_DIR;
  const startedAt = performance.now();
  const report: RepairReport = {
    total: 0,
    modified: 0,
    unchanged: 0,
    invalid: 0,
    invalidPaths: [],
    errors: [],
  };

  const files: string[] = [];
  for (const relative of SVG_DIRECTORIES) {
    files.push(...(await listSvgs(join(blasonsDir, relative))));
  }
  report.total = files.length;

  console.log(`[repair] ${report.total.toLocaleString('fr-FR')} SVG dans ${blasonsDir}`);

  await runPool(
    files,
    async (path) => {
      try {
        await repairFile(path, report);
      } catch (error) {
        report.errors.push(`${path} — ${errorText(error)}`);
      }
    },
    REPAIR_CONCURRENCY,
  );

  for (const path of report.invalidPaths) {
    console.log(`[repair] invalide après réparation — ${path}`);
  }
  for (const detail of report.errors) {
    console.log(`[repair] erreur — ${detail}`);
  }

  const durationMs = Math.round(performance.now() - startedAt);
  console.log(
    `[repair] terminé — total : ${report.total.toLocaleString('fr-FR')} · ` +
      `modifiés : ${report.modified.toLocaleString('fr-FR')} · ` +
      `inchangés : ${report.unchanged.toLocaleString('fr-FR')} · ` +
      `invalides après réparation : ${report.invalid.toLocaleString('fr-FR')} · ` +
      `erreurs : ${report.errors.length.toLocaleString('fr-FR')} · ` +
      `durée : ${(durationMs / 1000).toFixed(1)} s`,
  );

  return report.invalid === 0 && report.errors.length === 0 ? 0 : 1;
}

process.exit(await main());
