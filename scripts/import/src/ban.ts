import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { normalizeStreetName, splitCsvLine } from './normalize';

export interface BanSource {
  kind: 'file' | 'url';
  location: string;
  gzip: boolean;
}

export interface BanStats {
  lines: number;
  keptRows: number;
  unknownCommunes: number;
  emptyStreets: number;
}

export interface BanCollectResult {
  /** `nom_voie_normalise` → ensemble des codes INSEE. */
  odonymeCommunes: Map<string, Set<string>>;
  /** `nom_voie_normalise` → premier libellé rencontré (nom d'affichage). */
  odonymeAffichage: Map<string, string>;
  stats: BanStats;
}

interface CollectOptions {
  sources: readonly BanSource[];
  communeCodes: ReadonlySet<string>;
  progressEvery?: number;
  onProgress?: (stats: BanStats, uniqueOdonymes: number) => void;
}

const REQUIRED_COLUMNS = ['nom_voie', 'code_insee'] as const;

async function openStream(source: BanSource): Promise<Readable> {
  let stream: Readable;

  if (source.kind === 'file') {
    stream = createReadStream(source.location);
  } else {
    const response = await fetch(source.location);
    if (!response.ok || response.body === null) {
      throw new Error(`Téléchargement BAN échoué : HTTP ${response.status} ${response.statusText}`);
    }
    stream = Readable.fromWeb(response.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
  }

  return source.gzip ? stream.pipe(createGunzip()) : stream;
}

async function* readLines(stream: Readable): AsyncGenerator<string> {
  const reader = createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  try {
    for await (const line of reader) {
      yield line;
    }
  } finally {
    reader.close();
  }
}

function locateColumns(header: readonly string[]): { street: number; commune: number } {
  const normalizedHeader = header.map((column) => column.trim().toLowerCase());
  const street = normalizedHeader.indexOf(REQUIRED_COLUMNS[0]);
  const commune = normalizedHeader.indexOf(REQUIRED_COLUMNS[1]);

  if (street === -1 || commune === -1) {
    throw new Error(
      `En-tête CSV BAN invalide : colonnes ${REQUIRED_COLUMNS.join(', ')} introuvables`,
    );
  }
  return { street, commune };
}

/**
 * Lit un ou plusieurs CSV BAN en streaming et regroupe les odonymes par nom
 * normalisé. Aucune ligne complète n'est conservée : seule la Map de
 * regroupement reste en RAM.
 */
export async function collectOdonymes(options: CollectOptions): Promise<BanCollectResult> {
  const { sources, communeCodes } = options;
  const progressEvery = options.progressEvery ?? 250_000;

  if (sources.length === 0) {
    throw new Error('Aucune source BAN fournie');
  }

  const odonymeCommunes = new Map<string, Set<string>>();
  const odonymeAffichage = new Map<string, string>();
  const stats: BanStats = { lines: 0, keptRows: 0, unknownCommunes: 0, emptyStreets: 0 };

  for (const source of sources) {
    const stream = await openStream(source);
    let columns: { street: number; commune: number } | null = null;

    for await (const rawLine of readLines(stream)) {
      stats.lines += 1;
      if (stats.lines % progressEvery === 0) {
        options.onProgress?.(stats, odonymeCommunes.size);
      }

      const line = rawLine.replace(/\r$/, '');
      if (line.length === 0) continue;

      const fields = splitCsvLine(line);
      if (columns === null) {
        columns = locateColumns(fields);
        continue;
      }

      const codeInsee = fields[columns.commune]?.trim() ?? '';
      if (codeInsee.length === 0 || !communeCodes.has(codeInsee)) {
        stats.unknownCommunes += 1;
        continue;
      }

      const nomVoie = fields[columns.street]?.trim() ?? '';
      if (nomVoie.length === 0) {
        stats.emptyStreets += 1;
        continue;
      }

      const key = normalizeStreetName(nomVoie);
      if (key.length === 0) {
        stats.emptyStreets += 1;
        continue;
      }

      stats.keptRows += 1;

      const existing = odonymeCommunes.get(key);
      if (existing === undefined) {
        odonymeCommunes.set(key, new Set([codeInsee]));
        odonymeAffichage.set(key, nomVoie);
        continue;
      }

      existing.add(codeInsee);
    }

    if (columns === null) {
      throw new Error(`Fichier BAN vide ou sans en-tête : ${source.location}`);
    }
  }

  options.onProgress?.(stats, odonymeCommunes.size);
  return { odonymeCommunes, odonymeAffichage, stats };
}
