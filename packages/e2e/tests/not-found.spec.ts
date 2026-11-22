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

  test('conditions générales — la page n’est plus publiée', async ({ page }) => {
    // La CGV est retirée de l'interface (retour R-004, phase 46) : la boutique est
    // fermée, et une page de conditions de vente n'a plus d'objet. La route est
    // **supprimée**, pas seulement déliée : `/cgv` est donc une URL inconnue et doit
    // rendre la page française de repli.
    await page.goto('/cgv', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: TITLE }),
      'La CGV ne doit plus répondre : sa route est supprimée, pas simplement déliée.',
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Conditions générales de vente' }),
    ).toHaveCount(0);
  });

  test('pieds de page — deux liens légaux, et plus de CGV', async ({ page }) => {
    // Deux pieds distincts : `HomeFooter` sur `/home`, celui de la coquille sur
    // toutes les salles. Les deux itèrent `LEGAL_LINKS` et portent la même
    // navigation « Informations légales » — `footer` seul ne suffit pas à les
    // désigner, les planches de carte en contiennent aussi.
    for (const path of ['/home', '/mentions-legales']) {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      const legalNav = page.getByRole('navigation', { name: 'Informations légales' });
      await expect(legalNav, `La page ${path} doit porter sa navigation légale.`).toHaveCount(1);

      await expect(legalNav.getByRole('link')).toHaveCount(2);
      await expect(legalNav.getByRole('link', { name: 'Mentions légales' })).toHaveAttribute(
        'href',
        '/mentions-legales',
      );
      await expect(legalNav.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute(
        'href',
        '/confidentialite',
      );
      await expect(legalNav.getByRole('link', { name: 'CGV' })).toHaveCount(0);
    }
  });

  test('pages légales restantes — mentions légales et confidentialité sont publiées', async ({
    page,
  }) => {
    await page.goto('/mentions-legales', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { level: 1, name: 'Mentions légales' }),
      'Les mentions légales restent publiées : la CGV ne les emporte pas.',
    ).toBeVisible();

    await page.goto('/confidentialite', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' }),
      'La politique de confidentialité est un préalable écrit à la publication de la suppression de compte.',
    ).toBeVisible();
  });

  test('salle introuvable — le retour mène réellement au Seuil', async ({ page }) => {
    await page.goto('/salle-inconnue', { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: ACTION }).click();

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { level: 1, name: TITLE })).toHaveCount(0);
  });
});
