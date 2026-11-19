import type { CardCategory } from '@hexamap/db';
import {
  type CommuneOdonymeRef,
  evaluateTableau,
  rueExistsInCommune,
  type TableauGeography,
} from '@hexamap/shared';
import { sql } from 'kysely';
import type { Executor } from './draw';

/** Relation du lecteur avec le joueur affiché ; `null` quand les amitiés ne sont pas migrées. */
export type FriendState = 'SELF' | 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIENDS' | null;

export interface ProfileCompleteness {
  category: CardCategory;
  owned: number;
  total: number;
}

export interface PlayerBestTableau {
  id: string;
  name: string;
  score: number;
  multiplier: number;
  links: number;
}

/**
 * Vitrine publique d'un joueur (`.docs/01-architecture.md` §2.9).
 *
 * La projection est une liste blanche : elle ne contient ni adresse
 * électronique, ni solde, ni session, ni `locked`, ni `grid`, ni
 * `treasure_index`. Aucun champ de la table d'authentification n'est sélectionné
 * par `selectAll`.
 */
export interface PlayerProfile {
  id: string;
  pseudo: string;
  displayName: string;
  memberSince: string;
  bio: string | null;
  cardsOwned: number;
  completeness: ProfileCompleteness[];
  bestTableau: PlayerBestTableau | null;
  achievements: string[];
  openListings: number;
  friendCount: number;
  friendState: FriendState;
}

/** Totaux de référence d'une édition ; communes et rues sont comptées en base. */
const EDITION_TOTALS: Record<'REGION' | 'DEPARTEMENT', number> = {
  REGION: 18,
  DEPARTEMENT: 101,
};

const CARD_CATEGORIES: CardCategory[] = ['REGION', 'DEPARTEMENT', 'COMMUNE', 'RUE'];

/**
 * Les tables des phases 26 à 28 (`blocks`, `friendships`, `user_achievements`)
 * ne sont pas migrées dans cette branche. La sonde est **transitoire** : elle
 * interroge `to_regclass` une fois par processus et permet à la vitrine de
 * fonctionner avant leur migration. Une table absente rend des valeurs neutres
 * au lieu d'une erreur. À supprimer quand les trois migrations seront livrées.
 */
type OptionalTable = 'blocks' | 'friendships' | 'user_achievements';

/** Mesures effectives de la sonde, et rien d'autre : un échec n'entre jamais ici. */
const tablePresence = new Map<OptionalTable, boolean>();

/**
 * Sonde tri-état. `true` et `false` sont des **mesures** et sont mémorisées ;
 * `null` signifie « la sonde a échoué » et n'est jamais mis en cache, sans quoi
 * une erreur transitoire désactiverait définitivement le blocage, les médailles
 * et les amis pour tout le processus.
 *
 * `to_regclass` reçoit le nom **nu** de la table : la résolution passe par
 * `search_path`, donc le schéma isolé par worker (§4.8) continue de fonctionner.
 */
async function probeTable(exec: Executor, table: OptionalTable): Promise<boolean | null> {
  const cached = tablePresence.get(table);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const result = await sql<{ present: string | null }>`
      select to_regclass(${table})::text as present
    `.execute(exec);
    const present = Boolean(result.rows[0]?.present);
    tablePresence.set(table, present);
    return present;
  } catch (error) {
    console.warn('[profile] sonde de table indisponible', table, error);
    return null;
  }
}

/** Une table dont la sonde a échoué est traitée comme absente : l'appelant rend une valeur neutre. */
async function tableExists(exec: Executor, table: OptionalTable): Promise<boolean> {
  return (await probeTable(exec, table)) === true;
}

interface ReferenceTotals {
  communes: number;
  odonymes: number;
}

/**
 * Totaux de référence des communes et des rues, servis à la complétude d'une
 * route **publique et non authentifiée**. Le référentiel est figé entre deux
 * imports : une seule lecture par processus suffit, et un `count(*)` par requête
 * coûterait un parcours d'index à chaque vitrine affichée. Seul un résultat
 * effectif est mémorisé — une erreur remonte et sera retentée à l'appel suivant.
 */
let referenceTotals: ReferenceTotals | null = null;

