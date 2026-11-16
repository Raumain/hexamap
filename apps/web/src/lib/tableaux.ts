import type {
  Category,
  Rarity,
  TableauAlignment,
  TableauGeography,
  TableauSlot,
} from '@hexamap/shared';
import { keepPreviousData, queryOptions } from '@tanstack/react-query';
import { api } from './api';
import type { CollectionCard } from './collection';
import { isApiErrorValue } from './tickets';

const FALLBACK_MESSAGE = 'Une erreur est survenue. Réessayez.';

export class TableauApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'TableauApiError';
    this.code = code;
  }
}

function toApiErrorInfo(value: unknown): { code: string | null; message: string } {
  // Eden renvoie `error` sous la forme `{ status, value }` ; l'extraction suit.
  if (typeof value === 'object' && value !== null && 'value' in value) {
    const body = value.value;
    if (isApiErrorValue(body)) {
      return { code: body.code, message: body.message };
    }
  }
  if (isApiErrorValue(value)) {
    return { code: value.code, message: value.message };
  }
  return { code: null, message: FALLBACK_MESSAGE };
}

function throwTableauError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new TableauApiError(info.message, info.code);
}

export interface TableauPreviewIds {
  regionCardId: string | null;
  departementCardId: string | null;
  communeCardId: string | null;
  rueCardId: string | null;
}

export interface TableauPreview {
  geography: TableauGeography;
  alignment: TableauAlignment;
  total: number | null;
  complete: boolean;
}

export interface TableauSlotCard {
  id: string;
  category: Category;
  refCode: string;
  nom: string;
  rarity: Rarity;
  score: number;
  locked: boolean;
  slot: TableauSlot;
}

export interface CreatedTableau {
  id: string;
  name: string;
  createdAt: string;
  cards: {
    region: TableauSlotCard;
    departement: TableauSlotCard;
    commune: TableauSlotCard;
    rue: TableauSlotCard;
  };
  alignment: TableauAlignment;
  total: number;
}

export interface CreateTableauInput {
  name?: string;
  regionCardId: string;
  departementCardId: string;
  communeCardId: string;
  rueCardId: string;
}

export function tableauPreviewQueryKey(ids: TableauPreviewIds) {
  return [
    'tableaux',
    'preview',
    ids.regionCardId ?? null,
    ids.departementCardId ?? null,
    ids.communeCardId ?? null,
    ids.rueCardId ?? null,
  ] as const;
}

export function selectionToPreviewIds(
  selection: Partial<Record<TableauSlot, CollectionCard>>,
): TableauPreviewIds {
  return {
    regionCardId: selection.REGION?.id ?? null,
    departementCardId: selection.DEPARTEMENT?.id ?? null,
    communeCardId: selection.COMMUNE?.id ?? null,
    rueCardId: selection.RUE?.id ?? null,
  };
}

export async function fetchTableauPreview(ids: TableauPreviewIds): Promise<TableauPreview> {
  const { data, error } = await api.api.v1.tableaux.preview.get({
    query: {
      regionCardId: ids.regionCardId ?? undefined,
      departementCardId: ids.departementCardId ?? undefined,
      communeCardId: ids.communeCardId ?? undefined,
      rueCardId: ids.rueCardId ?? undefined,
    },
  });
  if (error) throwTableauError(error);
  if (data && typeof data === 'object' && 'geography' in data) {
    return data;
  }
  throwTableauError(data);
}

export function tableauPreviewQueryOptions(
  selection: Partial<Record<TableauSlot, CollectionCard>>,
) {
  const ids = selectionToPreviewIds(selection);
  return queryOptions({
    queryKey: tableauPreviewQueryKey(ids),
    queryFn: () => fetchTableauPreview(ids),
    enabled:
      ids.regionCardId !== null ||
      ids.departementCardId !== null ||
      ids.communeCardId !== null ||
      ids.rueCardId !== null,
    staleTime: 10_000,
    retry: false,
    placeholderData: keepPreviousData,
  });
}

export async function createTableau(input: CreateTableauInput): Promise<CreatedTableau> {
  const { data, error } = await api.api.v1.tableaux.post(input);
  if (error) throwTableauError(error);
  if (data && typeof data === 'object' && 'tableau' in data) {
    return data.tableau;
  }
  throwTableauError(data);
}

export function tableauErrorMessage(error: unknown): string {
  if (error instanceof TableauApiError) {
    switch (error.code) {
      case 'CARD_NOT_OWNED':
        return 'Vous ne possédez plus ces cartes ou elles sont verrouillées.';
      case 'CARD_IN_USE':
        return 'Une de ces cartes est déjà utilisée dans un autre tableau.';
      case 'INVALID_CARD_SET':
        return 'Cette combinaison de cartes est invalide.';
      default:
        break;
    }
  }
  return error instanceof Error ? error.message : FALLBACK_MESSAGE;
}

export const tableauxListQueryKey = ['tableaux', 'list'] as const;

export async function fetchTableaux() {
  const { data, error } = await api.api.v1.tableaux.get();
  if (error) throwTableauError(error);
  if (data && typeof data === 'object' && 'items' in data) {
    return data;
  }
  throwTableauError(data);
}

export type TableauxListResult = NonNullable<Awaited<ReturnType<typeof fetchTableaux>>>;
export type TableauListItem = TableauxListResult['items'][number];

export const tableauxQueryOptions = queryOptions({
  queryKey: tableauxListQueryKey,
  queryFn: fetchTableaux,
  staleTime: 15_000,
  retry: false,
});
