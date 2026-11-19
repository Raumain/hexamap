import type { CardCategory, Database, Rarity } from '@hexamap/db';
import {
  CATEGORY,
  CATEGORY_WEIGHTS,
  type Category,
  departementPopulationBonus,
  editionScore,
  RARITY,
  RARITY_WEIGHTS,
} from '@hexamap/shared';
import type { Kysely, Transaction } from 'kysely';
import { HttpError } from '../lib/http-error';
import { pickWeighted, type Rng } from './rng';

/** Contexte d'exécution accepté par les services : instance Kysely ou transaction. */
export type Executor = Kysely<Database> | Transaction<Database>;

export interface DrawnCard {
  card: { category: CardCategory; ref_code: string; rarity: Rarity };
  nom: string;
  score: number;
  /** 0 pour COMMUNE/RUE et REGION ; bonus de population pour DEPARTEMENT. */
  editionBonus: number;
}

export interface CardMeta {
  nom: string;
  score: number;
  editionBonus: number;
  blasonUrl: string | null;
  blasonCredit: string | null;
}

function referenceMissing(): HttpError {
  return new HttpError(503, 'REFERENCE_DATA_MISSING', 'Données de référence indisponibles.');
}

/** Palier supérieur (plafonné à MYTHIQUE). */
export function rarityUp(r: Rarity): Rarity {
  const index = RARITY.indexOf(r);
  return RARITY[Math.min(index + 1, RARITY.length - 1)] ?? 'MYTHIQUE';
}

/** Rareté pondérée sur `allowed` (défaut : toutes), poids renormalisés. */
export function weightedRarity(rng: Rng, allowed?: Rarity[]): Rarity {
  const pool = allowed ?? [...RARITY];
  return pickWeighted(
    pool.map((r) => ({ value: r, weight: RARITY_WEIGHTS[r] })),
    rng,
  );
}

/** Catégorie pondérée sur `allowed` (défaut : toutes), poids renormalisés. */
export function weightedCategory(rng: Rng, allowed?: Category[]): Category {
  const pool = allowed ?? [...CATEGORY];
  return pickWeighted(
    pool.map((c) => ({ value: c, weight: CATEGORY_WEIGHTS[c] })),
    rng,
  );
}

/** Palier demandé d'abord, puis les voisins par distance croissante (palier plus bas prioritaire). */
export function fallbackRarities(requested: Rarity): Rarity[] {
  const index = RARITY.indexOf(requested);
  const order: Rarity[] = [];
  for (let distance = 0; distance < RARITY.length; distance++) {
    const lower = RARITY[index - distance];
    const upper = RARITY[index + distance];
    if (distance === 0) {
      if (lower) order.push(lower);
      continue;
    }
    if (lower) order.push(lower);
    if (upper) order.push(upper);
  }
  return order;
}

async function drawRegion(exec: Executor, rarity: Rarity, rng: Rng): Promise<DrawnCard> {
  const countRow = await exec
    .selectFrom('ref_regions')
    .select(exec.fn.countAll().as('total'))
    .executeTakeFirstOrThrow();
  const total = Number(countRow.total);
  if (total === 0) {
    throw referenceMissing();
  }
  const offset = Math.min(Math.floor(rng() * total), total - 1);
  const row = await exec
    .selectFrom('ref_regions')
    .select(['code', 'nom'])
    .orderBy('code')
    .offset(offset)
    .limit(1)
    .executeTakeFirst();
  if (!row) {
    throw referenceMissing();
  }
  return {
    card: { category: 'REGION', ref_code: row.code, rarity },
    nom: row.nom,
    score: editionScore(rarity),
    editionBonus: 0,
  };
}

async function drawDepartement(exec: Executor, rarity: Rarity, rng: Rng): Promise<DrawnCard> {
  const countRow = await exec
    .selectFrom('ref_departements')
    .select(exec.fn.countAll().as('total'))
    .executeTakeFirstOrThrow();
  const total = Number(countRow.total);
  if (total === 0) {
    throw referenceMissing();
  }
  const offset = Math.min(Math.floor(rng() * total), total - 1);
  const row = await exec
    .selectFrom('ref_departements')
    .select(['code', 'nom', 'population'])
    .orderBy('code')
    .offset(offset)
    .limit(1)
    .executeTakeFirst();
  if (!row) {
    throw referenceMissing();
  }
  const bonus = departementPopulationBonus(row.population);
  return {
    card: { category: 'DEPARTEMENT', ref_code: row.code, rarity },
    nom: row.nom,
    score: editionScore(rarity) + bonus,
    editionBonus: bonus,
  };
}