async function loadReferenceTotals(exec: Executor): Promise<ReferenceTotals> {
  if (referenceTotals) {
    return referenceTotals;
  }

  const [communeRow, odonymeRow] = await Promise.all([
    exec
      .selectFrom('ref_communes')
      .select((eb) => eb.fn.countAll().as('count'))
      .executeTakeFirst(),
    exec
      .selectFrom('ref_odonymes')
      .select((eb) => eb.fn.countAll().as('count'))
      .executeTakeFirst(),
  ]);

  const totals: ReferenceTotals = {
    communes: Number(communeRow?.count ?? 0),
    odonymes: Number(odonymeRow?.count ?? 0),
  };
  referenceTotals = totals;
  return totals;
}

/** Un blocage est unilatéral et silencieux : il suffit dans un sens pour masquer la vitrine. */
async function isBlocked(exec: Executor, viewerId: string, playerId: string): Promise<boolean> {
  const result = await sql<{ blocked: boolean }>`
    select exists(
      select 1 from blocks
      where (blocker_id = ${viewerId} and blocked_id = ${playerId})
         or (blocker_id = ${playerId} and blocked_id = ${viewerId})
    ) as blocked
  `.execute(exec);
  return result.rows[0]?.blocked === true;
}

interface FriendshipRow {
  requester_id: string;
  addressee_id: string;
  status: string;
}

async function loadFriendState(
  exec: Executor,
  viewerId: string | null,
  playerId: string,
): Promise<FriendState> {
  if (!viewerId) {
    return 'NONE';
  }
  if (viewerId === playerId) {
    return 'SELF';
  }
  if (!(await tableExists(exec, 'friendships'))) {
    return null;
  }

  const result = await sql<FriendshipRow>`
    select requester_id, addressee_id, status from friendships
    where (requester_id = ${viewerId} and addressee_id = ${playerId})
       or (requester_id = ${playerId} and addressee_id = ${viewerId})
    limit 1
  `.execute(exec);

  const row = result.rows[0];
  if (!row) {
    return 'NONE';
  }
  if (row.status === 'ACCEPTED') {
    return 'FRIENDS';
  }
  if (row.status === 'PENDING') {
    return row.requester_id === viewerId ? 'PENDING_SENT' : 'PENDING_RECEIVED';
  }
  return 'NONE';
}

async function loadFriendCount(exec: Executor, playerId: string): Promise<number> {
  if (!(await tableExists(exec, 'friendships'))) {
    return 0;
  }
  const result = await sql<{ count: string }>`
    select count(*)::text as count from friendships
    where status = 'ACCEPTED' and (requester_id = ${playerId} or addressee_id = ${playerId})
  `.execute(exec);
  return Number(result.rows[0]?.count ?? 0);
}

async function loadAchievements(exec: Executor, playerId: string): Promise<string[]> {
  if (!(await tableExists(exec, 'user_achievements'))) {
    return [];
  }
  const result = await sql<{ achievement_key: string }>`
    select achievement_key from user_achievements
    where user_id = ${playerId}
    order by unlocked_at asc
  `.execute(exec);
  return result.rows.map((row) => row.achievement_key);
}

interface CardRow {
  id: string;
  category: CardCategory;
  ref_code: string;
  score: number;
}

interface SelectedCards {
  region: CardRow | null;
  departement: CardRow | null;
  commune: CardRow | null;
  rue: CardRow | null;
}

interface GeographyRefs {
  region: { code: string } | null;
  departement: { code_region: string } | null;
  commune: { code_departement: string } | null;
  odonymes: CommuneOdonymeRef[];
}

/** Même règle que le tableau de la Phase 8 : une référence absente rend un lien invalide. */
function buildGeography(cards: SelectedCards, refs: GeographyRefs): TableauGeography {
  const communeInsee = cards.commune ? cards.commune.ref_code : null;
  const rueOdonymeId = cards.rue ? cards.rue.ref_code : null;

  return {
    regionCode: cards.region ? (refs.region?.code ?? null) : null,
    departementCode: cards.departement?.ref_code ?? null,
    departementRegionCode: cards.departement ? (refs.departement?.code_region ?? null) : null,
    communeInsee,
    communeDepartementCode: cards.commune ? (refs.commune?.code_departement ?? null) : null,
    rueOdonymeId,
    rueInCommune: rueExistsInCommune(refs.odonymes, communeInsee, rueOdonymeId),
  };
}

/**
 * Meilleur tableau du joueur, recalculé avec les fonctions partagées de
 * `packages/shared/src/tableau.ts` : aucune formule n'est recopiée ici.
 * `null` quand aucun tableau n'est complet.
 */
