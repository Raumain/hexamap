import { defineConfig, devices } from '@playwright/test';

// Le banc E2E tourne dans le réseau Docker (`docker-compose.e2e.yml`) : le web
// est joignable via l'alias `hexamap.test`, l'API directement via `api:3000`.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:8080';

export default defineConfig({
  testDir: './tests',
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
