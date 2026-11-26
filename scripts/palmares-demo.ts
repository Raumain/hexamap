/**
 * Données de démonstration du Palmarès, pour la base de développement.
 *
 * Le classement ne lit que `tableaux.score` : ce script pose quatre comptes
 * jetables, leurs cartes réelles — raretés et scores lus dans le référentiel —
 * et quatre tableaux dont le score vient d'`evaluateTableau`, jamais d'une
 * constante. Tout ce qu'il écrit est reconnaissable : les tableaux portent le
 * préfixe `Démo — `, les comptes `demo-palmares-*@hexamap.local`.
 */

// Chemins relatifs, pas les noms de paquets : `scripts/` n'est pas un workspace,
// donc `bun run scripts/palmares-demo.ts` ne résout pas `@hexamap/*` depuis la
// racine — alors que `packages/*` résout ses propres dépendances normalement.
import { createDb, sql } from '../packages/db/src/index';
import {
  type Category,
  departementPopulationBonus,
  editionScore,
  evaluateTableau,
  RARITY_LABELS,
  type Rarity,
  type TableauGeography,
  type TableauScores,
} from '../packages/shared/src/index';

const NAME_PREFIX = 'Démo — ';
const DEMO_EMAIL_LIKE = 'demo-palmares-%@hexamap.local';
const PROFILES_WANTED = 4;
const REGION_RARITIES: readonly Rarity[] = ['LEGENDAIRE', 'RARE', 'EPIQUE', 'MYTHIQUE'];
const DEPARTEMENT_RARITIES: readonly Rarity[] = ['EPIQUE', 'LEGENDAIRE', 'MYTHIQUE', 'RARE'];
const DEMO_PSEUDOS: readonly string[] = ['Camille', 'Étienne', 'Marguerite', 'Gaspard'];
const SLOT_ORDER = ['REGION', 'DEPARTEMENT', 'COMMUNE', 'RUE'] as const;

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('[palmares-demo] DATABASE_URL manquant');
  process.exit(1);
}

if (process.env.NODE_ENV === 'production') {
  console.error('[palmares-demo] refusé : NODE_ENV=production');
  process.exit(1);
}

const loweredUrl = databaseUrl.toLowerCase();

if (loweredUrl.includes('_e2e') || loweredUrl.includes('test')) {
  console.error('[palmares-demo] refusé : cette URL désigne une base de test ou E2E');
  process.exit(1);
}

const args = process.argv.slice(2);
const clearOnly = args.includes('--clear');
const attachIndex = args.indexOf('--attach');
const attachIdent = attachIndex === -1 ? null : (args[attachIndex + 1] ?? null);

if (attachIndex !== -1 && (attachIdent === null || attachIdent.startsWith('--'))) {
  console.error('[palmares-demo] --attach attend un courriel ou un pseudo');
  process.exit(1);
}

type Db = ReturnType<typeof createDb>;

interface Profile {
  regionCode: string;
  regionNom: string;
  regionRarity: Rarity;
  departementCode: string;
  departementNom: string;
  departementPopulation: number;
  departementRarity: Rarity;
  communeCode: string;
  communeNom: string;
  communeRarete: Rarity;
  communeScore: number;
  rueId: string;
  rueNom: string;
  rueRarete: Rarity;
  rueScore: number;
  /** `true` seulement quand `commune_odonymes` atteste le lien (§2.5). */
  rueInCommune: boolean;
}

interface DemoCard {
  id: string;
  category: Category;
  refCode: string;
  nom: string;
  rarity: Rarity;
  score: number;
}

interface DemoPlayer {
  id: string;
  email: string;
  pseudo: string;
  profile: Profile;
  cards: DemoCard[];
}

interface TableauPlan {
  name: string;
  userId: string;
  cards: DemoCard[];
  score: number;
}

interface AttachResult {
  plan: TableauPlan | null;
  message: string;
}

