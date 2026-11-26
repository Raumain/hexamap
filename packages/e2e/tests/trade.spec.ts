import { randomUUID } from 'node:crypto';
import { type BrowserContext, expect, type Page, test } from '@playwright/test';
import { ensureTradeCards } from '../fixtures/trade-fixture';
import { E2E_PASSWORD, readAccountFixture } from './fixtures/auth';

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
 * deux cartes (`trade-fixture`). La proposition passe par le produit : les deux
 * joueurs deviennent amis, le proposant ouvre la collection troquable de l'autre
 * depuis `/friends` et choisit sa carte là, comme un joueur. L'acceptation se
 * fait ensuite dans Le Guichet.
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
    const account = readAccountFixture();

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

      // 1. L'amitié est le seul chemin vers la collection de l'autre : le
      //    receveur demande, le proposant accepte dans la salle des Amis.
      const request = await receiverContext.request.post('/api/v1/friends/requests', {
        data: { pseudo: account.pseudo },
        headers: { origin },
      });
      expect(request.ok()).toBe(true);

      await page.goto('/friends', { waitUntil: 'domcontentloaded' });
      const incoming = page.getByRole('listitem').filter({ hasText: player.pseudo });
      await incoming.getByRole('button', { name: 'Accepter' }).click();

      const friendRow = page.getByRole('listitem').filter({ hasText: player.pseudo });
      const requestedCardButton = friendRow.getByRole('button', {
        name: 'Demander « Commune E2E MYTHIQUE 1 »',
      });
      await expect(requestedCardButton).toBeVisible();

      // 2. La collection troquable de l'ami est posée à même sa ligne : aucune
      //    modale intermédiaire, la planche est le bouton.
      await requestedCardButton.click();

      const dialog = page.getByRole('dialog', { name: 'Proposer un troc' });
      await expect(dialog).toBeVisible();
      await dialog
        .getByLabel('Carte à offrir')
        .selectOption({ label: 'Commune — Commune E2E LEGENDAIRE 1' });
      await dialog.getByRole('button', { name: 'Envoyer la proposition' }).click();
      await expect(
        page.getByText('Proposition envoyée. La réponse arrivera au Guichet.'),
      ).toBeVisible();

      // 3. L'offre est bien en attente et réserve les deux cartes.
      const sent = await page.request.get('/api/v1/trades?box=sent');
      expect(sent.ok()).toBe(true);
      const sentBody = (await sent.json()) as {
        offers: Array<{ id: string; status: string; requestedCard: { id: string } }>;
      };
      const created = sentBody.offers.find((offer) => offer.requestedCard.id === receiverCardId);
      expect(created?.status).toBe('PENDING');

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
      // Le compte principal est partagé par tout le banc : l'amitié de ce cas
      // ne doit pas survivre à l'exécution.
      await page.request
        .delete(`/api/v1/friends/${await sessionUserId(receiverContext)}`, {
          headers: { origin },
        })
        .catch(() => undefined);
      await receiverContext.close();
    }
  });
});
