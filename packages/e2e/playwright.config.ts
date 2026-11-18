import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Le banc E2E tourne dans le réseau Docker (`docker-compose.e2e.yml`) : le web
// est joignable via l'alias `hexamap.test`, l'API directement via `api:3000`.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

// Chemins absolus : la configuration reste valable que Playwright soit lancé
// depuis la racine du dépôt ou depuis `packages/e2e`.
const packageRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests',
  // Le `globalSetup` inscrit le compte de démonstration et dépose son
  // `storageState` : les specs démarrent avec une session déjà ouverte.
  globalSetup: path.join(packageRoot, 'global-setup.ts'),
  // Une seule base de données partagée : aucune parallélisation de fichiers.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    storageState: path.join(packageRoot, '.auth', 'state.json'),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