const formatScore = (value: number): string => value.toLocaleString('fr-FR');

const cardOf = (cards: readonly DemoCard[], category: Category): DemoCard | undefined =>
  cards.find((card) => card.category === category);

const cardIdOf = (cards: readonly DemoCard[], category: Category): string | null =>
  cardOf(cards, category)?.id ?? null;

const tableauScores = (cards: readonly DemoCard[]): TableauScores => {
  const scoreOf = (category: Category): number => cardOf(cards, category)?.score ?? 0;

  return {
    region: scoreOf('REGION'),
    departement: scoreOf('DEPARTEMENT'),
    commune: scoreOf('COMMUNE'),
    rue: scoreOf('RUE'),
  };
};

function buildCards(profile: Profile): DemoCard[] {
  return [
    {
      id: crypto.randomUUID(),
      category: 'REGION',
      refCode: profile.regionCode,
      nom: profile.regionNom,
      rarity: profile.regionRarity,
      score: editionScore(profile.regionRarity),
    },
    {
      id: crypto.randomUUID(),
      category: 'DEPARTEMENT',
      refCode: profile.departementCode,
      nom: profile.departementNom,
      rarity: profile.departementRarity,
      score:
        editionScore(profile.departementRarity) +
        departementPopulationBonus(profile.departementPopulation),
    },
    {
      id: crypto.randomUUID(),
      category: 'COMMUNE',
      refCode: profile.communeCode,
      nom: profile.communeNom,
      rarity: profile.communeRarete,
      score: profile.communeScore,
    },
    {
      id: crypto.randomUUID(),
      category: 'RUE',
      refCode: profile.rueId,
      nom: profile.rueNom,
      rarity: profile.rueRarete,
      score: profile.rueScore,
    },
  ];
}

async function selectProfiles(db: Db): Promise<Profile[]> {
  // La base de développement ne porte que les liens `commune_odonymes` des
  // fixtures E2E : on part donc des communes réelles les plus peuplées, et on
  // lit le lien rue ↔ commune au lieu de le supposer.
  const communes = await db
    .selectFrom('ref_communes')
    .select(['code_insee', 'nom', 'code_departement', 'code_region', 'rarete', 'score_base'])
    .where('blason_url', 'is not', null)
    .where('population', '>=', 50_000)
    // Les fixtures E2E fuient en base de développement (BUG-001) : leurs communes
    // portent des populations de 900 000 hab. et squatteraient tout le classement.
    .where('code_insee', 'not like', 'E2E%')
    .where('code_departement', 'not like', 'E2E%')
    .where('code_region', 'not like', 'E2E%')
    .orderBy('population', 'desc')
    .execute();

  const profiles: Profile[] = [];
  const usedRegions = new Set<string>();

  for (const commune of communes) {
    if (usedRegions.has(commune.code_region)) {
      continue;
    }

    const region = await db
      .selectFrom('ref_regions')
      .select(['code', 'nom'])
      .where('code', '=', commune.code_region)
      .executeTakeFirst();

    const departement = await db
      .selectFrom('ref_departements')
      .select(['code', 'nom', 'code_region', 'population'])
      .where('code', '=', commune.code_departement)
      .executeTakeFirst();

    if (!region || !departement) {
      continue;
    }

    const linked = await db
      .selectFrom('commune_odonymes')
      .innerJoin('ref_odonymes', 'ref_odonymes.id', 'commune_odonymes.odonyme_id')
      .select([
        'ref_odonymes.id as id',
        'ref_odonymes.nom_affichage as nom',
        'ref_odonymes.rarete as rarete',
        'ref_odonymes.score_base as score',
      ])
      .where('commune_odonymes.code_insee', '=', commune.code_insee)
      .orderBy('ref_odonymes.nb_communes', 'asc')
      .limit(1)
      .executeTakeFirst();

    // Sans lien attesté, la rue reste une vraie rue du référentiel — un nom rare,
    // donc une planche lisible — mais l'alignement ne la compte pas.
    const rue =
      linked ??
      (await db
        .selectFrom('ref_odonymes')
        .select(['id', 'nom_affichage as nom', 'rarete', 'score_base as score'])
        .where('nb_communes', '<=', 4)
        .where('nom_affichage', 'not like', '%E2E%')
        .orderBy(sql`random()`)
        .limit(1)
        .executeTakeFirst());

    if (!rue) {
      continue;
    }

    const index = profiles.length;
    profiles.push({
      regionCode: region.code,
      regionNom: region.nom,
      regionRarity: REGION_RARITIES[index] ?? 'RARE',
      departementCode: departement.code,
      departementNom: departement.nom,
      departementPopulation: departement.population,
      departementRarity: DEPARTEMENT_RARITIES[index] ?? 'RARE',
      communeCode: commune.code_insee,
      communeNom: commune.nom,
      communeRarete: commune.rarete,
      communeScore: commune.score_base,
      rueId: rue.id,
      rueNom: rue.nom,
      rueRarete: rue.rarete,
      rueScore: rue.score,
      rueInCommune: linked !== undefined,
    });
    usedRegions.add(commune.code_region);

    if (profiles.length === PROFILES_WANTED) {
      break;
    }
  }

  if (profiles.length < PROFILES_WANTED) {
    throw new Error(
      `référentiel insuffisant : ${profiles.length} profil(s) complet(s) sur ${PROFILES_WANTED}`,
    );
  }

  return profiles;
}

