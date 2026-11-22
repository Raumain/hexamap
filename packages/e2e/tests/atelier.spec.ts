import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { ensureAtelierCards } from '../fixtures/atelier-fixture';

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
