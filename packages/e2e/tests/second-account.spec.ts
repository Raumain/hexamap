import { expect, test } from '@playwright/test';
import { readSecondAccountFixture, secondStorageStatePath } from '../fixtures/second-account';

// Le second compte n'est pas une ligne SQL : il est inscrit par la vraie route
// d'authentification, et sa session est déposée sur disque. Ce cas prouve que
// le fichier produit est réellement consommable — un cookie mal formé, un
// domaine faux ou un état vide laisseraient la salle retomber sur Le Seuil.

test.describe('Le second compte du banc', () => {
  // La configuration pose `storageState` globalement : ce fichier le remplace
  // par celui du second joueur, sans toucher au `playwright.config.ts`.
  test.use({ storageState: secondStorageStatePath });

  test('second compte — la session du vendeur est réellement authentifiée', async ({ page }) => {
    const fixture = readSecondAccountFixture();

    await page.goto('/collection', { waitUntil: 'domcontentloaded' });

    // Une session absente redirigerait vers Le Seuil : l'URL est le premier
    // signe que le cookie a été accepté.
    await expect(page).toHaveURL(/\/collection/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

    // Aucun formulaire de connexion ne doit subsister dans la page.
    await expect(page.locator('input[type=password]')).toHaveCount(0);

    // La carte semée par la fixture est la seule du compte : le compteur de la
    // collection relie la session à la donnée, pas seulement au cookie.
    const cards = page.getByRole('table', { name: 'Liste des cartes de votre collection' });
    await expect(cards).toBeVisible();
    await expect(cards.getByRole('row')).not.toHaveCount(0);
    await expect(page.getByText(/1 carte affichée sur 1 carte/)).toBeVisible();

    // Le pseudo est l'identité du compte ; l'état enregistré doit désigner le même.
    expect(fixture.pseudo).toBe('e2e-second');
  });
});