async function resolveAttachPlan(db: Db, ident: string): Promise<AttachResult> {
  const target = await db
    .selectFrom('user')
    .select(['id', 'pseudo', 'email', 'name'])
    .where((eb) => eb.or([eb('email', '=', ident), eb('pseudo', '=', ident)]))
    .executeTakeFirst();

  if (!target) {
    return { plan: null, message: `aucun compte pour « ${ident} »` };
  }

  const label = target.pseudo ?? target.email;

  const cards = await db
    .selectFrom('user_cards')
    .select(['id', 'category', 'ref_code', 'rarity', 'score'])
    .where('user_id', '=', target.id)
    .where('locked', '=', false)
    .execute();

  const best = (category: Category) =>
    cards
      .filter((card) => card.category === category)
      .reduce<(typeof cards)[number] | null>(
        (top, card) => (top === null || card.score > top.score ? card : top),
        null,
      );

  const region = best('REGION');
  const departement = best('DEPARTEMENT');
  const commune = best('COMMUNE');
  const rue = best('RUE');

  const missing = [
    region ? null : 'Région',
    departement ? null : 'Département',
    commune ? null : 'Commune',
    rue ? null : 'Rue',
  ].filter((entry): entry is string => entry !== null);

  if (!region || !departement || !commune || !rue) {
    return {
      plan: null,
      message: `aucun tableau composé pour ${label} : aucune carte ${missing.join(', ')}`,
    };
  }

  const departementRef = await db
    .selectFrom('ref_departements')
    .select(['nom', 'code_region'])
    .where('code', '=', departement.ref_code)
    .executeTakeFirst();

  const communeRef = await db
    .selectFrom('ref_communes')
    .select(['nom', 'code_departement'])
    .where('code_insee', '=', commune.ref_code)
    .executeTakeFirst();

  const regionRef = await db
    .selectFrom('ref_regions')
    .select(['nom'])
    .where('code', '=', region.ref_code)
    .executeTakeFirst();

  const rueRef = await db
    .selectFrom('ref_odonymes')
    .select(['nom_affichage'])
    .where('id', '=', rue.ref_code)
    .executeTakeFirst();

  const link = await db
    .selectFrom('commune_odonymes')
    .select('odonyme_id')
    .where('code_insee', '=', commune.ref_code)
    .where('odonyme_id', '=', rue.ref_code)
    .executeTakeFirst();

  const detail: DemoCard[] = [
    {
      id: region.id,
      category: 'REGION',
      refCode: region.ref_code,
      nom: regionRef?.nom ?? region.ref_code,
      rarity: region.rarity,
      score: region.score,
    },
    {
      id: departement.id,
      category: 'DEPARTEMENT',
      refCode: departement.ref_code,
      nom: departementRef?.nom ?? departement.ref_code,
      rarity: departement.rarity,
      score: departement.score,
    },
    {
      id: commune.id,
      category: 'COMMUNE',
      refCode: commune.ref_code,
      nom: communeRef?.nom ?? commune.ref_code,
      rarity: commune.rarity,
      score: commune.score,
    },
    {
      id: rue.id,
      category: 'RUE',
      refCode: rue.ref_code,
      nom: rueRef?.nom_affichage ?? rue.ref_code,
      rarity: rue.rarity,
      score: rue.score,
    },
  ];

  // La rue est le seul lien que le client ne sait pas trancher (§2.5) : il est
  // lu dans `commune_odonymes`, jamais déduit d'un nom.
  const geography: TableauGeography = {
    regionCode: region.ref_code,
    departementCode: departement.ref_code,
    departementRegionCode: departementRef?.code_region ?? null,
    communeInsee: commune.ref_code,
    communeDepartementCode: communeRef?.code_departement ?? null,
    rueOdonymeId: rue.ref_code,
    rueInCommune: link !== undefined,
  };

  return {
    plan: {
      name: `${NAME_PREFIX}Vos cartes`,
      userId: target.id,
      cards: detail,
      score: evaluateTableau(tableauScores(detail), geography).total,
    },
    message: `un tableau « ${NAME_PREFIX}Vos cartes » a été composé pour ${label}`,
  };
}

