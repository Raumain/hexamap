/**
 * Fixture de jeu du banc E2E : un combo **complet** pour le compte de
 * démonstration, plus sa contre-épreuve.
 *
 * `global-setup.ts` gratte jusqu'à huit tickets et ne possède donc pas
 * toujours une région ni un département (observé : `["COMMUNE","RUE"]`). Or le
 * tri par compatibilité du tiroir de La Planche exige qu'un emplacement voisin
 * soit choisi, et une géographie réellement chaînée : sans ce combo, le cas
 * navigateur ne pourrait pas exister.
 *
 * Les quatre cartes du combo viennent du référentiel E2E
 * (`scripts/import/src/e2e-seed.ts`) : `E2E-R1` → `E2E-D1` → `E2E-C-RARE-0`,
 * plus l'odonyme réellement rattaché à cette commune par `commune_odonymes`.
 * Deux cartes **hors-zone** les accompagnent : sans elles, un tiroir qui ne trie
 * pas pourrait passer le cas par hasard, simplement parce que le compte ne
 * possède aucune carte non compatible.
 *
 * Le fichier vit hors de `scripts/import`, dont la règle locale interdit d'y
 * écrire des données de jeu ; il est importé par `global-setup.ts`, donc exécuté
 * dans le conteneur Playwright (Node), qui résout `packages/db` par chemin
 * relatif — `packages/e2e` ne déclare aucune dépendance vers le paquet de base.
 */

import { type CardCategory, createDb, type Rarity } from '../../db/src/index';

/** Géographie du référentiel E2E : une région, son département, une commune. */
const REGION_CODE = 'E2E-R1';
const DEPARTEMENT_CODE = 'E2E-D1';
const COMMUNE_CODE = 'E2E-C-RARE-0';

/**
 * `nom_normalise` de l'odonyme, tel que le seed l'écrit : préfixe plus rareté
 * mise en minuscules (`e2e-rue-${rarete}-${district}`). La valeur est lue en
 * base, jamais devinée depuis le nom d'affichage.
 */
const RUE_NORMALISEE = 'e2e-rue-inhabituelle-0';

/**
 * Contre-épreuve : une carte **hors-zone** par emplacement comparé, post-datée
 * de dix minutes pour que l'ordre d'acquisition la place en tête (`GET /cards`
 * trie par `acquired_at desc`). Sans tri par compatibilité elle occupe donc
 * l'index 0 du tiroir et le cas E2E rougit ; avec le tri elle passe derrière le
 * combo, ce qui prouve aussi que les cartes non compatibles restent listées.
 */
const TEMOIN_DEPARTEMENT = 'E2E-D2';
const TEMOIN_RUE_NORMALISEE = 'e2e-rue-commune-0';
const TEMOIN_AVANCE_MS = 10 * 60 * 1000;

interface ComboCard {
  category: CardCategory;
  ref_code: string;
  rarity: Rarity;
  score: number;
}

/**
 * Insère les cartes du combo — et sa contre-épreuve — pour `userId`, de façon
 * **idempotente** : une suppression ciblée sur `(user_id, category, ref_code)`
 * précède chaque insertion, puisqu'un ticket a pu déjà donner la carte.
 */
export async function ensureComboCards(userId: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('[e2e] DATABASE_URL manquant pour la fixture de La Planche.');
  }

  const db = createDb(databaseUrl);

  try {
    const odonyme = await refOdonyme(db, RUE_NORMALISEE);
    const temoinOdonyme = await refOdonyme(db, TEMOIN_RUE_NORMALISEE);

    // La compatibilité d'une rue est une jointure `commune_odonymes`, jamais une
    // ressemblance de nom : le lien est donc prouvé avant d'insérer la carte,
    // sans quoi le cas navigateur passerait sur un combo invalide.
    if (!(await communeContient(db, COMMUNE_CODE, odonyme))) {
      throw new Error(
        `[e2e] ${COMMUNE_CODE} ne contient pas l'odonyme ${RUE_NORMALISEE} : le combo serait invalide.`,
      );
    }

    // Et la contre-épreuve doit être réellement hors-zone, sinon elle ne
    // prouverait rien.
    if (await communeContient(db, COMMUNE_CODE, temoinOdonyme)) {
      throw new Error(
        `[e2e] ${TEMOIN_RUE_NORMALISEE} est rattaché à ${COMMUNE_CODE} : la contre-épreuve serait compatible.`,
      );
    }

    const combo: ComboCard[] = [
      { category: 'REGION', ref_code: REGION_CODE, rarity: 'RARE', score: 750 },
      { category: 'DEPARTEMENT', ref_code: DEPARTEMENT_CODE, rarity: 'RARE', score: 750 },
      { category: 'COMMUNE', ref_code: COMMUNE_CODE, rarity: 'RARE', score: 750 },
      { category: 'RUE', ref_code: odonyme, rarity: 'INHABITUELLE', score: 400 },
    ];

    const temoins: ComboCard[] = [
      { category: 'DEPARTEMENT', ref_code: TEMOIN_DEPARTEMENT, rarity: 'RARE', score: 750 },
      { category: 'RUE', ref_code: temoinOdonyme, rarity: 'COMMUNE', score: 100 },
    ];

    const now = Date.now();
    const entries = [
      ...combo.map((card) => ({ card, acquiredAt: new Date(now) })),
      ...temoins.map((card) => ({ card, acquiredAt: new Date(now + TEMOIN_AVANCE_MS) })),
    ];

    for (const { card, acquiredAt } of entries) {
      await db
        .deleteFrom('user_cards')
        .where('user_id', '=', userId)
        .where('category', '=', card.category)
        .where('ref_code', '=', card.ref_code)
        .execute();

      await db
        .insertInto('user_cards')
        .values({ ...card, user_id: userId, source: 'REWARD', acquired_at: acquiredAt })
        .execute();
    }

    console.log(
      `[e2e] Combo de La Planche prêt pour ${userId} : ${combo.length} cartes, ${temoins.length} témoins.`,
    );
  } finally {
    await db.destroy();
  }
}

type Db = ReturnType<typeof createDb>;

/** Identifiant d'un odonyme du référentiel, ou erreur explicite. */
async function refOdonyme(db: Db, nomNormalise: string): Promise<string> {
  const row = await db
    .selectFrom('ref_odonymes')
    .select('id')
    .where('nom_normalise', '=', nomNormalise)
    .executeTakeFirst();

  if (row === undefined) {
    throw new Error(`[e2e] Odonyme ${nomNormalise} absent du référentiel : rejouez le seed E2E.`);
  }

  return row.id;
}

/** Vrai si l'odonyme figure réellement dans la commune (`commune_odonymes`). */
async function communeContient(db: Db, codeInsee: string, odonymeId: string): Promise<boolean> {
  const row = await db
    .selectFrom('commune_odonymes')
    .select('odonyme_id')
    .where('code_insee', '=', codeInsee)
    .where('odonyme_id', '=', odonymeId)
    .executeTakeFirst();

  return row !== undefined;
}
