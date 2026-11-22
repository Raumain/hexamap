/**
 * Fixture de la Vitrine : deux lignes `tableaux`, une **complète** et une
 * **trouée**, pour que la page publique montre réellement des planches.
 *
 * La vitrine n'affichait jusqu'ici qu'un score : `bestTableau` rendait son
 * total, jamais les quatre cartes qui le composent. Le référentiel E2E possède
 * le combo (`E2E-R1` → `E2E-D1` → `E2E-C-RARE-0`, plus l'odonyme réellement
 * rattaché par `commune_odonymes`), mais **aucune ligne `tableaux` n'était
 * semée** : sans cette fixture, la page n'a rien à montrer et le cas navigateur
 * ne prouverait qu'un état vide.
 *
 * La seconde ligne est volontairement trouée — sa seule commune est posée —,
 * parce que le contrat de la phase veut quatre positions quoi qu'il arrive, avec
 * des emplacements vides explicites plutôt qu'un tableau ignoré.
 *
 * Les lignes sont insérées depuis la spec (`beforeAll`), jamais depuis
 * `global-setup.ts` : semées globalement, elles existeraient pendant **tous**
 * les autres cas, y compris ceux qui comptent les tableaux du compte principal.
 * `clearVitrineTableaux()` les retire en `afterAll`.
 *
 * Le fichier vit hors de `scripts/import`, dont la règle locale interdit d'y
 * écrire des données de jeu ; il importe `packages/db` par chemin relatif,
 * comme `tableau-fixture.ts`.
 */

import { createDb } from '../../db/src/index';

/** Nom porté par les deux lignes : c'est la clé d'idempotence du nettoyage. */
export const VITRINE_TABLEAU_NAME = 'Vitrine E2E';

/** Géographie du combo semé par `ensureComboCards` (`global-setup.ts`). */
const REGION_CODE = 'E2E-R1';
const DEPARTEMENT_CODE = 'E2E-D1';
const COMMUNE_CODE = 'E2E-C-RARE-0';
const RUE_NORMALISEE = 'e2e-rue-inhabituelle-0';

/** Compte secondaire réel, inscrit par `fixtures/second-account.ts`. */
const SECOND_ACCOUNT_EMAIL = 'second-e2e@hexamap.test';

export interface VitrineFixture {
  primaryUserId: string;
  secondUserId: string;
}

type Db = ReturnType<typeof createDb>;

/**
 * Insère les deux tableaux de la vitrine, de façon **idempotente** : une
 * suppression ciblée sur `(user_id, name)` précède les insertions, donc un rejeu
 * ne duplique rien.
 *
 * Les identifiants de joueur sont résolus **sans session navigateur** : le
 * compte principal est celui qui possède les trois cartes du combo (seul lui les
 * a, `ensureComboCards` ne tourne que pour lui), le second est son courriel fixe.
 */
export async function ensureVitrineTableaux(): Promise<VitrineFixture> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error('[e2e] DATABASE_URL manquant pour la fixture de la Vitrine.');
  }

  const db = createDb(databaseUrl);

  try {
    const primaryUserId = await resolvePrimaryUserId(db);

    if (primaryUserId === null) {
      throw new Error(
        '[e2e] Aucun compte ne possède le combo E2E-R1 / E2E-D1 / E2E-C-RARE-0 et sa rue : ' +
          'rejouez le seed E2E et `ensureComboCards` du « global-setup ».',
      );
    }

    const secondUserId = await resolveSecondUserId(db);

    if (secondUserId === null) {
      throw new Error(
        `[e2e] Le compte ${SECOND_ACCOUNT_EMAIL} est absent : rejouez le seed E2E ` +
          'et `ensureSecondAccount`.',
      );
    }

    const rueOdonymeId = await refOdonyme(db, RUE_NORMALISEE);

    await deleteVitrineRows(db, [primaryUserId, secondUserId]);

    const completeCards = {
      region_card_id: await ownedCard(db, primaryUserId, 'REGION', REGION_CODE),
      departement_card_id: await ownedCard(db, primaryUserId, 'DEPARTEMENT', DEPARTEMENT_CODE),
      commune_card_id: await ownedCard(db, primaryUserId, 'COMMUNE', COMMUNE_CODE),
      rue_card_id: await ownedCard(db, primaryUserId, 'RUE', rueOdonymeId),
    };

    await db
      .insertInto('tableaux')
      .values({
        user_id: primaryUserId,
        name: VITRINE_TABLEAU_NAME,
        ...completeCards,
      })
      .execute();

    console.log(
      `[e2e] Tableau complet de la Vitrine prêt pour ${primaryUserId} : 4 cartes posées.`,
    );

    // Le tableau troué ne pose **que** la commune : les trois autres colonnes
    // restent nulles, et c'est cette absence qui doit s'afficher en clair.
    await db
      .insertInto('tableaux')
      .values({
        user_id: secondUserId,
        name: VITRINE_TABLEAU_NAME,
        region_card_id: null,
        departement_card_id: null,
        commune_card_id: await ownedCard(db, secondUserId, 'COMMUNE', COMMUNE_CODE),
        rue_card_id: null,
      })
      .execute();

    console.log(
      `[e2e] Tableau troué de la Vitrine prêt pour ${secondUserId} : commune seule, 3 emplacements vides.`,
    );

    return { primaryUserId, secondUserId };
  } finally {
    await db.destroy();
  }
}

