import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

// Le banc E2E tourne dans le réseau Docker (`docker-compose.e2e.yml`) : Caddy
// est la bordure TLS et publie l'origine `https://hexamap.test`, qui relaie vers
// l'API (`api:3000`). Le banc est en HTTPS parce qu'un service worker ne
// s'enregistre que dans un contexte sécurisé ; le certificat sort de l'AC
// interne de Caddy, absente de tout trust store, d'où `ignoreHTTPSErrors`.
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
    // L'AC interne de Caddy n'est dans aucun trust store : le réglage est
    // GLOBAL, sans quoi les projets tactiles échoueraient à la poignée de main.
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      // Les parcours écrits pour le bureau ne sont pas rejoués sous une coquille
      // mobile : `mobile.spec.ts` porte les seuls contrôles tactiles, et
      // `pwa.spec.ts` a son propre projet.
      name: 'chromium',
      testIgnore: [/mobile\.spec\.ts/, /pwa\.spec\.ts/],
      use: { ...devices['Desktop Chrome'] },
    },
    {
      // Le worker ne se vérifie que sur un navigateur de bureau, sous HTTPS :
      // les appareils tactiles n'ont pas de projet PWA distinct ici.
      name: 'pwa',
      testMatch: /pwa\.spec\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // `serviceWorkers: 'allow'` est la valeur par défaut de Playwright :
        // elle est déclarée pour que l'exigence reste lisible.
        serviceWorkers: 'allow',
        // `ignoreHTTPSErrors` n'atteint pas le téléchargement du script du
        // worker : il passe par la pile réseau de Chrome, pas par le routage
        // CDP de Playwright. Sans ce commutateur, l'enregistrement échoue en
        // `SecurityError: An SSL certificate error occurred when fetching the
        // script`. Il est donc local au projet qui enregistre un worker.
        launchOptions: { args: ['--ignore-certificate-errors'] },
      },
    },
    {
      name: 'Pixel 7',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'iPhone 13',
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices['iPhone 13'] },
    },
  ],
});