const db = createDb(databaseUrl);

async function run(): Promise<void> {
  const profiles = clearOnly ? [] : await selectProfiles(db);

  const players: DemoPlayer[] = profiles.map((profile, index) => ({
    id: crypto.randomUUID(),
    email: `demo-palmares-${index + 1}@hexamap.local`,
    pseudo: DEMO_PSEUDOS[index] ?? `Joueur ${index + 1}`,
    profile,
    cards: buildCards(profile),
  }));

  const plan: TableauPlan[] = [];

  if (!clearOnly) {
    for (const player of players.slice(0, 3)) {
      const score = evaluateTableau(tableauScores(player.cards), {
        regionCode: player.profile.regionCode,
        departementCode: player.profile.departementCode,
        departementRegionCode: player.profile.regionCode,
        communeInsee: player.profile.communeCode,
        communeDepartementCode: player.profile.departementCode,
        rueOdonymeId: player.profile.rueId,
        rueInCommune: player.profile.rueInCommune,
      }).total;

      plan.push({
        name: `${NAME_PREFIX}${player.profile.regionNom} en long et en large`,
        userId: player.id,
        cards: player.cards,
        score,
      });
    }

    // Le tableau dispersé mélange les profils : les trois liens tombent, le
    // multiplicateur vaut ×1, et le classement montre deux échelles.
    const [first, second, third, fourth] = players;

    if (first && second && third && fourth) {
      const regionCard = cardOf(first.cards, 'REGION');
      const departementCard = cardOf(second.cards, 'DEPARTEMENT');
      const communeCard = cardOf(third.cards, 'COMMUNE');
      const rueCard = cardOf(fourth.cards, 'RUE');

      if (regionCard && departementCard && communeCard && rueCard) {
        const cards = [regionCard, departementCard, communeCard, rueCard];
        const score = evaluateTableau(tableauScores(cards), {
          regionCode: first.profile.regionCode,
          departementCode: second.profile.departementCode,
          departementRegionCode: second.profile.regionCode,
          communeInsee: third.profile.communeCode,
          communeDepartementCode: third.profile.departementCode,
          rueOdonymeId: fourth.profile.rueId,
          rueInCommune: false,
        }).total;

        plan.push({
          name: `${NAME_PREFIX}Itinéraire buissonnier`,
          userId: fourth.id,
          cards,
          score,
        });
      }
    }
  }

  let attach: AttachResult | null = null;

  if (!clearOnly && attachIdent) {
    attach = await resolveAttachPlan(db, attachIdent);
    if (attach.plan) {
      plan.push(attach.plan);
    }
  }

  await db.transaction().execute(async (trx) => {
    const demoUsers = await trx
      .selectFrom('user')
      .select('id')
      .where('email', 'like', DEMO_EMAIL_LIKE)
      .execute();
    const demoIds = demoUsers.map((row) => row.id);

    await trx.deleteFrom('tableaux').where('name', 'like', `${NAME_PREFIX}%`).execute();

    if (demoIds.length > 0) {
      await trx.deleteFrom('user_cards').where('user_id', 'in', demoIds).execute();
      await trx.deleteFrom('user').where('id', 'in', demoIds).execute();
    }

    if (clearOnly) {
      return;
    }

    const now = new Date();

    for (const player of players) {
      await trx
        .insertInto('user')
        .values({
          id: player.id,
          name: player.pseudo,
          email: player.email,
          emailVerified: true,
          image: null,
          createdAt: now,
          updatedAt: now,
          pseudo: player.pseudo,
          currency: 0,
        })
        .execute();

      await trx
        .insertInto('user_cards')
        .values(
          player.cards.map((card) => ({
            id: card.id,
            user_id: player.id,
            category: card.category,
            ref_code: card.refCode,
            rarity: card.rarity,
            score: card.score,
            acquired_at: now,
            source: 'REWARD' as const,
            locked: false,
          })),
        )
        .execute();
    }

    if (plan.length > 0) {
      await trx
        .insertInto('tableaux')
        .values(
          plan.map((entry) => ({
            id: crypto.randomUUID(),
            user_id: entry.userId,
            name: entry.name,
            region_card_id: cardIdOf(entry.cards, 'REGION'),
            departement_card_id: cardIdOf(entry.cards, 'DEPARTEMENT'),
            commune_card_id: cardIdOf(entry.cards, 'COMMUNE'),
            rue_card_id: cardIdOf(entry.cards, 'RUE'),
            score: entry.score,
            created_at: now,
          })),
        )
        .execute();
    }
  });

  if (clearOnly) {
    console.log('Démo du Palmarès retirée — rien d’autre n’a été touché.');
    return;
  }

  const ranked = [...plan].sort((left, right) => right.score - left.score);

  console.log(`Palmarès — ${ranked.length} tableau(x) de démonstration, semaine courante`);

  for (const [index, entry] of ranked.entries()) {
    console.log('');
    console.log(`${index + 1}. ${formatScore(entry.score)} pts · ${entry.name}`);

    for (const category of SLOT_ORDER) {
      const card = cardOf(entry.cards, category);
      if (!card) {
        continue;
      }

      const label = `${card.category} · ${card.nom}`;
      const detail = `${RARITY_LABELS[card.rarity]} · ${formatScore(card.score)}`;
      console.log(`   ${label} · ${detail}`);
    }
  }

  console.log('');
  if (attach) {
    console.log(attach.message);
  }
  console.log('Ouvrez /palmares : le classement de la semaine courante.');
  console.log('`--attach <courriel-ou-pseudo>` compose un tableau avec les cartes d’un compte.');
  console.log('`--clear` retire ces lignes de démonstration, et rien d’autre.');
}

try {
  await run();
} catch (error) {
  const message = error instanceof Error ? error.message : 'échec inattendu';
  console.error(`[palmares-demo] ${message}`);
  process.exitCode = 1;
} finally {
  await db.destroy();
}
