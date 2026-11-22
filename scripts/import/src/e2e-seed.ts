/**
 * Référentiel minimal pour le banc E2E.
 *
 * Le banc tourne sur une base vide (`hexamap_e2e`) : la génération de ticket a
 * besoin de candidats dans chaque palier de rareté. Ce script insère un jeu
 * déterministe et réaliste (préfixe `E2E`), sans jamais toucher aux données de
 * développement.
 */

import { createDb } from '@hexamap/db';
import { RARITY, type Rarity } from '@hexamap/shared';
import { type AtlasLevel, geometryToPathD } from './atlas-projection';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[e2e] DATABASE_URL manquant');
  process.exit(1);
}

const db = createDb(databaseUrl);

const PREFIX = 'E2E';
const regionA = `${PREFIX}-R1`;
const regionB = `${PREFIX}-R2`;
const deptA = `${PREFIX}-D1`;
const deptB = `${PREFIX}-D2`;

interface SeedPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

/**
 * Quadrilatère **métropolitain** déterministe : 0,04° de côté, posé sur une
 * trame au pas de 0,05° autour de 2,0 °E / 47,0 °N. Deux entités ne se
 * chevauchent donc jamais, et deux semis produisent exactement la même
 * géométrie — donc le même `path_d`. Aucun aléatoire, aucune géométrie
 * d'outre-mer : le banc doit pouvoir mesurer l'atlas.
 */
function seedPolygon(index: number): SeedPolygon {
  const lon = 2 + (index % 20) * 0.05;
  const lat = 47 + Math.floor(index / 20) * 0.05;
  const half = 0.02;

  return {
    type: 'Polygon',
    coordinates: [
      [
        [lon - half, lat - half],
        [lon + half, lat - half],
        [lon + half, lat + half],
        [lon - half, lat + half],
        [lon - half, lat - half],
      ],
    ],
  };
}

/** `geom` et `path_d` d'une entité : le tracé vient du module pur, jamais d'ici. */
function seedAtlas(index: number, level: AtlasLevel): { geom: SeedPolygon; path_d: string } {
  const geometry = seedPolygon(index);
  const pathD = geometryToPathD(geometry, level);

  if (pathD === null) {
    throw new Error(`[e2e] géométrie non projetable à l’indice ${index} (${level})`);
  }

  // La colonne est `jsonb` : c'est l'objet GeoJSON qui est passé, jamais sa
  // sérialisation — une chaîne serait stockée comme *chaîne jsonb*, et la
  // géométrie deviendrait illisible pour l'étape atlas.
  return { geom: geometry, path_d: pathD };
}

