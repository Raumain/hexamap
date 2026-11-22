import { randomUUID } from 'node:crypto';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { ensureTradeCards } from '../fixtures/trade-fixture';
import { E2E_PASSWORD } from './fixtures/auth';

const COLLECTION_TABLE = 'Liste des cartes de votre collection';
const REGISTRATION_TIMEOUT = 30_000;

interface SessionBody {
  user: { id: string } | null;
}

async function sessionUserId(context: BrowserContext): Promise<string> {
  const response = await context.request.get('/api/auth/get-session');
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as SessionBody;
  expect(body.user?.id).toBeTruthy();
  return body.user?.id ?? '';
}

async function registerFreshPlayer(context: BrowserContext, player: FreshPlayer): Promise<void> {
  const page = await context.newPage();
  try {
    await page.goto('/register', { waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Inscription' }).waitFor();

    await page.getByLabel('Pseudo').fill(player.pseudo);
    await page.getByLabel(/^Adresse e-mail/).fill(player.email);
    await page.getByLabel(/^Mot de passe/).fill(E2E_PASSWORD);
    await page.getByLabel(/^Confirmation du mot de passe/).fill(E2E_PASSWORD);
    await page.getByRole('button', { name: "S'inscrire" }).click();

    await page
      .getByRole('heading', { name: `Bienvenue, ${player.pseudo}.` })
      .waitFor({ timeout: REGISTRATION_TIMEOUT });
  } finally {
    await page.close();
  }
}

interface FreshPlayer {
  pseudo: string;
  email: string;
}

async function cardIds(page: Page): Promise<string[]> {
  const response = await page.request.get('/api/v1/cards?limit=5000');
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { items: Array<{ id: string }> };
  return body.items.map((item) => item.id);
}

/**
 * Une carte contre une carte, à deux comptes réels.
 *
 * Le banc réserve ses comptes aux fixtures de La Planche et de la Vitrine : le
 * troc consomme des cartes, donc ce cas inscrit son propre receveur et sème ses
 * deux cartes (`trade-fixture`). La proposition passe par l'API — la carte
 * d'autrui n'est pas exposée avant l'offre, le navigateur ne peut pas la
 * découvrir — et l'acceptation se fait dans Le Guichet, comme un joueur.
 */
test.describe('Le Troc', () => {
  test('une proposition s’accepte et les deux cartes changent de main', async ({
    page,
    browser,
  }) => {
    await page.goto('/collection', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const origin = new URL(page.url()).origin;
    const proposerId = await sessionUserId(page.context());

    const prefix = `troc-${randomUUID().slice(0, 8)}`;
    const player: FreshPlayer = { pseudo: prefix, email: `${prefix}@hexamap.test` };

    const receiverContext = await browser.newContext({
      baseURL: origin,
      ignoreHTTPSErrors: true,
      locale: 'fr-FR',
      timezoneId: 'Europe/Paris',
    });

    try {
      // `newContext()` hérite du `storageState` de la configuration : sans ce
      // vidage, le contexte jouerait la session du joueur principal.
      await receiverContext.clearCookies();
      await registerFreshPlayer(receiverContext, player);
      const receiverId = await sessionUserId(receiverContext);

      const { proposerCardId, receiverCardId } = await ensureTradeCards(proposerId, receiverId);
      expect(await cardIds(page)).toContain(proposerCardId);

      const proposal = await page.request.post('/api/v1/trades', {
        headers: { origin },
        data: { offeredCardId: proposerCardId, requestedCardId: receiverCardId },
      });
      expect(proposal.status()).toBe(201);
      const created = (await proposal.json()) as { offer: { id: string; status: string } };
      expect(created.offer.status).toBe('PENDING');

      // La carte demandée devient visible pour la partie adverse d'une offre ouverte.
      const requestedDetail = await page.request.get(`/api/v1/cards/${receiverCardId}`);
      expect(requestedDetail.ok()).toBe(true);
      const requestedNom = ((await requestedDetail.json()) as { card: { nom: string } }).card.nom;
      const offeredDetail = await page.request.get(`/api/v1/cards/${proposerCardId}`);
      const offeredNom = ((await offeredDetail.json()) as { card: { nom: string } }).card.nom;

      const receiver = await receiverContext.newPage();
      await receiver.goto('/guichet', { waitUntil: 'domcontentloaded' });

      const troc = receiver.getByRole('region', { name: 'Le Troc' });
      await expect(troc).toContainText(offeredNom);
      await expect(troc).toContainText(requestedNom);

      await troc.getByRole('button', { name: 'Accepter' }).click();
      await expect(
        receiver.getByText('Échange accepté : les deux cartes ont changé de main.'),
      ).toBeVisible();

      // Le destinataire possède désormais la carte offerte, plus la sienne.
      const receiverCards = await cardIds(receiver);
      expect(receiverCards).toContain(proposerCardId);
      expect(receiverCards).not.toContain(receiverCardId);

      await receiver.goto('/collection', { waitUntil: 'domcontentloaded' });
      await expect(receiver.getByRole('table', { name: COLLECTION_TABLE })).toContainText(
        offeredNom,
      );

      // Le proposeur a reçu la carte demandée et perdu la sienne.
      await page.goto('/collection', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('table', { name: COLLECTION_TABLE })).toContainText(requestedNom);

      const authorCards = await cardIds(page);
      expect(authorCards).toContain(receiverCardId);
      expect(authorCards).not.toContain(proposerCardId);
    } finally {
      await receiverContext.close();
    }
  });
});
