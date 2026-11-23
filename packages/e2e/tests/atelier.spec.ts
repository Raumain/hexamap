import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { ensureAtelierCards } from '../fixtures/atelier-fixture';
import { secondStorageStatePath } from '../fixtures/second-account';

const COLLECTION_TABLE = 'Liste des cartes de votre collection';

interface CollectionCardBody {
  id: string;
  category: string;
  refCode: string;
  nom: string;
  rarity: string;
  score: number;
  source: string;
}

interface CardsBody {
  items: CollectionCardBody[];
}

async function sessionUserId(context: BrowserContext): Promise<string> {
  const response = await context.request.get('/api/auth/get-session');
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { user: { id: string } | null };
  expect(body.user?.id).toBeTruthy();
  return body.user?.id ?? '';
}

async function collectionCards(page: Page): Promise<CollectionCardBody[]> {
  const response = await page.request.get('/api/v1/cards?limit=5000');
  expect(response.ok()).toBe(true);
  return ((await response.json()) as CardsBody).items;
}

test.describe("L'Atelier", () => {
  test('trois doublons fondent en une carte du palier supérieur', async ({ page }) => {
    const userId = await sessionUserId(page.context());
    const { refCode } = await ensureAtelierCards(userId);

    await page.goto('/collection', { waitUntil: 'domcontentloaded' });

    const before = await collectionCards(page);
    expect(
      before.filter((card) => card.refCode === refCode && card.rarity === 'RARE'),
    ).toHaveLength(3);
    const totalBefore = before.length;

    const atelier = page.getByRole('region', { name: "L'Atelier" });
    await expect(atelier).toBeVisible();
    await expect(atelier).toContainText('Commune E2E RARE 1');
    await expect(atelier).toContainText('3 × Commune E2E RARE 1 → 1 carte Épique');

    await atelier
      .getByRole('button', { name: 'Fondre les doublons de Commune E2E RARE 1' })
      .click();
    await atelier
      .getByRole('button', { name: 'Confirmer la fusion de Commune E2E RARE 1' })
      .click();

    await expect(
      page.getByText('Fusion réussie : une carte Épique de Commune E2E RARE 1.'),
    ).toBeVisible();

    const after = await collectionCards(page);
    expect(after.filter((card) => card.refCode === refCode && card.rarity === 'RARE')).toHaveLength(
      0,
    );

    const crafted = after.filter((card) => card.refCode === refCode && card.rarity === 'EPIQUE');
    expect(crafted).toHaveLength(1);
    expect(crafted[0]?.source).toBe('CRAFT');
    expect(crafted[0]?.score).toBe(1250);
    expect(after.length).toBe(totalBefore - 2);

    await expect(page.getByRole('table', { name: COLLECTION_TABLE })).toContainText(
      'Commune E2E RARE 1',
    );
  });
});

test.describe("L'Atelier face à une carte engagée", () => {
  test('une grappe bloquée affiche la raison rendue par le serveur', async ({ page }) => {
    const userId = await sessionUserId(page.context());
    const { refCode, ids } = await ensureAtelierCards(userId);
    const listedCardId = ids[0];
    expect(listedCardId).toBeTruthy();

    // La mise en vente est le seul engagement que le banc peut produire par une
    // vraie route : elle pose `locked = true`, que le service nomme « verrouillée
    // par une vente en cours ». Aucune donnée de jeu n'est écrite à la main.
    const listed = await page.request.post('/api/v1/market/listings', {
      data: { userCardId: listedCardId, price: 100 },
    });
    expect(listed.status()).toBe(201);
    const listing = (await listed.json()) as { listing: { id: string } };

    try {
      await page.goto('/collection', { waitUntil: 'domcontentloaded' });

      const atelier = page.getByRole('region', { name: "L'Atelier" });
      await expect(atelier).toBeVisible();
      // Le compteur et la règle restent lisibles alors que la fusion est refusée.
      await expect(atelier).toContainText('3 × Commune E2E RARE 1');

      await atelier
        .getByRole('button', { name: 'Fondre les doublons de Commune E2E RARE 1' })
        .click();
      await atelier
        .getByRole('button', { name: 'Confirmer la fusion de Commune E2E RARE 1' })
        .click();

      // La raison est celle du serveur, telle quelle : le panneau ne la réécrit pas.
      await expect(atelier.getByRole('alert')).toContainText(
        'Une carte de ce groupe est verrouillée par une vente en cours.',
      );
      // Le compteur d'exemplaires ne contredit pas la raison : la grappe a bien 3 copies.
      await expect(atelier).toContainText('3 × Commune E2E RARE 1');
    } finally {
      const cancelled = await page.request.delete(`/api/v1/market/listings/${listing.listing.id}`);
      expect(cancelled.ok()).toBe(true);

      // Laisse le banc là où le cas de fusion le laisse : le groupe consommé.
      const crafted = await page.request.post('/api/v1/cards/craft', {
        data: { category: 'COMMUNE', refCode, rarity: 'RARE' },
      });
      expect(crafted.status()).toBe(201);
    }
  });
});

test.describe("L'Atelier d'un compte sans doublon", () => {
  // Le second compte du banc possède exactement une carte : aucune grappe n'est
  // fusible, donc il éprouve l'état vide que la phase 48 doit rendre trouvable.
  test.use({ storageState: secondStorageStatePath });

  test('la section est trouvable et la règle est lisible sans grappe fusible', async ({ page }) => {
    await page.goto('/collection', { waitUntil: 'domcontentloaded' });

    const atelier = page.getByRole('region', { name: "L'Atelier" });
    await expect(atelier).toBeVisible();
    await expect(atelier.getByRole('heading', { level: 2, name: "L'Atelier" })).toBeVisible();

    // L'état vide explique ce qu'il faut réunir, au lieu de faire disparaître le panneau.
    await expect(atelier).toContainText('Aucune grappe à fusionner.');

    // La règle est écrite dans l'interface : trois exemplaires identiques donnent
    // un palier de plus, et la fusion ne produit jamais de carte Mythique.
    await expect(atelier).toContainText('exemplaires identiques');
    await expect(atelier).toContainText('palier suivant');
    await expect(atelier).toContainText('Légendaire');
    await expect(atelier).toContainText('Mythique');

    // Aucune grappe, donc aucune action à offrir.
    await expect(atelier.getByRole('button', { name: /^Fondre/ })).toHaveCount(0);
  });
});
