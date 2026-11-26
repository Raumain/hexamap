import type { Database, Rarity } from '@hexamap/db';
import { pruneUnreferencedReferenceRows, type ReferenceScope } from '@hexamap/db';
import { isFrenchRegionCode, rueRarity, rueScore } from '@hexamap/shared';
import type { Kysely } from 'kysely';
import {
  BAN_CSV_DIR,
  blasonsUsage,
  type CliOptions,
  parseArgs,
  parseBlasonArgs,
  usage,
} from './args';
import { ATLAS_LEVELS, runAtlas } from './atlas';
import { fillAtlasGeometry } from './atlas-ign';
import { backfillOverseasFrames, type OverseasReport } from './atlas-overseas';
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

/**
 * BUG-003 — garde sur `ref_regions.code`.
 *
 * Une table de référentiel n'a aucune protection structurelle : BUG-001 est resté
 * invisible des mois parce qu'une région inventée était « structurellement
 * acceptable ». Un `CHECK` de table est impossible ici (les fixtures de spec et le
 * banc E2E sèment volontairement des codes synthétiques) : la validation vit donc
 * à la frontière, et **échoue avant d'écrire la moindre ligne**.
 */
function assertFrenchRegionCodes(rows: readonly RefRegionRow[]): void {
  const invalid = rows.filter((row) => !isFrenchRegionCode(row.code));

  if (invalid.length === 0) return;

  const list = invalid.map((row) => `« ${row.code} »`).join(', ');
  throw new Error(
    `REFERENCE_CODE_INVALID : ${list} n'est pas un code de région français. ` +
      'Le référentiel source est corrompu ; aucune ligne de région n’a été écrite.',
  );
}

/**
 * Élague les lignes périmées d'un niveau, sans jamais supprimer une ligne citée
 * par une carte. C'est la procédure de réimport exigée par BUG-002.
 */
async function pruneReference(
  db: Kysely<Database>,
  scope: ReferenceScope,
  keep: readonly string[],
): Promise<void> {
  const result = await pruneUnreferencedReferenceRows(db, scope, keep);
  log(
    `Élagage ${scope} — ${result.deleted.toLocaleString('fr-FR')} supprimée(s) · ` +
      `${result.preserved.toLocaleString('fr-FR')} conservée(s) car citée(s) par une carte`,
  );
}

function logStats(stats: BanStats, uniqueOdonymes: number): void {
  log(
    `BAN — ${stats.lines.toLocaleString('fr-FR')} lignes lues · ` +
      `${stats.keptRows.toLocaleString('fr-FR')} retenues · ` +
      `${uniqueOdonymes.toLocaleString('fr-FR')} odonymes uniques`,
  );
}

/**
 * `merge` = réimport non destructeur (BUG-002). Les colonnes d'assets
 * (`blason_url`, `contour_url`, `blason_credit`) et `geom` ne sont **jamais**
 * réécrites ici : elles appartiennent aux étapes blasons et atlas, et un
 * `excluded.…` nul les effacerait.
 */
async function insertRegions(
  db: Kysely<Database>,
  rows: readonly RefRegionRow[],
  merge: boolean,
): Promise<void> {
  for (const chunk of chunkArray(rows, INSERT_CHUNK_SIZE)) {
    const query = db.insertInto('ref_regions').values(chunk);
    if (!merge) {
      await query.execute();
      continue;
    }
    await query
      .onConflict((oc) => oc.column('code').doUpdateSet((eb) => ({ nom: eb.ref('excluded.nom') })))
      .execute();
  }
}

async function insertDepartements(
  db: Kysely<Database>,
  rows: readonly RefDepartementRow[],
  merge: boolean,
): Promise<void> {
  for (const chunk of chunkArray(rows, INSERT_CHUNK_SIZE)) {
    const query = db.insertInto('ref_departements').values(chunk);
    if (!merge) {
      await query.execute();
      continue;
    }
    await query
      .onConflict((oc) =>
        oc.column('code').doUpdateSet((eb) => ({
          nom: eb.ref('excluded.nom'),
          code_region: eb.ref('excluded.code_region'),
          population: eb.ref('excluded.population'),
        })),
      )
      .execute();
  }
}

