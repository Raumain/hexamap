import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Contrat partagé entre `global-setup.ts` (qui crée le compte et enregistre la
// collection de démonstration) et les specs (qui consomment l'état enregistré).
// Aucune donnée n'est devinée : un compte unique est créé par exécution, puis
// son `storageState` est réutilisé par tous les tests.

const e2ePackageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Répertoire ignoré par Git : il contient un cookie de session valide. */
export const authDirectory = path.join(e2ePackageRoot, '.auth');

/** Fichier `storageState` attendu par `use.storageState` dans la configuration. */
export const storageStatePath = path.join(authDirectory, 'state.json');

/** Compte créé par le `globalSetup`, avec les catégories réellement obtenues. */
export const accountPath = path.join(authDirectory, 'account.json');

export const E2E_PASSWORD = 'Grattage-E2E-2026!9';

export const CATEGORIES = ['REGION', 'DEPARTEMENT', 'COMMUNE', 'RUE'] as const;

export type Category = (typeof CATEGORIES)[number];

/** Libellés affichés dans le filtre de la collection (`COLLECTION.categoryLabel`). */
export const CATEGORY_LABELS: Record<Category, string> = {
  REGION: 'Région',
  DEPARTEMENT: 'Département',
  COMMUNE: 'Commune',
  RUE: 'Rue',
};

export interface AccountFixture {
  pseudo: string;
  email: string;
  password: string;
  /** Catégories dont l'inscription a réellement obtenu au moins une carte. */
  categories: Category[];
  ticketsScratched: number;
  createdAt: string;
}

export function readAccountFixture(): AccountFixture {
  try {
    return JSON.parse(readFileSync(accountPath, 'utf8')) as AccountFixture;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Compte E2E introuvable (${accountPath}). Le « globalSetup » n'a pas abouti : ${detail}`,
    );
  }
}
