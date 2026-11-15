import type { Database, Rarity } from '@hexamap/db';
import { rueRarity, rueScore } from '@hexamap/shared';
import type { Kysely } from 'kysely';
import { BAN_CSV_DIR, parseArgs, usage } from './args';
import { type BanCollectResult, type BanSource, type BanStats, collectOdonymes } from './ban';
import {
  connectDatabase,
  INSERT_CHUNK_SIZE,
  readCommuneCodes,
  readDepartementCodes,
  referenceDataCounts,
  truncateOdonymeTables,
  truncateReferenceTables,
} from './db';
import {
  loadGouvReferenceData,
  type RefCommuneRow,
  type RefDepartementRow,
  type RefRegionRow,
  randomDrawBucket,
} from './gouv';
import { chunkArray } from './normalize';

function log(message: string): void {
  console.log(`[import] ${message}`);
}

function logStats(stats: BanStats, uniqueOdonymes: number): void {
  log(
    `BAN — ${stats.lines.toLocaleString('fr-FR')} lignes lues · ` +
      `${stats.keptRows.toLocaleString('fr-FR')} retenues · ` +
      `${uniqueOdonymes.toLocaleString('fr-FR')} odonymes uniques`,
  );
}

async function insertRegions(db: Kysely<Database>, rows: readonly RefRegionRow[]): Promise<void> {
  for (const chunk of chunkArray(rows, INSERT_CHUNK_SIZE)) {
    await db.insertInto('ref_regions').values(chunk).execute();
  }
}

async function insertDepartements(
  db: Kysely<Database>,
  rows: readonly RefDepartementRow[],
): Promise<void> {
  for (const chunk of chunkArray(rows, INSERT_CHUNK_SIZE)) {
    await db.insertInto('ref_departements').values(chunk).execute();
  }
}

async function insertCommunes(db: Kysely<Database>, rows: readonly RefCommuneRow[]): Promise<void> {
  for (const chunk of chunkArray(rows, INSERT_CHUNK_SIZE)) {
    await db.insertInto('ref_communes').values(chunk).execute();
  }
}

interface OdonymeInsert {
  nom_normalise: string;
  nom_affichage: string;
  nb_communes: number;
  rarete: Rarity;
  score_base: number;
  draw_bucket: number;
}

interface OdonymeLinkInsert {
  code_insee: string;
  odonyme_id: string;
}

interface OdonymeInsertResult {
  odonymes: number;
  links: number;
}

async function insertOdonymes(
  db: Kysely<Database>,
  collected: BanCollectResult,
): Promise<OdonymeInsertResult> {
  const keys = [...collected.odonymeCommunes.keys()];
  const result: OdonymeInsertResult = { odonymes: 0, links: 0 };

  for (const keyChunk of chunkArray(keys, INSERT_CHUNK_SIZE)) {
    const values: OdonymeInsert[] = [];

    for (const key of keyChunk) {
      const communes = collected.odonymeCommunes.get(key);
      if (communes === undefined || communes.size === 0) continue;

      const nbCommunes = communes.size;
      values.push({
        nom_normalise: key,
        nom_affichage: collected.odonymeAffichage.get(key) ?? key,
        nb_communes: nbCommunes,
        rarete: rueRarity(nbCommunes),
        score_base: rueScore(nbCommunes),
        draw_bucket: randomDrawBucket(),
      });
    }

    if (values.length === 0) continue;

    const inserted = await db
      .insertInto('ref_odonymes')
      .values(values)
      .returning(['id', 'nom_normalise'])
      .execute();

    result.odonymes += inserted.length;

    const idByKey = new Map<string, string>();
    for (const row of inserted) {
      idByKey.set(row.nom_normalise, row.id);
    }

    const links: OdonymeLinkInsert[] = [];
    for (const [key, odonymeId] of idByKey) {
      const communes = collected.odonymeCommunes.get(key);
      if (communes === undefined) continue;
      for (const codeInsee of communes) {
        links.push({ code_insee: codeInsee, odonyme_id: odonymeId });
      }
    }

    for (const linkChunk of chunkArray(links, INSERT_CHUNK_SIZE)) {
      await db.insertInto('commune_odonymes').values(linkChunk).execute();
      result.links += linkChunk.length;
    }

    log(
      `Odonymes — ${result.odonymes.toLocaleString('fr-FR')} insérés · ` +
        `${result.links.toLocaleString('fr-FR')} liens commune↔odonyme`,
    );
  }

  return result;
}

