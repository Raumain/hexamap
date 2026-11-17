import type { Database, Rarity } from '@hexamap/db';
import { rueRarity, rueScore } from '@hexamap/shared';
import type { Kysely } from 'kysely';
import { BAN_CSV_DIR, blasonsUsage, parseArgs, parseBlasonArgs, usage } from './args';
import { type BanCollectResult, type BanSource, type BanStats, collectOdonymes } from './ban';
import { type BlasonReport, importBlasons, type LevelReport } from './blasons';
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
import { createProgress, type ImportProgressWriter } from './progress';

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
  progress?: ImportProgressWriter,
): Promise<OdonymeInsertResult> {
  const keys = [...collected.odonymeCommunes.keys()];
  const result: OdonymeInsertResult = { odonymes: 0, links: 0 };

  progress?.begin('odonymes', 'Insertion des odonymes', keys.length);
  progress?.log(`Insertion — ${keys.length.toLocaleString('fr-FR')} odonymes à créer`);

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
    progress?.set(result.odonymes, `${result.odonymes.toLocaleString('fr-FR')} odonymes insérés`);
  }

  progress?.log(
    `Insertion — terminé : ${result.odonymes.toLocaleString('fr-FR')} odonymes et ` +
      `${result.links.toLocaleString('fr-FR')} liens`,
  );

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

async function runBlasons(argv: readonly string[]): Promise<void> {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log(blasonsUsage());
    return;
  }

  const options = parseBlasonArgs(argv);
  const contoursOnly = options.contoursOnly === true;
  const levelCount = contoursOnly ? 0 : options.only === undefined ? 3 : 1;
  const contoursCount = contoursOnly
    ? 1
    : options.contours && (options.only === undefined || options.only === 'communes')
      ? 1
      : 0;
  const progress = createProgress(levelCount + contoursCount);
  options.progress = progress;
  const modeLabel = contoursOnly
    ? 'reprise contours seuls'
    : `niveau : ${options.only ?? 'tous'} · contours : ${options.contours ? 'activés' : 'désactivés'}`;
  progress.log(`Blasons — ${modeLabel}`);

  const db = connectDatabase();

  try {
    log(`Blasons — ${modeLabel}`);
    const report = await importBlasons(db, options);
    printBlasonReport(report);
    progress.finish('Import des blasons terminé');
  } catch (error) {
    progress.fail(error);
    throw error;
  } finally {
    await db.destroy();
  }
}

function formatCount(value: number): string {
  return value.toLocaleString('fr-FR');
}

function printBlasonReport(report: BlasonReport): void {
  const seconds = (report.durationMs / 1000).toFixed(1);
  log(`Blasons — terminé en ${seconds} s`);
  log(`Communes — ${formatLevelReport(report.communes, 'ignorées', 'absentes', true)}`);
  log(`Départements — ${formatLevelReport(report.departements, 'ignorés', 'absents', false)}`);
  log(`Régions — ${formatLevelReport(report.regions, 'ignorées', 'absentes', false)}`);
}

function formatReasons(reasons: Record<string, number>): string {
  const top = Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (top.length === 0) return '';
  return ` (${top.map(([reason, count]) => `${reason} ×${formatCount(count)}`).join(', ')})`;
}

function formatLevelReport(
  report: LevelReport,
  ignoredWord: string,
  missingWord: string,
  withContours: boolean,
): string {
  const parts = [`${formatCount(report.blasons)} blasons`];
  if (withContours) parts.push(`${formatCount(report.contours)} contours`);
  parts.push(`${formatCount(report.skipped)} ${ignoredWord}`);
  parts.push(`${formatCount(report.failed)} échecs${formatReasons(report.reasons)}`);
  parts.push(`${formatCount(report.missing)} ${missingWord}`);
  return parts.join(' · ');
}

