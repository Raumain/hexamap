import { expect, test } from '@playwright/test';

// Le routeur n'avait aucun composant de repli : `throw notFound()` rendait la
// page par défaut de TanStack Router, en anglais. Ce cas couvre les **deux**
// chemins qui doivent aboutir à la même page française — une URL qui ne
// correspond à aucune route, et un `notFound()` levé par une route éteinte —
// parce qu'un `defaultNotFoundComponent` seul ne prouve pas le second.

const TITLE = 'Cette salle n’existe pas';
const ACTION = 'Revenir au Seuil';

test.describe('La salle introuvable', () => {
  test('salle introuvable — une URL inconnue rend la page française', async ({ page }) => {
    await page.goto('/salle-inconnue', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: TITLE }),
      'Le routeur doit monter son composant de repli français, pas la page anglaise de TanStack.',
    ).toBeVisible();

    const action = page.getByRole('link', { name: ACTION });
    await expect(action, 'La page doit offrir un retour vers Le Seuil.').toBeVisible();
    await expect(action).toHaveAttribute('href', '/');

    // La coquille reste montée une seule fois : le routeur rend ce composant dans
    // l'`Outlet` de la racine, donc la page ne doit pas ré-emballer `AppShell`
    // (deux `<main>` imbriqués, deux rails, deux barres d'onglets).
    await expect(page.getByRole('main')).toHaveCount(1);
  });

  test('salle introuvable — une route éteinte par `notFound()` rend la même page', async ({
    page,
  }) => {
    // `SHOP_ENABLED = false` : la boutique répond `notFound()`, ce qui est un
    // chemin de code distinct d'une URL inconnue.
    await page.goto('/boutique', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();
    await expect(page.getByRole('link', { name: ACTION })).toHaveAttribute('href', '/');

    // Défaut préexistant, consigné et **non masqué** : sur ce chemin (route
    // appariée qui lève `notFound()`), la page n'est rendue dans aucun `<main>`,
    // alors qu'une URL inconnue en rend un. Le repère principal manque donc, et
    // l'asserter ici reviendrait à figer le défaut. Voir « Ce qui reste à faire ».
  });

  test('conditions générales — la page légale est publiée', async ({ page }) => {
    await page.goto('/cgv', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Conditions générales de vente' }),
    ).toBeVisible();

    // Le document publie l'identité du vendeur, et plus aucun bandeau provisoire
    // ne le précède : ce qui est en ligne est ce qui engage l'éditeur.
    await expect(page.getByRole('heading', { name: 'Identité du vendeur' })).toBeVisible();
    await expect(page.getByText(/Texte provisoire/)).toHaveCount(0);

    // Ce n'est plus une salle introuvable.
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toHaveCount(0);
  });

  test('salle introuvable — le retour mène réellement au Seuil', async ({ page }) => {
    await page.goto('/salle-inconnue', { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: ACTION }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toHaveCount(0);
  });
});