async function loadBestTableau(
  exec: Executor,
  playerId: string,
): Promise<PlayerBestTableau | null> {
  const tableaux = await exec
    .selectFrom('tableaux')
    .select([
      'id',
      'name',
      'region_card_id',
      'departement_card_id',
      'commune_card_id',
      'rue_card_id',
    ])
    .where('user_id', '=', playerId)
    .orderBy('created_at', 'desc')
    .limit(50)
    .execute();

  if (tableaux.length === 0) {
    return null;
  }

  const cardIds = [
    ...new Set(
      tableaux
        .flatMap((tableau) => [
          tableau.region_card_id,
          tableau.departement_card_id,
          tableau.commune_card_id,
          tableau.rue_card_id,
        ])
        .filter((value): value is string => value !== null),
    ),
  ];
  if (cardIds.length === 0) {
    return null;
  }

  const cards = await exec
    .selectFrom('user_cards')
    .select(['id', 'category', 'ref_code', 'score'])
    .where('id', 'in', cardIds)
    .execute();
  const cardsById = new Map(cards.map((card) => [card.id, card] as const));

  const selectionOf = (tableau: (typeof tableaux)[number]): SelectedCards => ({
    region: tableau.region_card_id ? (cardsById.get(tableau.region_card_id) ?? null) : null,
    departement: tableau.departement_card_id
      ? (cardsById.get(tableau.departement_card_id) ?? null)
      : null,
    commune: tableau.commune_card_id ? (cardsById.get(tableau.commune_card_id) ?? null) : null,
    rue: tableau.rue_card_id ? (cardsById.get(tableau.rue_card_id) ?? null) : null,
  });

  const regions = new Set<string>();
  const departements = new Set<string>();
  const communes = new Set<string>();
  const odonymes = new Set<string>();
  const pairs: { commune: string; odonyme: string }[] = [];

  for (const tableau of tableaux) {
    const selection = selectionOf(tableau);
    if (selection.region) regions.add(selection.region.ref_code);
    if (selection.departement) departements.add(selection.departement.ref_code);
    if (selection.commune) communes.add(selection.commune.ref_code);
    if (selection.rue) odonymes.add(selection.rue.ref_code);
    if (selection.commune && selection.rue) {
      pairs.push({ commune: selection.commune.ref_code, odonyme: selection.rue.ref_code });
    }
  }

  const [regionRows, departementRows, communeRows, odonymeRows] = await Promise.all([
    regions.size === 0
      ? Promise.resolve([] as { code: string }[])
      : exec
          .selectFrom('ref_regions')
          .select(['code'])
          .where('code', 'in', [...regions])
          .execute(),
    departements.size === 0
      ? Promise.resolve([] as { code_region: string; code: string }[])
      : exec
          .selectFrom('ref_departements')
          .select(['code', 'code_region'])
          .where('code', 'in', [...departements])
          .execute(),
    communes.size === 0
      ? Promise.resolve([] as { code_insee: string; code_departement: string }[])
      : exec
          .selectFrom('ref_communes')
          .select(['code_insee', 'code_departement'])
          .where('code_insee', 'in', [...communes])
          .execute(),
    pairs.length === 0
      ? Promise.resolve([] as { code_insee: string; odonyme_id: string }[])
      : exec
          .selectFrom('commune_odonymes')
          .select(['code_insee', 'odonyme_id'])
          .where('code_insee', 'in', [...new Set(pairs.map((pair) => pair.commune))])
          .where('odonyme_id', 'in', [...odonymes])
          .execute(),
  ]);

  const regionByCode = new Map(regionRows.map((row) => [row.code, row]));
  const departementByCode = new Map(departementRows.map((row) => [row.code, row]));
  const communeByInsee = new Map(communeRows.map((row) => [row.code_insee, row]));
  const odonymesByCommune = new Map<string, CommuneOdonymeRef[]>();
  for (const row of odonymeRows) {
    const list = odonymesByCommune.get(row.code_insee) ?? [];
    list.push({ codeInsee: row.code_insee, odonymeId: row.odonyme_id });
    odonymesByCommune.set(row.code_insee, list);
  }

  let best: PlayerBestTableau | null = null;

  for (const tableau of tableaux) {
    const selection = selectionOf(tableau);
    const complete =
      selection.region !== null &&
      selection.departement !== null &&
      selection.commune !== null &&
      selection.rue !== null;
    if (!complete) {
      continue;
    }

    const geography = buildGeography(selection, {
      region: selection.region ? (regionByCode.get(selection.region.ref_code) ?? null) : null,
      departement: selection.departement
        ? (departementByCode.get(selection.departement.ref_code) ?? null)
        : null,
      commune: selection.commune ? (communeByInsee.get(selection.commune.ref_code) ?? null) : null,
      odonymes: selection.commune ? (odonymesByCommune.get(selection.commune.ref_code) ?? []) : [],
    });

    const evaluation = evaluateTableau(
      {
        region: selection.region?.score ?? 0,
        departement: selection.departement?.score ?? 0,
        commune: selection.commune?.score ?? 0,
        rue: selection.rue?.score ?? 0,
      },
      geography,
    );

    if (!best || evaluation.total > best.score) {
      best = {
        id: tableau.id,
        name: tableau.name,
        score: evaluation.total,
        multiplier: evaluation.alignment.multiplier,
        links: evaluation.alignment.links,
      };
    }
  }

  return best;
}