export async function main(argv: readonly string[]): Promise<void> {
  if (argv.includes('--blasons')) {
    await runBlasons(argv.filter((arg) => arg !== '--blasons'));
    return;
  }

  const startedAt = performance.now();
  const options = parseArgs(argv);

  if (options.help) {
    console.log(usage());
    return;
  }

  const progress = createProgress(options.skipBan ? 1 : 3);
  progress.begin('reference', 'Référentiel géographique', null);

  log(
    `Mode ${options.lite ? 'lite' : 'complet'}` +
      ` · régions : ${options.regionCodes?.join(', ') ?? 'toutes'}` +
      ` · API Gouv : ${options.skipGouv ? 'ignorée' : 'activée'}` +
      ` · BAN : ${options.skipBan ? 'ignorée' : 'activée'}`,
  );
  progress.log(`Mode ${options.lite ? 'lite' : 'complet'} — démarrage de l'import`);

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
        progress.finish('Référentiel déjà présent');
        return;
      }

      log(
        `Référentiel incomplet (${counts.communes.toLocaleString('fr-FR')} communes · ` +
          `${counts.odonymes.toLocaleString('fr-FR')} odonymes) — import lancé`,
      );
    }

    if (options.skipGouv) {
      await truncateOdonymeTables(db);
      progress.set(0, 'Tables d’odonymes vidées');
    } else {
      await truncateReferenceTables(db);
      log('Tables de référence vidées (TRUNCATE ... RESTART IDENTITY CASCADE)');
      progress.set(0, 'Tables de référence vidées');
      progress.log('Tables de référence vidées');
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
      progress.set(0, 'Récupération du référentiel (API Gouv)');
      const gouv = await loadGouvReferenceData(options.regionCodes);
      log(
        `API Gouv — ${gouv.regions.length} régions · ${gouv.departements.length} départements · ` +
          `${gouv.communes.length.toLocaleString('fr-FR')} communes` +
          (gouv.skippedCommunes > 0
            ? ` (${gouv.skippedCommunes.toLocaleString('fr-FR')} ignorées : population nulle ou hors périmètre)`
            : ''),
      );
      progress.set(
        gouv.communes.length,
        `${gouv.communes.length.toLocaleString('fr-FR')} communes récupérées`,
      );
      progress.log(
        `API Gouv — ${gouv.regions.length} régions · ${gouv.departements.length} départements · ` +
          `${gouv.communes.length.toLocaleString('fr-FR')} communes`,
      );

      await insertRegions(db, gouv.regions);
      await insertDepartements(db, gouv.departements);
      await insertCommunes(db, gouv.communes);
      log('Régions, départements et communes insérés');
      progress.set(gouv.communes.length, 'Régions, départements et communes insérés');
      progress.log('Régions, départements et communes insérés');

      communeCodes = new Set(gouv.communes.map((commune) => commune.code_insee));
      departementCodes = gouv.departements.map((departement) => departement.code);
    }

    if (options.skipBan) {
      log('Étape BAN ignorée (--skip-ban)');
      progress.log('Étape BAN ignorée');
    } else {
      const sources = resolveBanSources(options, departementCodes);
      log(
        `Lecture BAN : ${sources.length} fichier(s)${sources.length === 1 ? ` — ${sources[0]?.location}` : ''}`,
      );
      for (const source of sources.length === 1 ? [] : sources) {
        log(`  · ${source.location}`);
      }

      progress.begin('ban', 'Base Adresse Nationale (BAN)', null);
      progress.log(
        `Lecture BAN — ${sources.length} fichier(s)` +
          (sources.length === 1 ? ` : ${sources[0]?.location ?? ''}` : ''),
      );

      const collected = await collectOdonymes({
        sources,
        communeCodes,
        progressEvery: 2_000,
        onProgress: (stats, uniqueOdonymes) => {
          logStats(stats, uniqueOdonymes);
          progress.set(
            stats.lines,
            `BAN : ${stats.lines.toLocaleString('fr-FR')} lignes lues · ` +
              `${uniqueOdonymes.toLocaleString('fr-FR')} odonymes`,
          );
        },
      });

      log(
        `BAN — fin de lecture : ${collected.stats.lines.toLocaleString('fr-FR')} lignes · ` +
          `${collected.stats.unknownCommunes.toLocaleString('fr-FR')} ignorées (commune hors périmètre) · ` +
          `${collected.stats.emptyStreets.toLocaleString('fr-FR')} sans nom de voie`,
      );
      progress.set(collected.stats.lines, 'Lecture BAN terminée');
      progress.log(
        `BAN — ${collected.stats.lines.toLocaleString('fr-FR')} lignes lues · ` +
          `${collected.odonymeCommunes.size.toLocaleString('fr-FR')} odonymes uniques`,
      );

      const inserted = await insertOdonymes(db, collected, progress);
      log(
        `Odonymes insérés : ${inserted.odonymes.toLocaleString('fr-FR')} · ` +
          `liens : ${inserted.links.toLocaleString('fr-FR')}`,
      );
    }

    const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    log(`Terminé en ${seconds} s`);
    progress.finish('Import terminé');
  } catch (error) {
    progress.fail(error);
    throw error;
  } finally {
    await db.destroy();
  }
}

if (import.meta.main) {
  await main(Bun.argv.slice(2));
}