// COMMUNE/RUE : le `score` retourné est le `score_base` intrinsèque du
// référentiel (une commune/rue possède une seule rareté intrinsèque). Un
// `rarityUp` ultérieur (panneau RENOVATION) ne change que le *libellé
// d'édition* de la carte ; le score de tableau est calculé en Phase 8, pas ici.
// Palier demandé vide : repli sur le palier voisin, la rareté retournée restant
// celle de la ligne référentielle (pour garder rareté et score_base cohérents).
async function drawCommune(exec: Executor, rarity: Rarity, rng: Rng): Promise<DrawnCard> {
  for (const tier of fallbackRarities(rarity)) {
    const countRow = await exec
      .selectFrom('ref_communes')
      .select(exec.fn.countAll().as('total'))
      .where('rarete', '=', tier)
      .executeTakeFirstOrThrow();
    const total = Number(countRow.total);
    if (total === 0) {
      continue;
    }
    const offset = Math.min(Math.floor(rng() * total), total - 1);
    const row = await exec
      .selectFrom('ref_communes')
      .select(['code_insee', 'nom', 'score_base', 'rarete'])
      .where('rarete', '=', tier)
      .orderBy('code_insee')
      .offset(offset)
      .limit(1)
      .executeTakeFirst();
    if (!row) {
      continue;
    }
    return {
      card: { category: 'COMMUNE', ref_code: row.code_insee, rarity: row.rarete },
      nom: row.nom,
      score: row.score_base,
      editionBonus: 0,
    };
  }
  throw referenceMissing();
}

async function drawRue(exec: Executor, rarity: Rarity, rng: Rng): Promise<DrawnCard> {
  for (const tier of fallbackRarities(rarity)) {
    const countRow = await exec
      .selectFrom('ref_odonymes')
      .select(exec.fn.countAll().as('total'))
      .where('rarete', '=', tier)
      .executeTakeFirstOrThrow();
    const total = Number(countRow.total);
    if (total === 0) {
      continue;
    }
    const offset = Math.min(Math.floor(rng() * total), total - 1);
    const row = await exec
      .selectFrom('ref_odonymes')
      .select(['id', 'nom_affichage', 'score_base', 'rarete'])
      .where('rarete', '=', tier)
      .orderBy('id')
      .offset(offset)
      .limit(1)
      .executeTakeFirst();
    if (!row) {
      continue;
    }
    return {
      card: { category: 'RUE', ref_code: row.id, rarity: row.rarete },
      nom: row.nom_affichage,
      score: row.score_base,
      editionBonus: 0,
    };
  }
  throw referenceMissing();
}

/**
 * Tire une carte d'une catégorie et d'une rareté (optionnelle : pondérée).
 * REGION/DEPARTEMENT : tirage uniforme, rareté d'édition.
 * COMMUNE/RUE : tirage uniforme dans le palier `rarete = rarity`.
 */
export async function drawCard(
  exec: Executor,
  category: CardCategory,
  rarity: Rarity | undefined,
  rng: Rng = Math.random,
): Promise<DrawnCard> {
  switch (category) {
    case 'REGION':
      return drawRegion(exec, rarity ?? weightedRarity(rng), rng);
    case 'DEPARTEMENT':
      return drawDepartement(exec, rarity ?? weightedRarity(rng), rng);
    case 'COMMUNE':
      return drawCommune(exec, rarity ?? weightedRarity(rng), rng);
    case 'RUE':
      return drawRue(exec, rarity ?? weightedRarity(rng), rng);
  }
}

/**
 * Résout les métadonnées (nom, score) d'une carte par clé primaire, pour une
 * rareté donnée. Utilisé lors de l'octroi depuis une case de grille, qui ne
 * stocke que `{ category, ref_code, rarity }`.
 */
export async function resolveCardMeta(
  exec: Executor,
  category: CardCategory,
  refCode: string,
  rarity: Rarity,
): Promise<CardMeta> {
  switch (category) {
    case 'REGION': {
      const row = await exec
        .selectFrom('ref_regions')
        .select(['nom', 'blason_url', 'contour_url', 'blason_credit'])
        .where('code', '=', refCode)
        .executeTakeFirst();
      if (!row) {
        throw referenceMissing();
      }
      return {
        nom: row.nom,
        score: editionScore(rarity),
        editionBonus: 0,
        ...blasonOf(row),
      };
    }
    case 'DEPARTEMENT': {
      const row = await exec
        .selectFrom('ref_departements')
        .select(['nom', 'population', 'blason_url', 'contour_url', 'blason_credit'])
        .where('code', '=', refCode)
        .executeTakeFirst();
      if (!row) {
        throw referenceMissing();
      }
      const bonus = departementPopulationBonus(row.population);
      return {
        nom: row.nom,
        score: editionScore(rarity) + bonus,
        editionBonus: bonus,
        ...blasonOf(row),
      };
    }
    case 'COMMUNE': {
      const row = await exec
        .selectFrom('ref_communes')
        .select(['nom', 'score_base', 'blason_url', 'contour_url', 'blason_credit'])
        .where('code_insee', '=', refCode)
        .executeTakeFirst();
      if (!row) {
        throw referenceMissing();
      }
      return {
        nom: row.nom,
        score: row.score_base,
        editionBonus: 0,
        ...blasonOf(row),
      };
    }
    case 'RUE': {
      const row = await exec
        .selectFrom('ref_odonymes')
        .select(['nom_affichage', 'score_base'])
        .where('id', '=', refCode)
        .executeTakeFirst();
      if (!row) {
        throw referenceMissing();
      }
      // Une rue n'a pas de blason : `ref_odonymes` ne porte aucune colonne d'image.
      return {
        nom: row.nom_affichage,
        score: row.score_base,
        editionBonus: 0,
        blasonUrl: null,
        blasonCredit: null,
      };
    }
  }
}

