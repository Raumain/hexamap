import type { CardCategory, Rarity, TicketStatus } from '@hexamap/db';
import type { Category } from '@hexamap/shared';
import { HttpError } from '../lib/http-error';
import {
  cardNomKey,
  type DrawnCard,
  drawCard,
  type Executor,
  resolveCardMeta,
  resolveCardNoms,
  weightedCategory,
  weightedRarity,
} from './draw';
import { type Rng, shuffle } from './rng';

export interface TicketCardRef {
  category: CardCategory;
  ref_code: string;
  rarity: Rarity;
}

export type TicketCell =
  | { kind: 'CARD'; card: TicketCardRef }
  | { kind: 'TREASURE'; card: TicketCardRef }
  | { kind: 'TWIN'; card: TicketCardRef }
  | { kind: 'STATION' }
  | { kind: 'BELVEDERE'; card: TicketCardRef }
  | { kind: 'RENOVATION'; card: TicketCardRef };

export type CellKind = TicketCell['kind'];

export interface MaskedCard {
  category: CardCategory;
  refCode: string;
  rarity: Rarity;
  score: number;
  nom: string;
}

export interface MaskedCell {
  index: number;
  revealed: boolean;
  distance: number | null;
  kind: CellKind | null;
  nom: string | null;
  card: MaskedCard | null;
}

export interface MaskedTicket {
  id: string;
  status: TicketStatus;
  scrapesRemaining: number;
  renovationPending: boolean;
  createdAt: string;
  expiresAt: string | null;
  cells: MaskedCell[];
  treasureFound: boolean;
}

export type ScratchEffect =
  | 'CARD_ADDED'
  | 'SCRAPES_ADDED'
  | 'ADJACENT_REVEALED'
  | 'RENOVATION_APPLIED'
  | 'RENOVATION_PENDING'
  | 'TREASURE_FOUND'
  | 'TICKET_EXHAUSTED';

export interface TicketSummary {
  id: string;
  status: TicketStatus;
  scrapes_remaining: number;
  renovation_pending: boolean;
  created_at: Date;
  expires_at: Date | null;
}

export interface RevealInfo {
  distance: number;
  card: MaskedCard | null;
}

const TREASURE_RARITIES: Rarity[] = ['RARE', 'EPIQUE', 'LEGENDAIRE', 'MYTHIQUE'];
const TWIN_RARITIES: Rarity[] = ['INHABITUELLE', 'RARE'];
const CARD_CATEGORIES: Category[] = ['COMMUNE', 'RUE'];
const CARD_RARITIES: Rarity[] = ['COMMUNE', 'INHABITUELLE'];

/** Distance de Manhattan entre deux indices d'une grille 4×4. */
export function manhattanDistance(a: number, b: number): number {
  return Math.abs(Math.floor(a / 4) - Math.floor(b / 4)) + Math.abs((a % 4) - (b % 4));
}

const CELL_KINDS: readonly string[] = [
  'CARD',
  'TREASURE',
  'TWIN',
  'STATION',
  'BELVEDERE',
  'RENOVATION',
];

function hasCardRef(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const card = value as Record<string, unknown>;
  return (
    typeof card.category === 'string' &&
    typeof card.ref_code === 'string' &&
    typeof card.rarity === 'string'
  );
}

/**
 * Valide la grille stockée (anti-corruption) : 16 cases, `kind` connu et, pour
 * les cases porteuses d'une carte, un `card` complet. Retourne `[]` quand la
 * grille est absente ou n'a pas la bonne taille (masquage), mais lève
 * `TICKET_CORRUPTED` si son contenu est malformé.
 */
export function parseGrid(value: unknown): TicketCell[] {
  if (!Array.isArray(value) || value.length !== 16) {
    return [];
  }
  for (const cell of value) {
    if (typeof cell !== 'object' || cell === null) {
      throw new HttpError(503, 'TICKET_CORRUPTED', 'Ticket illisible.');
    }
    const record = cell as Record<string, unknown>;
    const kind = record.kind;
    if (typeof kind !== 'string' || !CELL_KINDS.includes(kind)) {
      throw new HttpError(503, 'TICKET_CORRUPTED', 'Ticket illisible.');
    }
    if (kind !== 'STATION' && !hasCardRef(record.card)) {
      throw new HttpError(503, 'TICKET_CORRUPTED', 'Ticket illisible.');
    }
  }
  return value as TicketCell[];
}

