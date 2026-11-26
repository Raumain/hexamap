import { queryOptions } from '@tanstack/react-query';
import { accountErrorMessage } from '../content/account';
import { api } from './api';
import { isApiErrorValue } from './tickets';

export class AccountApiError extends Error {
  readonly code: string | null;

  constructor(message: string, code: string | null) {
    super(message);
    this.name = 'AccountApiError';
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
  return { code: null, message: accountErrorMessage(null) };
}

function throwAccountError(value: unknown): never {
  const info = toApiErrorInfo(value);
  throw new AccountApiError(info.message, info.code);
}

/** Le message affiché vient du code stable, jamais de la phrase du serveur. */
export function accountErrorMessageOf(error: unknown): string {
  if (error instanceof AccountApiError) {
    return accountErrorMessage(error.code);
  }
  if (error instanceof Error && error.message.length > 0) {
    return error.message;
  }
  return accountErrorMessage(null);
}

export async function updatePseudo(pseudo: string): Promise<string> {
  const { data, error } = await api.api.v1.account.pseudo.patch({ pseudo });
  if (error) throwAccountError(error);
  if (data && typeof data === 'object' && 'pseudo' in data) {
    return data.pseudo;
  }
  throwAccountError(data);
}

export interface EmailChangeRequest {
  readonly pending: true;
  /** L'ANCIEN courriel : il reste en base tant que le lien n'est pas ouvert. */
  readonly email: string;
}

export async function requestEmailChange(newEmail: string): Promise<EmailChangeRequest> {
  const { data, error } = await api.api.v1.account.email.post({ newEmail });
  if (error) throwAccountError(error);
  if (data && typeof data === 'object' && 'pending' in data) {
    return { pending: true, email: data.email };
  }
  throwAccountError(data);
}

export interface PasswordChangeInput {
  readonly currentPassword?: string;
  readonly newPassword: string;
}

export async function changePassword(input: PasswordChangeInput): Promise<void> {
  const { data, error } = await api.api.v1.account.password.post({
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  });
  if (error) throwAccountError(error);
  if (data && typeof data === 'object' && 'status' in data) {
    return;
  }
  throwAccountError(data);
}

export interface AccountDeletionInput {
  readonly password: string;
  readonly confirmation: string;
}

export interface AccountDeletionResult {
  readonly cascade: Record<string, number>;
}

export async function deleteAccount(input: AccountDeletionInput): Promise<AccountDeletionResult> {
  const { data, error } = await api.api.v1.account.delete({
    password: input.password,
    confirmation: input.confirmation,
  });
  if (error) throwAccountError(error);
  if (data && typeof data === 'object' && 'deleted' in data) {
    return { cascade: data.cascade };
  }
  throwAccountError(data);
}

export interface AccountProfile {
  readonly bio: string | null;
  readonly profilePublic: boolean;
}

export interface AccountProfileInput {
  readonly bio?: string | null;
  readonly profilePublic?: boolean;
}

export async function saveAccountProfile(input: AccountProfileInput): Promise<AccountProfile> {
  const { data, error } = await api.api.v1.profile.patch({
    bio: input.bio,
    profilePublic: input.profilePublic,
  });
  if (error) throwAccountError(error);
  if (data && typeof data === 'object' && 'profile' in data) {
    return { bio: data.profile.bio, profilePublic: data.profile.profilePublic };
  }
  throwAccountError(data);
}

export const accountProfileQueryKey = ['account', 'profile'] as const;

/**
 * L'état réel de la vitrine — `bio` et `profilePublic`. La lecture vit sur la
 * même route que l'écriture (`GET /profile`), donc les réglages se relisent
 * sans passer par l'export du compte, qui est une pièce jointe.
 */
async function fetchAccountProfile(): Promise<AccountProfile> {
  const { data, error } = await api.api.v1.profile.get();
  if (error) throwAccountError(error);
  if (data && typeof data === 'object' && 'profile' in data) {
    return { bio: data.profile.bio, profilePublic: data.profile.profilePublic };
  }
  throwAccountError(data);
}

export function accountProfileQueryOptions() {
  return queryOptions({
    queryKey: accountProfileQueryKey,
    queryFn: fetchAccountProfile,
    staleTime: 60_000,
    retry: false,
  });
}

export interface AccountCapabilities {
  /** La fermeture de compte est-elle ouverte côté serveur ? */
  readonly deletion: boolean;
  /**
   * La capacité de vérification d'adresse, rendue par le serveur et **toujours
   * `false`** depuis R-001 : le produit n'a aucun transport de courriel. La clé
   * reste au contrat pour qu'aucun écran n'ait à apprendre son absence par un
   * champ manquant, et aucun écran ne décide plus en fonction d'elle.
   */
  readonly emailVerification: boolean;
}

export const accountCapabilitiesQueryKey = ['account', 'capabilities'] as const;

/**
 * Ce que le serveur sait réellement faire maintenant — l'interrupteur de
 * suppression et le transport de courriel se lisent par appel, jamais figés
 * dans le bundle. L'écran ne propose donc rien qui ne pourrait que répondre
 * `503`.
 */
async function fetchAccountCapabilities(): Promise<AccountCapabilities> {
  const { data, error } = await api.api.v1.account.capabilities.get();
  if (error) throwAccountError(error);
  if (data && typeof data === 'object' && 'deletion' in data) {
    return { deletion: data.deletion, emailVerification: data.emailVerification };
  }
  throwAccountError(data);
}

export function accountCapabilitiesQueryOptions() {
  return queryOptions({
    queryKey: accountCapabilitiesQueryKey,
    queryFn: fetchAccountCapabilities,
    staleTime: 60_000,
    retry: false,
  });
}