export function cardNomKey(category: CardCategory, refCode: string): string {
  return `${category}:${refCode}`;
}

/**
 * Résout les noms d'une liste de cartes par lots groupés par catégorie
 * (au plus 4 requêtes). Retourne une map indexée par `category:ref_code`.
 */
export async function resolveCardNoms(
  exec: Executor,
  cards: ReadonlyArray<{ category: CardCategory; ref_code: string }>,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const byCategory = new Map<CardCategory, string[]>();

  for (const card of cards) {
    const list = byCategory.get(card.category) ?? [];
    list.push(card.ref_code);
    byCategory.set(card.category, list);
  }

  for (const [category, refs] of byCategory) {
    const uniqueRefs = [...new Set(refs)];
    switch (category) {
      case 'REGION': {
        const rows = await exec
          .selectFrom('ref_regions')
          .select(['code', 'nom'])
          .where('code', 'in', uniqueRefs)
          .execute();
        for (const r of rows) {
          result.set(cardNomKey('REGION', r.code), r.nom);
        }
        break;
      }
      case 'DEPARTEMENT': {
        const rows = await exec
          .selectFrom('ref_departements')
          .select(['code', 'nom'])
          .where('code', 'in', uniqueRefs)
          .execute();
        for (const r of rows) {
          result.set(cardNomKey('DEPARTEMENT', r.code), r.nom);
        }
        break;
      }
      case 'COMMUNE': {
        const rows = await exec
          .selectFrom('ref_communes')
          .select(['code_insee', 'nom'])
          .where('code_insee', 'in', uniqueRefs)
          .execute();
        for (const r of rows) {
          result.set(cardNomKey('COMMUNE', r.code_insee), r.nom);
        }
        break;
      }
      case 'RUE': {
        const rows = await exec
          .selectFrom('ref_odonymes')
          .select(['id', 'nom_affichage'])
          .where('id', 'in', uniqueRefs)
          .execute();
        for (const r of rows) {
          result.set(cardNomKey('RUE', r.id), r.nom_affichage);
        }
        break;
      }
    }
  }

  return result;
}

/** Assets de blason résolus pour une carte. */
export interface CardAssets {
  blasonUrl: string | null;
  blasonCredit: string | null;
}

/**
 * Règle unique du repli visuel : le blason, sinon le contour géographique.
 * Toutes les lectures d'assets (cartes, marché, révélation) passent par ici.
 */
export function blasonOf(row: {
  blason_url: string | null;
  contour_url: string | null;
  blason_credit: string | null;
}): CardAssets {
  return {
    blasonUrl: row.blason_url ?? row.contour_url,
    blasonCredit: row.blason_credit,
  };
}

/**
 * Résout les assets de blason d'une liste de cartes par lots groupés par
 * catégorie (au plus 3 requêtes ; les rues n'ont pas de blason). Retourne une
 * map indexée par `category:ref_code`, avec `{ blasonUrl: null, blasonCredit:
 * null }` pour les codes sans correspondance.
 */
export async function resolveCardAssets(
  exec: Executor,
  cards: ReadonlyArray<{ category: CardCategory; ref_code: string }>,
): Promise<Map<string, CardAssets>> {
  const result = new Map<string, CardAssets>();
  const byCategory = new Map<CardCategory, string[]>();

  for (const card of cards) {
    result.set(cardNomKey(card.category, card.ref_code), {
      blasonUrl: null,
      blasonCredit: null,
    });
    const list = byCategory.get(card.category) ?? [];
    list.push(card.ref_code);
    byCategory.set(card.category, list);
  }

  for (const [category, refs] of byCategory) {
    const uniqueRefs = [...new Set(refs)];
    switch (category) {
      case 'REGION': {
        const rows = await exec
          .selectFrom('ref_regions')
          .select(['code', 'blason_url', 'contour_url', 'blason_credit'])
          .where('code', 'in', uniqueRefs)
          .execute();
        for (const r of rows) {
          result.set(cardNomKey('REGION', r.code), blasonOf(r));
        }
        break;
      }
      case 'DEPARTEMENT': {
        const rows = await exec
          .selectFrom('ref_departements')
          .select(['code', 'blason_url', 'contour_url', 'blason_credit'])
          .where('code', 'in', uniqueRefs)
          .execute();
        for (const r of rows) {
          result.set(cardNomKey('DEPARTEMENT', r.code), blasonOf(r));
        }
        break;
      }
      case 'COMMUNE': {
        const rows = await exec
          .selectFrom('ref_communes')
          .select(['code_insee', 'blason_url', 'contour_url', 'blason_credit'])
          .where('code_insee', 'in', uniqueRefs)
          .execute();
        for (const r of rows) {
          result.set(cardNomKey('COMMUNE', r.code_insee), blasonOf(r));
        }
        break;
      }
      case 'RUE': {
        // Pas de blason : la plaque émaillée CSS suffit.
        break;
      }
    }
  }

  return result;
}