/** Insère une carte possédée et renvoie son id. */
export async function insertUserCard(
  exec: Executor,
  userId: string,
  card: TicketCardRef,
  score: number,
): Promise<string> {
  const row = await exec
    .insertInto('user_cards')
    .values({
      user_id: userId,
      category: card.category,
      ref_code: card.ref_code,
      rarity: card.rarity,
      score,
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  return row.id;
}

/** Marque EXPIRED tout ticket ACTIF dont la date d'expiration est dépassée. */
export async function expireStaleTicket(exec: Executor, userId: string): Promise<void> {
  await exec
    .updateTable('tickets')
    .set({ status: 'EXPIRED' })
    .where('user_id', '=', userId)
    .where('status', '=', 'ACTIVE')
    .where('expires_at', '<', new Date())
    .execute();
}

export function maskTicket(
  row: TicketSummary,
  grid: TicketCell[],
  reveals: Map<number, RevealInfo>,
): MaskedTicket {
  const cells: MaskedCell[] = [];
  let treasureFound = false;

  for (let i = 0; i < 16; i++) {
    const cell = grid[i];
    const reveal = reveals.get(i);
    if (cell && reveal) {
      cells.push({
        index: i,
        revealed: true,
        distance: reveal.distance,
        kind: cell.kind,
        nom: reveal.card?.nom ?? null,
        card: reveal.card,
      });
      if (cell.kind === 'TREASURE') {
        treasureFound = true;
      }
    } else {
      cells.push({ index: i, revealed: false, distance: null, kind: null, nom: null, card: null });
    }
  }

  return {
    id: row.id,
    status: row.status,
    scrapesRemaining: row.scrapes_remaining,
    renovationPending: row.renovation_pending,
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
    cells,
    treasureFound,
  };
}

/** Charge un ticket masqué : seules les cases déjà révélées sont exposées. */
export async function loadMaskedTicket(
  exec: Executor,
  ticketId: string,
  userId: string,
): Promise<MaskedTicket> {
  const row = await exec
    .selectFrom('tickets')
    .select(['id', 'status', 'scrapes_remaining', 'renovation_pending', 'created_at', 'expires_at'])
    .where('id', '=', ticketId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!row) {
    throw new HttpError(404, 'TICKET_NOT_FOUND', 'Ticket introuvable.');
  }

  // Anti-triche : `grid` est lue via une requête dédiée, et seuls les indices
  // déjà révélés en sont extraits (pour connaître le `kind` d'un panneau) ; la
  // ligne brute, `grid` et `treasure_index` ne remontent jamais vers le
  // gestionnaire ni dans la réponse.
  const gridRow = await exec
    .selectFrom('tickets')
    .select(['grid'])
    .where('id', '=', ticketId)
    .executeTakeFirst();
  const grid = gridRow ? parseGrid(gridRow.grid) : [];

  const reveals = await exec
    .selectFrom('ticket_reveals')
    .select(['cell_index', 'distance', 'card_user_id'])
    .where('ticket_id', '=', ticketId)
    .execute();

  const cardIds = reveals.map((r) => r.card_user_id).filter((id): id is string => id !== null);
  const cardsById = new Map<
    string,
    { category: CardCategory; ref_code: string; rarity: Rarity; score: number }
  >();
  if (cardIds.length > 0) {
    const cardRows = await exec
      .selectFrom('user_cards')
      .select(['id', 'category', 'ref_code', 'rarity', 'score'])
      .where('id', 'in', cardIds)
      .execute();
    for (const c of cardRows) {
      cardsById.set(c.id, {
        category: c.category,
        ref_code: c.ref_code,
        rarity: c.rarity,
        score: c.score,
      });
    }
  }

  const noms = await resolveCardNoms(exec, [...cardsById.values()]);

  const revealsMap = new Map<number, RevealInfo>();
  for (const r of reveals) {
    let card: MaskedCard | null = null;
    const stored = r.card_user_id ? cardsById.get(r.card_user_id) : undefined;
    if (stored) {
      card = {
        category: stored.category,
        refCode: stored.ref_code,
        rarity: stored.rarity,
        score: stored.score,
        nom: noms.get(cardNomKey(stored.category, stored.ref_code)) ?? '',
      };
    }
    revealsMap.set(r.cell_index, { distance: r.distance, card });
  }

  return maskTicket(row, grid, revealsMap);
}

interface OdonymeRef {
  id: string;
  rarete: Rarity;
}

interface CommuneRef {
  code_insee: string;
  rarete: Rarity;
}

async function odonymesOfCommune(exec: Executor, codeInsee: string): Promise<OdonymeRef[]> {
  return exec
    .selectFrom('commune_odonymes')
    .innerJoin('ref_odonymes', 'ref_odonymes.id', 'commune_odonymes.odonyme_id')
    .select(['ref_odonymes.id', 'ref_odonymes.rarete'])
    .where('commune_odonymes.code_insee', '=', codeInsee)
    .where('ref_odonymes.rarete', 'in', TWIN_RARITIES)
    .distinct()
    .execute();
}

async function odonymesOfDepartement(
  exec: Executor,
  codeDepartement: string,
): Promise<OdonymeRef[]> {
  return exec
    .selectFrom('ref_communes')
    .innerJoin('commune_odonymes', 'commune_odonymes.code_insee', 'ref_communes.code_insee')
    .innerJoin('ref_odonymes', 'ref_odonymes.id', 'commune_odonymes.odonyme_id')
    .select(['ref_odonymes.id', 'ref_odonymes.rarete'])
    .where('ref_communes.code_departement', '=', codeDepartement)
    .where('ref_odonymes.rarete', 'in', TWIN_RARITIES)
    .distinct()
    .execute();
}

async function communesWithOdonyme(exec: Executor, odonymeId: string): Promise<CommuneRef[]> {
  return exec
    .selectFrom('commune_odonymes')
    .innerJoin('ref_communes', 'ref_communes.code_insee', 'commune_odonymes.code_insee')
    .select(['ref_communes.code_insee', 'ref_communes.rarete'])
    .where('commune_odonymes.odonyme_id', '=', odonymeId)
    .where('ref_communes.rarete', 'in', TWIN_RARITIES)
    .execute();
}

async function communesOfDepartement(
  exec: Executor,
  codeDepartement: string,
): Promise<CommuneRef[]> {
  return exec
    .selectFrom('ref_communes')
    .select(['code_insee', 'rarete'])
    .where('code_departement', '=', codeDepartement)
    .where('rarete', 'in', TWIN_RARITIES)
    .execute();
}

async function communesOfRegion(exec: Executor, codeRegion: string): Promise<CommuneRef[]> {
  return exec
    .selectFrom('ref_communes')
    .select(['code_insee', 'rarete'])
    .where('code_region', '=', codeRegion)
    .where('rarete', 'in', TWIN_RARITIES)
    .execute();
}

async function odonymesOfRegion(exec: Executor, codeRegion: string): Promise<OdonymeRef[]> {
  return exec
    .selectFrom('ref_communes')
    .innerJoin('commune_odonymes', 'commune_odonymes.code_insee', 'ref_communes.code_insee')
    .innerJoin('ref_odonymes', 'ref_odonymes.id', 'commune_odonymes.odonyme_id')
    .select(['ref_odonymes.id', 'ref_odonymes.rarete'])
    .where('ref_communes.code_region', '=', codeRegion)
    .where('ref_odonymes.rarete', 'in', TWIN_RARITIES)
    .distinct()
    .execute();
}

/** Communes liées à l'odonyme, sans filtre de rareté (repli élargi). */
async function communesWithOdonymeAny(exec: Executor, odonymeId: string): Promise<CommuneRef[]> {
  return exec
    .selectFrom('commune_odonymes')
    .innerJoin('ref_communes', 'ref_communes.code_insee', 'commune_odonymes.code_insee')
    .select(['ref_communes.code_insee', 'ref_communes.rarete'])
    .where('commune_odonymes.odonyme_id', '=', odonymeId)
    .execute();
}

async function nationalOdonymes(exec: Executor): Promise<OdonymeRef[]> {
  return exec
    .selectFrom('ref_odonymes')
    .select(['id', 'rarete'])
    .where('rarete', 'in', TWIN_RARITIES)
    .orderBy('id')
    .execute();
}

async function nationalCommunes(exec: Executor): Promise<CommuneRef[]> {
  return exec
    .selectFrom('ref_communes')
    .select(['code_insee', 'rarete'])
    .where('rarete', 'in', TWIN_RARITIES)
    .orderBy('code_insee')
    .execute();
}

/** Deux cartes INHABITUELLE/RARE géographiquement liées à la Pépite. */
async function drawTwins(exec: Executor, treasure: DrawnCard, rng: Rng): Promise<TicketCardRef[]> {
  const candidates: TicketCardRef[] = [];
  const seen = new Set<string>();

  const addCommune = (list: CommuneRef[]): void => {
    for (const c of list) {
      const key = `COMMUNE:${c.code_insee}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({ category: 'COMMUNE', ref_code: c.code_insee, rarity: c.rarete });
      }
    }
  };
  const addOdonyme = (list: OdonymeRef[]): void => {
    for (const o of list) {
      const key = `RUE:${o.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        candidates.push({ category: 'RUE', ref_code: o.id, rarity: o.rarete });
      }
    }
  };

  switch (treasure.card.category) {
    case 'COMMUNE': {
      const ref = treasure.card.ref_code;
      addOdonyme(await odonymesOfCommune(exec, ref));
      const commune = await exec
        .selectFrom('ref_communes')
        .select(['code_departement', 'code_region'])
        .where('code_insee', '=', ref)
        .executeTakeFirst();
      if (commune) {
        addOdonyme(await odonymesOfDepartement(exec, commune.code_departement));
        addOdonyme(await odonymesOfRegion(exec, commune.code_region));
      }
      break;
    }
    case 'RUE': {
      const ref = treasure.card.ref_code;
      addCommune(await communesWithOdonyme(exec, ref));
      addCommune(await communesWithOdonymeAny(exec, ref));
      const first = await exec
        .selectFrom('commune_odonymes')
        .innerJoin('ref_communes', 'ref_communes.code_insee', 'commune_odonymes.code_insee')
        .select('ref_communes.code_departement')
        .where('commune_odonymes.odonyme_id', '=', ref)
        .orderBy('ref_communes.code_insee')
        .limit(1)
        .executeTakeFirst();
      if (first) {
        addCommune(await communesOfDepartement(exec, first.code_departement));
      }
      break;
    }
    case 'DEPARTEMENT': {
      const ref = treasure.card.ref_code;
      const dept = await exec
        .selectFrom('ref_departements')
        .select('code_region')
        .where('code', '=', ref)
        .executeTakeFirst();
      addCommune(await communesOfDepartement(exec, ref));
      if (dept) {
        addCommune(await communesOfRegion(exec, dept.code_region));
      }
      addOdonyme(await odonymesOfDepartement(exec, ref));
      if (dept) {
        addOdonyme(await odonymesOfRegion(exec, dept.code_region));
      }
      break;
    }
    case 'REGION': {
      const ref = treasure.card.ref_code;
      // Département de la région, sinon n'importe quel département.
      const deptRows = await exec
        .selectFrom('ref_departements')
        .select('code')
        .where('code_region', '=', ref)
        .orderBy('code')
        .execute();
      let deptCode = shuffle(
        deptRows.map((d) => d.code),
        rng,
      )[0];
      if (!deptCode) {
        const anyDept = await exec
          .selectFrom('ref_departements')
          .select('code')
          .orderBy('code')
          .execute();
        deptCode = shuffle(
          anyDept.map((d) => d.code),
          rng,
        )[0];
      }
      if (deptCode) {
        candidates.push({
          category: 'DEPARTEMENT',
          ref_code: deptCode,
          rarity: weightedRarity(rng, TWIN_RARITIES),
        });
      }
      addCommune(await communesOfRegion(exec, ref));
      break;
    }
  }

  const twins = shuffle(candidates, rng).slice(0, 2);

  // Filet de sécurité national : complète depuis un pool global quand les
  // candidats géographiques sont insuffisants.
  if (twins.length < 2) {
    const chosen = new Set(twins.map((t) => `${t.category}:${t.ref_code}`));
    const pool: TicketCardRef[] = [];
    for (const c of await nationalCommunes(exec)) {
      const key = `COMMUNE:${c.code_insee}`;
      if (!chosen.has(key)) {
        pool.push({ category: 'COMMUNE', ref_code: c.code_insee, rarity: c.rarete });
      }
    }
    for (const o of await nationalOdonymes(exec)) {
      const key = `RUE:${o.id}`;
      if (!chosen.has(key)) {
        pool.push({ category: 'RUE', ref_code: o.id, rarity: o.rarete });
      }
    }
    for (const p of shuffle(pool, rng)) {
      if (twins.length >= 2) break;
      twins.push(p);
    }
  }

  if (twins.length < 2) {
    throw new HttpError(503, 'REFERENCE_DATA_MISSING', 'Données de référence indisponibles.');
  }
  return twins.slice(0, 2);
}

/**
 * Génère un ticket : 16 cases = 1 Pépite + 2 jumelés + 3 panneaux + 10 routes,
 * puis pré-révèle gratuitement une case CARD.
 */
export async function generateTicket(
  exec: Executor,
  userId: string,
  rng: Rng = Math.random,
): Promise<{ ticketId: string }> {
  const treasureCategory = weightedCategory(rng);
  const treasureRarity = weightedRarity(rng, TREASURE_RARITIES);
  const treasure = await drawCard(exec, treasureCategory, treasureRarity, rng);

  const twins = await drawTwins(exec, treasure, rng);

  const belvedere = await drawCard(exec, 'COMMUNE', undefined, rng);
  const renovation = await drawCard(exec, weightedCategory(rng), undefined, rng);

  const cardCells: TicketCell[] = [];
  for (let i = 0; i < 10; i++) {
    const category = weightedCategory(rng, CARD_CATEGORIES);
    const rarity = weightedRarity(rng, CARD_RARITIES);
    const drawn = await drawCard(exec, category, rarity, rng);
    cardCells.push({ kind: 'CARD', card: drawn.card });
  }

  const twinA = twins[0];
  const twinB = twins[1];
  if (!twinA || !twinB) {
    throw new HttpError(503, 'REFERENCE_DATA_MISSING', 'Données de référence indisponibles.');
  }

  const cells: TicketCell[] = [
    { kind: 'TREASURE', card: treasure.card },
    { kind: 'TWIN', card: twinA },
    { kind: 'TWIN', card: twinB },
    { kind: 'STATION' },
    { kind: 'BELVEDERE', card: belvedere.card },
    { kind: 'RENOVATION', card: renovation.card },
    ...cardCells,
  ];

  const shuffled = shuffle(cells, rng);
  const treasureIndex = shuffled.findIndex((c) => c.kind === 'TREASURE');
  if (treasureIndex < 0) {
    throw new HttpError(503, 'REFERENCE_DATA_MISSING', 'Données de référence indisponibles.');
  }

  const ticketId = crypto.randomUUID();

  await exec
    .insertInto('tickets')
    .values({
      id: ticketId,
      user_id: userId,
      status: 'ACTIVE',
      grid: shuffled,
      treasure_index: treasureIndex,
      scrapes_remaining: 4,
      renovation_pending: false,
      expires_at: null,
    })
    .execute();

  const cardIndex = shuffled.findIndex((c) => c.kind === 'CARD');
  const cell = shuffled[cardIndex];
  if (cell?.kind !== 'CARD') {
    throw new HttpError(503, 'REFERENCE_DATA_MISSING', 'Données de référence indisponibles.');
  }
  const meta = await resolveCardMeta(
    exec,
    cell.card.category,
    cell.card.ref_code,
    cell.card.rarity,
  );
  const cardId = await insertUserCard(exec, userId, cell.card, meta.score);
  await exec
    .insertInto('ticket_reveals')
    .values({
      ticket_id: ticketId,
      cell_index: cardIndex,
      card_user_id: cardId,
      distance: manhattanDistance(cardIndex, treasureIndex),
    })
    .execute();

  return { ticketId };
}