/**
 * Charge la vitrine d'un joueur. Rend `null` pour les trois cas sémantiques
 * seulement — compte inconnu, vitrine privée lue par un autre, blocage — que la
 * route traduit en 404. Aucun `catch` global : une erreur SQL réelle remonte et
 * Elysia répond 500, plutôt que de mentir « ce joueur n'a pas de vitrine ».
 */
export async function loadPlayerProfile(
  exec: Executor,
  playerId: string,
  viewerId: string | null,
): Promise<PlayerProfile | null> {
  const user = await exec
    .selectFrom('user')
    .select(['id', 'pseudo', 'name', 'createdAt'])
    .where('id', '=', playerId)
    .executeTakeFirst();

  if (!user) {
    return null;
  }

  const isSelf = viewerId === playerId;

  // Un blocage masque la vitrine dans les deux sens, avant toute lecture de
  // contenu. Si la sonde échoue, on ne sait pas si un blocage existe : la
  // vitrine ne se rend pas (404). C'est la règle du « fail closed » — mieux vaut
  // cacher une vitrine à tort que l'exposer à quelqu'un que le joueur a bloqué.
  if (!isSelf && viewerId !== null) {
    const blocksPresent = await probeTable(exec, 'blocks');
    if (blocksPresent === null) {
      return null;
    }
    if (blocksPresent && (await isBlocked(exec, viewerId, playerId))) {
      return null;
    }
  }

  const profileRow = await exec
    .selectFrom('user_profiles')
    .select(['bio', 'profile_public'])
    .where('user_id', '=', playerId)
    .executeTakeFirst();

  if (!isSelf && profileRow?.profile_public === false) {
    return null;
  }

  const [cardRows, totals, openListingsRow] = await Promise.all([
    exec
      .selectFrom('user_cards')
      .select(['category', 'ref_code'])
      .where('user_id', '=', playerId)
      .execute(),
    loadReferenceTotals(exec),
    exec
      .selectFrom('market_listings')
      .select((eb) => eb.fn.countAll().as('count'))
      .where('seller_id', '=', playerId)
      .where('status', '=', 'OPEN')
      .executeTakeFirst(),
  ]);

  const completeness: ProfileCompleteness[] = CARD_CATEGORIES.map((category) => {
    const owned = new Set(
      cardRows.filter((row) => row.category === category).map((row) => row.ref_code),
    ).size;
    const total =
      category === 'COMMUNE'
        ? totals.communes
        : category === 'RUE'
          ? totals.odonymes
          : EDITION_TOTALS[category];
    return { category, owned, total };
  });

  const [bestTableau, achievements, friendCount, friendState] = await Promise.all([
    loadBestTableau(exec, playerId),
    loadAchievements(exec, playerId),
    loadFriendCount(exec, playerId),
    loadFriendState(exec, viewerId, playerId),
  ]);

  const pseudo = user.pseudo ?? user.name;

  return {
    id: user.id,
    pseudo,
    displayName: pseudo,
    memberSince: user.createdAt.toISOString(),
    bio: profileRow?.bio ?? null,
    cardsOwned: cardRows.length,
    completeness,
    bestTableau,
    achievements,
    openListings: Number(openListingsRow?.count ?? 0),
    friendCount,
    friendState,
  };
}