/**
 * Retire les lignes de la Vitrine. Sans effet si les comptes ont disparu ou si
 * les lignes n'ont jamais été créées : un `afterAll` ne doit jamais transformer
 * un nettoyage en échec.
 */
export async function clearVitrineTableaux(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('[e2e] DATABASE_URL manquant : aucun tableau de Vitrine à effacer.');
    return;
  }

  const db = createDb(databaseUrl);

  try {
    const second = await resolveSecondUserId(db);
    const ids = await primaryOwners(db);
    if (second !== null) ids.push(second);
    if (ids.length === 0) return;

    await deleteVitrineRows(db, ids);
    console.log('[e2e] Tableaux de la Vitrine effacés.');
  } finally {
    await db.destroy();
  }
}

/** Supprime les lignes de la fixture pour les comptes donnés. */
async function deleteVitrineRows(db: Db, userIds: string[]): Promise<void> {
  await db
    .deleteFrom('tableaux')
    .where('user_id', 'in', userIds)
    .where('name', '=', VITRINE_TABLEAU_NAME)
    .execute();
}

/**
 * Comptes possédant **les trois** cartes stables du combo, triés pour être
 * déterministes. Sert au **nettoyage** : un run interrompu peut laisser une
 * ligne derrière lui sur un compte que la résolution stricte ne désigne plus.
 */
async function primaryOwners(db: Db): Promise<string[]> {
  const rows = await db
    .selectFrom('user_cards')
    .select(['user_id', 'ref_code'])
    .where('ref_code', 'in', [REGION_CODE, DEPARTEMENT_CODE, COMMUNE_CODE])
    .execute();

  const found = new Map<string, Set<string>>();

  for (const row of rows) {
    const owned = found.get(row.user_id) ?? new Set<string>();
    owned.add(row.ref_code);
    found.set(row.user_id, owned);
  }

  return [...found.entries()]
    .filter(([, refs]) =>
      [REGION_CODE, DEPARTEMENT_CODE, COMMUNE_CODE].every((code) => refs.has(code)),
    )
    .map(([userId]) => userId)
    .sort();
}

/**
 * Le compte principal, **sans session navigateur** : celui que `global-setup`
 * vient d'inscrire, donc le plus récent qui possède le combo **entier**, odonyme
 * compris.
 *
 * L'odonyme est indispensable à l'identification : `e2e:seed` réécrit
 * `ref_odonymes` à chaque démarrage de la pile, donc les identifiants changent
 * d'un run à l'autre. Un compte d'un run précédent possède encore `E2E-R1`,
 * `E2E-D1` et `E2E-C-RARE-0`, mais sa rue pointe sur un odonyme périmé : le
 * retenir ferait échouer la fixture sur une carte de rue absente.
 */
async function resolvePrimaryUserId(db: Db): Promise<string | null> {
  const rueOdonymeId = await refOdonyme(db, RUE_NORMALISEE);

  const rows = await db
    .selectFrom('user_cards as uc')
    .innerJoin('user as u', 'u.id', 'uc.user_id')
    .select([
      'uc.user_id as userId',
      'uc.category as category',
      'uc.ref_code as refCode',
      'u.createdAt as createdAt',
    ])
    .where('uc.ref_code', 'in', [REGION_CODE, DEPARTEMENT_CODE, COMMUNE_CODE, rueOdonymeId])
    .execute();

  const found = new Map<string, { keys: Set<string>; createdAt: Date }>();

  for (const row of rows) {
    const entry = found.get(row.userId) ?? { keys: new Set<string>(), createdAt: row.createdAt };
    entry.keys.add(`${row.category}:${row.refCode}`);
    found.set(row.userId, entry);
  }

  const required = [
    `REGION:${REGION_CODE}`,
    `DEPARTEMENT:${DEPARTEMENT_CODE}`,
    `COMMUNE:${COMMUNE_CODE}`,
    `RUE:${rueOdonymeId}`,
  ];

  const candidates = [...found.entries()].filter(([, entry]) =>
    required.every((key) => entry.keys.has(key)),
  );

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort((a, b) => b[1].createdAt.getTime() - a[1].createdAt.getTime());
  return candidates[0]?.[0] ?? null;
}

/** Identifiant du compte secondaire, ou `null` s'il n'existe pas encore. */
async function resolveSecondUserId(db: Db): Promise<string | null> {
  const row = await db
    .selectFrom('user')
    .select('id')
    .where('email', '=', SECOND_ACCOUNT_EMAIL)
    .executeTakeFirst();

  return row?.id ?? null;
}

/**
 * Identifiant d'une carte **réellement possédée** par `userId`. `orderBy` rend
 * le choix déterministe quand plusieurs exemplaires existent, et l'absence lève
 * une erreur explicite : un trou silencieux ferait mentir le cas « quatre
 * planches ».
 */
async function ownedCard(
  db: Db,
  userId: string,
  category: 'REGION' | 'DEPARTEMENT' | 'COMMUNE' | 'RUE',
  refCode: string,
): Promise<string> {
  const row = await db
    .selectFrom('user_cards')
    .select('id')
    .where('user_id', '=', userId)
    .where('category', '=', category)
    .where('ref_code', '=', refCode)
    .orderBy('acquired_at', 'asc')
    .orderBy('id', 'asc')
    .executeTakeFirst();

  if (row === undefined) {
    throw new Error(
      `[e2e] ${userId} ne possède aucune carte ${category} ${refCode} : ` +
        'rejouez le seed E2E et la fixture des cartes du combo.',
    );
  }

  return row.id;
}

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