async function insertCommunes(
  db: Kysely<Database>,
  rows: readonly RefCommuneRow[],
  merge: boolean,
): Promise<void> {
  for (const chunk of chunkArray(rows, INSERT_CHUNK_SIZE)) {
    const query = db.insertInto('ref_communes').values(chunk);
    if (!merge) {
      await query.execute();
      continue;
    }
    await query
      .onConflict((oc) =>
        oc.column('code_insee').doUpdateSet((eb) => ({
          nom: eb.ref('excluded.nom'),
          code_departement: eb.ref('excluded.code_departement'),
          code_region: eb.ref('excluded.code_region'),
          population: eb.ref('excluded.population'),
          latitude: eb.ref('excluded.latitude'),
          longitude: eb.ref('excluded.longitude'),
          rarete: eb.ref('excluded.rarete'),
          score_base: eb.ref('excluded.score_base'),
          draw_bucket: eb.ref('excluded.draw_bucket'),
          // Le code postal appartient à l'étape référentiel, pas aux étapes
          // blasons ni atlas : il se réécrit donc, sinon un `--merge` ne
          // remplirait jamais les lignes déjà présentes.
          code_postal: eb.ref('excluded.code_postal'),
        })),
      )
      .execute();
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
  merge = false,
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

    const odonymeQuery = db.insertInto('ref_odonymes').values(values);
    const inserted = merge
      ? await odonymeQuery
          .onConflict((oc) =>
            oc.column('nom_normalise').doUpdateSet((eb) => ({
              nom_affichage: eb.ref('excluded.nom_affichage'),
              nb_communes: eb.ref('excluded.nb_communes'),
              rarete: eb.ref('excluded.rarete'),
              score_base: eb.ref('excluded.score_base'),
              draw_bucket: eb.ref('excluded.draw_bucket'),
            })),
          )
          .returning(['id', 'nom_normalise'])
          .execute()
      : await odonymeQuery.returning(['id', 'nom_normalise']).execute();

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
      const linkQuery = db.insertInto('commune_odonymes').values(linkChunk);
      if (merge) {
        await linkQuery
          .onConflict((oc) => oc.columns(['code_insee', 'odonyme_id']).doNothing())
          .execute();
      } else {
        await linkQuery.execute();
      }
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

/**
 * Étape atlas — acquisition éventuelle de `geom`, puis projection en `path_d`.
 *
 * Elle tourne **à la fin de `main()`**, après la BAN, sur le même handle : le
 * pipeline reste la seule source de vérité des deux colonnes, et aucune requête
 * joueur n'a jamais à projeter une géométrie.
 */
async function runAtlasStage(db: Kysely<Database>, options: CliOptions): Promise<void> {
  if (options.pathsNoFetch) {
    log('Atlas — acquisition de la géométrie ignorée (--no-fetch)');
  } else {
    for (const level of ATLAS_LEVELS) {
      await fillAtlasGeometry(db, level, { force: options.pathsForce });
    }
  }

  await runAtlas(db, { force: options.pathsForce, limit: options.pathsLimit });
}

/** `--paths-only` : l'étape atlas seule, sans référentiel, sans BAN, sans blasons. */
async function runPathsOnly(options: CliOptions): Promise<void> {
  const db = connectDatabase();

  try {
    await runAtlasStage(db, options);
  } finally {
    await db.destroy();
  }
}

function formatOverseasReport(report: OverseasReport): string[] {
  const lines = report.groups.map(
    (group) =>
      `Cadre ${group.regionCode} · ${group.viewBox} · ${group.rows} lignes ` +
      `(${group.departements} départements, ${group.communes} communes) · ` +
      `${group.pathWritten} tracés écrits · ${group.alreadySet} déjà écrits · ` +
      `${group.framesWritten} cadres mis à jour`,
  );

  lines.push(
    `Outre-mer : ${report.groups.length} groupe(s) · ${report.rows} lignes · ` +
      `${report.pathWritten} tracés écrits · ${report.alreadySet} déjà écrits · ` +
      `${report.framesWritten} cadres mis à jour · ${report.missingGeom} sans géométrie · ` +
      `${report.invalidGeom} invalides`,
  );

  return lines;
}

/** `--overseas` : les cadres et tracés des seuls groupes d'outre-mer. */
async function runOverseasOnly(options: CliOptions): Promise<void> {
  const db = connectDatabase();

  try {
    const report = await backfillOverseasFrames(db, { force: options.pathsForce });
    for (const line of formatOverseasReport(report)) {
      log(line);
    }
  } finally {
    await db.destroy();
  }
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

  if (options.pathsOnly) {
    log('Étape atlas seule (--paths-only)');
    await runPathsOnly(options);
    return;
  }

  if (options.overseas) {
    log('Cadres d’outre-mer (--overseas)');
    await runOverseasOnly(options);
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

    if (options.merge) {
      log('Mode fusion (--merge) : aucun vidage, upsert puis élagage des lignes non citées');
      progress.log('Mode fusion : upsert puis élagage des lignes non citées');
    } else if (options.skipGouv) {
      await truncateOdonymeTables(db);
      progress.set(0, 'Tables d’odonymes vidées');
    }
    // Le vidage du référentiel n'a pas lieu ici : il attend que la source soit
    // chargée **et validée**, sinon une source corrompue détruirait le
    // référentiel avant d'échouer (voir le bloc API Gouv ci-dessous).

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

      assertFrenchRegionCodes(gouv.regions);

      // Vidage seulement une fois la source validée : une source corrompue ne
      // doit pas laisser un référentiel vide derrière elle.
      if (!options.merge) {
        await truncateReferenceTables(db);
        log('Tables de référence vidées (TRUNCATE ... RESTART IDENTITY CASCADE)');
        progress.set(gouv.communes.length, 'Tables de référence vidées');
        progress.log('Tables de référence vidées');
      }

      await insertRegions(db, gouv.regions, options.merge);
      await insertDepartements(db, gouv.departements, options.merge);
      await insertCommunes(db, gouv.communes, options.merge);
      log('Régions, départements et communes insérés');
      progress.set(gouv.communes.length, 'Régions, départements et communes insérés');
      progress.log('Régions, départements et communes insérés');

      communeCodes = new Set(gouv.communes.map((commune) => commune.code_insee));
      departementCodes = gouv.departements.map((departement) => departement.code);

      if (options.merge) {
        // Ordre imposé par les clés étrangères : une commune cite son département,
        // qui cite sa région.
        await pruneReference(
          db,
          'COMMUNE',
          gouv.communes.map((commune) => commune.code_insee),
        );
        await pruneReference(
          db,
          'DEPARTEMENT',
          gouv.departements.map((departement) => departement.code),
        );
        await pruneReference(
          db,
          'REGION',
          gouv.regions.map((region) => region.code),
        );
      }
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

      const inserted = await insertOdonymes(db, collected, progress, options.merge);
      log(
        `Odonymes insérés : ${inserted.odonymes.toLocaleString('fr-FR')} · ` +
          `liens : ${inserted.links.toLocaleString('fr-FR')}`,
      );

      if (options.merge) {
        await pruneReference(db, 'RUE', [...collected.odonymeCommunes.keys()]);
      }
    }

    log('Atlas — géométrie puis tracés (`path_d`)');
    await runAtlasStage(db, options);

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