function resolveBanSources(
  options: ReturnType<typeof parseArgs>,
  departementCodes: readonly string[],
): BanSource[] {
  if (options.banFile !== null) {
    return [{ kind: 'file', location: options.banFile, gzip: options.banFile.endsWith('.gz') }];
  }

  if (options.banUrlProvided || options.regionCodes === null) {
    return [{ kind: 'url', location: options.banUrl, gzip: options.banUrl.endsWith('.gz') }];
  }

  // Mode `--lite` / `--regions` : un CSV BAN par département, au lieu du fichier national.
  if (departementCodes.length === 0) {
    throw new Error('Aucun département à importer : le référentiel de communes est vide');
  }

  return departementCodes.map((code) => ({
    kind: 'url' as const,
    location: `${BAN_CSV_DIR}/adresses-${code}.csv.gz`,
    gzip: true,
  }));
}

export async function main(argv: readonly string[]): Promise<void> {
  const startedAt = performance.now();
  const options = parseArgs(argv);

  if (options.help) {
    console.log(usage());
    return;
  }

  log(
    `Mode ${options.lite ? 'lite' : 'complet'}` +
      ` · régions : ${options.regionCodes?.join(', ') ?? 'toutes'}` +
      ` · API Gouv : ${options.skipGouv ? 'ignorée' : 'activée'}` +
      ` · BAN : ${options.skipBan ? 'ignorée' : 'activée'}`,
  );

  const db = connectDatabase();

  try {
    if (options.ifEmpty) {
      const counts = await referenceDataCounts(db);
      const needsOdonymes = !options.skipBan;
      const alreadyComplete = counts.communes > 0 && (!needsOdonymes || counts.odonymes > 0);

      if (alreadyComplete) {
        log(
          `Référentiel déjà présent (${counts.communes.toLocaleString('fr-FR')} communes · ` +
            `${counts.odonymes.toLocaleString('fr-FR')} odonymes) — import ignoré (--if-empty)`,
        );
        return;
      }

      log(
        `Référentiel incomplet (${counts.communes.toLocaleString('fr-FR')} communes · ` +
          `${counts.odonymes.toLocaleString('fr-FR')} odonymes) — import lancé`,
      );
    }

    if (options.skipGouv) {
      await truncateOdonymeTables(db);
    } else {
      await truncateReferenceTables(db);
      log('Tables de référence vidées (TRUNCATE ... RESTART IDENTITY CASCADE)');
    }

    let communeCodes: Set<string>;
    let departementCodes: string[];

    if (options.skipGouv) {
      communeCodes = await readCommuneCodes(db);
      if (communeCodes.size === 0) {
        throw new Error('--skip-gouv exige des communes déjà importées en base');
      }
      departementCodes = await readDepartementCodes(db, options.regionCodes);
      log(`Communes existantes réutilisées : ${communeCodes.size.toLocaleString('fr-FR')}`);
    } else {
      const gouv = await loadGouvReferenceData(options.regionCodes);
      log(
        `API Gouv — ${gouv.regions.length} régions · ${gouv.departements.length} départements · ` +
          `${gouv.communes.length.toLocaleString('fr-FR')} communes` +
          (gouv.skippedCommunes > 0
            ? ` (${gouv.skippedCommunes.toLocaleString('fr-FR')} ignorées : population nulle ou hors périmètre)`
            : ''),
      );

      await insertRegions(db, gouv.regions);
      await insertDepartements(db, gouv.departements);
      await insertCommunes(db, gouv.communes);
      log('Régions, départements et communes insérés');

      communeCodes = new Set(gouv.communes.map((commune) => commune.code_insee));
      departementCodes = gouv.departements.map((departement) => departement.code);
    }

    if (options.skipBan) {
      log('Étape BAN ignorée (--skip-ban)');
    } else {
      const sources = resolveBanSources(options, departementCodes);
      log(
        `Lecture BAN : ${sources.length} fichier(s)${sources.length === 1 ? ` — ${sources[0]?.location}` : ''}`,
      );
      for (const source of sources.length === 1 ? [] : sources) {
        log(`  · ${source.location}`);
      }

      const collected = await collectOdonymes({
        sources,
        communeCodes,
        onProgress: logStats,
      });

      log(
        `BAN — fin de lecture : ${collected.stats.lines.toLocaleString('fr-FR')} lignes · ` +
          `${collected.stats.unknownCommunes.toLocaleString('fr-FR')} ignorées (commune hors périmètre) · ` +
          `${collected.stats.emptyStreets.toLocaleString('fr-FR')} sans nom de voie`,
      );

      const inserted = await insertOdonymes(db, collected);
      log(
        `Odonymes insérés : ${inserted.odonymes.toLocaleString('fr-FR')} · ` +
          `liens : ${inserted.links.toLocaleString('fr-FR')}`,
      );
    }

    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    log(`Terminé en ${seconds} s`);
  } finally {
    await db.destroy();
  }
}

if (import.meta.main) {
  await main(Bun.argv.slice(2));
}