try {
  // Idempotent : on repart d'un référentiel E2E propre.
  await db.deleteFrom('commune_odonymes').execute();
  await db.deleteFrom('ref_odonymes').where('nom_normalise', 'like', 'e2e-%').execute();
  await db.deleteFrom('ref_communes').where('code_insee', 'like', `${PREFIX}-%`).execute();
  await db.deleteFrom('ref_departements').where('code', 'like', `${PREFIX}-%`).execute();
  await db.deleteFrom('ref_regions').where('code', 'like', `${PREFIX}-%`).execute();

  const regions = [regionA, regionB].map((code, index) => ({
    code,
    nom: code === regionA ? 'Région E2E A' : 'Région E2E B',
    blason_url: `/blasons/regions/${code}.svg`,
    blason_credit: 'CC0 · Fixture E2E · Hexamap',
    ...seedAtlas(index, 'REGION'),
  }));
  await db.insertInto('ref_regions').values(regions).execute();

  const departements = [deptA, deptB].map((code, index) => ({
    code,
    nom: code === deptA ? 'Département E2E A' : 'Département E2E B',
    code_region: code === deptA ? regionA : regionB,
    population: code === deptA ? 1_000_000 : 500_000,
    blason_url: `/blasons/departements/${code}.svg`,
    blason_credit: 'CC0 · Fixture E2E · Hexamap',
    ...seedAtlas(2 + index, 'DEPARTEMENT'),
  }));
  await db.insertInto('ref_departements').values(departements).execute();

  const communes = RARITY.flatMap((rarete: Rarity, rarityIndex: number) =>
    [0, 1].map((district) => {
      const codeInsee = `${PREFIX}-C-${rarete}-${district}`;
      return {
        code_insee: codeInsee,
        nom: `Commune E2E ${rarete} ${district}`,
        code_departement: district === 0 ? deptA : deptB,
        code_region: district === 0 ? regionA : regionB,
        population: 1_000_000 - rarityIndex * 100_000 - district * 50_000,
        rarete,
        score_base: 100 + rarityIndex * 50,
        // Chaque commune du banc porte un blason réellement servi par l'API :
        // les fichiers vivent dans `packages/e2e/fixtures/blasons`, monté en
        // lecture seule sur `/data/blasons`. Sans eux, le Cartel ne peut pas
        // être mesuré (le blason est une zone réservée de la composition).
        blason_url: `/blasons/communes/${codeInsee}.svg`,
        blason_credit: 'CC0 · Fixture E2E · Hexamap',
        ...seedAtlas(4 + rarityIndex * 2 + district, 'COMMUNE'),
      };
    }),
  );
  await db.insertInto('ref_communes').values(communes).execute();

  const odonymeRows = await db
    .insertInto('ref_odonymes')
    .values(
      RARITY.flatMap((rarete: Rarity, rarityIndex: number) =>
        [0, 1].map((district) => ({
          nom_normalise: `e2e-rue-${rarete}-${district}`.toLowerCase(),
          nom_affichage: `Rue E2E ${rarete} ${district}`,
          nb_communes: 1,
          rarete,
          score_base: 100 + rarityIndex * 50,
        })),
      ),
    )
    .returning(['id', 'rarete'])
    .execute();

  const idsByRarity = new Map<Rarity, string[]>();
  for (const row of odonymeRows) {
    const list = idsByRarity.get(row.rarete) ?? [];
    list.push(row.id);
    idsByRarity.set(row.rarete, list);
  }

  const twinOdonymes = [
    ...(idsByRarity.get('INHABITUELLE') ?? []),
    ...(idsByRarity.get('RARE') ?? []),
  ];
  const treasureOdonymes = [
    ...(idsByRarity.get('RARE') ?? []),
    ...(idsByRarity.get('EPIQUE') ?? []),
    ...(idsByRarity.get('LEGENDAIRE') ?? []),
    ...(idsByRarity.get('MYTHIQUE') ?? []),
  ];

  const treasureCommunes = communes.filter((commune) =>
    (['RARE', 'EPIQUE', 'LEGENDAIRE', 'MYTHIQUE'] as Rarity[]).includes(commune.rarete),
  );
  const twinCommunes = communes.filter(
    (commune) => commune.rarete === 'INHABITUELLE' || commune.rarete === 'RARE',
  );

  const links = new Map<string, { code_insee: string; odonyme_id: string }>();
  for (const commune of treasureCommunes) {
    for (const odonymeId of twinOdonymes) {
      links.set(`${commune.code_insee}|${odonymeId}`, {
        code_insee: commune.code_insee,
        odonyme_id: odonymeId,
      });
    }
  }
  for (const commune of twinCommunes) {
    for (const odonymeId of treasureOdonymes) {
      links.set(`${commune.code_insee}|${odonymeId}`, {
        code_insee: commune.code_insee,
        odonyme_id: odonymeId,
      });
    }
  }

  if (links.size > 0) {
    await db
      .insertInto('commune_odonymes')
      .values([...links.values()])
      .execute();
  }

  // `global-setup.ts` prépare jusqu'à 8 tickets pour un même compte : le plafond
  // de charges du banc doit donc le dépasser. Ce plafond vit dans `game_config`,
  // jamais dans le code — le relever ne demande aucune migration.
  const benchChargeCap = 30;
  for (const key of ['SCRATCH_CHARGE_CAP', 'SCRATCH_START_CHARGES']) {
    await db
      .insertInto('game_config')
      .values({ key, value: benchChargeCap })
      .onConflict((oc) => oc.column('key').doUpdateSet({ value: benchChargeCap }))
      .execute();
  }

  console.log(
    `[e2e] Référentiel prêt : ${communes.length} communes, ${odonymeRows.length} odonymes, ${links.size} liens, ${benchChargeCap} charges.`,
  );
} finally {
  await db.destroy();
}
