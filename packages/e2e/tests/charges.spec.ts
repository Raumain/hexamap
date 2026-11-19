import { expect, type Page, test } from '@playwright/test';

// Le carnet du Relevé : le solde, son compte à rebours local et le bouton de
// génération. Ces cas utilisent le compte de démonstration préparé par le
// `globalSetup` (session déjà ouverte) et ne s'inscrivent pas. Sélecteurs par
// rôle et libellé français uniquement.
//
// Le carnet n'est rendu que sans ticket actif : un compte qui arrive avec un
// ticket en cours affiche « Reprendre mon ticket » et aucun compteur. Les cas
// qui ne génèrent pas de ticket neutralisent donc la requête du ticket courant.

const meterPattern = /^\d+ charges? sur \d+$/;

/** Libellé « n charges sur cap » : un texte visible, pas un `aria-label`. */
function meterLabel(page: Page) {
  return page.getByText(meterPattern).first();
}

async function chargeCount(page: Page): Promise<number> {
  const text = ((await meterLabel(page).textContent()) ?? '').trim();
  const match = /^(\d+) charges? sur (\d+)$/.exec(text);
  if (match?.[1] === undefined) {
    throw new Error(`Libellé du carnet illisible : « ${text} »`);
  }
  return Number.parseInt(match[1], 10);
}

/**
 * Aucun ticket actif : `fetchCurrentTicket` rend `null` sur un `404`, ce qui fait
 * apparaître le carnet et le bouton de génération.
 */
async function stubNoActiveTicket(page: Page): Promise<void> {
  await page.route('**/api/v1/tickets/current', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ code: 'NO_ACTIVE_TICKET', message: 'Aucun ticket actif.' }),
    });
  });
}

/** Solde un ticket actif laissé par une exécution précédente. */
async function drainActiveTicket(page: Page): Promise<void> {
  await page.goto('/');

  const obtain = page.getByRole('button', { name: 'Obtenir un ticket' });
  const resume = page.getByRole('link', { name: 'Reprendre mon ticket' });
  await expect(obtain.or(resume).first()).toBeVisible({ timeout: 30_000 });

  if ((await obtain.count()) === 0) {
    await resume.first().click();
    await expect(page.getByRole('group', { name: 'Grille du ticket' })).toBeVisible();
    await scratchUntilExhausted(page);
  }
}

/** Grattage clavier complet : le même chemin que le parcours critique. */
async function scratchUntilExhausted(page: Page): Promise<void> {
  const scratchable = page.getByRole('button', { name: /^Case \d+, non révélée$/ });

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const before = await scratchable.count();
    if (before === 0) break;

    const cell = scratchable.first();
    await cell.focus();
    await cell.press('Enter');

    await expect.poll(() => scratchable.count(), { timeout: 15_000 }).toBeLessThan(before);
  }
}

test('carnet — générer un ticket consomme une charge et arme le compte à rebours', async ({
  page,
}) => {
  // Un ticket actif hérité du `globalSetup` masquerait le carnet : on le solde.
  await drainActiveTicket(page);
  await page.goto('/');

  const before = await chargeCount(page);

  await page.getByRole('button', { name: 'Obtenir un ticket' }).click();
  await expect(page).toHaveURL(/\/tickets\/[0-9a-f-]+$/i);
  await expect(page.getByRole('group', { name: 'Grille du ticket' })).toBeVisible();

  // Le carnet n'est rendu que sans ticket actif : le ticket créé est soldé avant
  // de relire le solde. Le grattage ne consomme aucune charge, et le compte reste
  // propre pour les specs suivantes (elles génèrent sur le même compte).
  await scratchUntilExhausted(page);
  await page.goto('/');

  expect(await chargeCount(page)).toBe(before - 1);
  // Une charge vient d'être dépensée sous le plafond : `nextChargeAt` n'est plus
  // nul, donc le compte à rebours est affiché. Au plafond il resterait absent.
  await expect(page.getByRole('timer')).toBeVisible();
});

test('carnet — à zéro charge le bouton est désarmé et le motif affiché', async ({ page }) => {
  const nextChargeAt = new Date(Date.now() + 12 * 60_000).toISOString();

  await stubNoActiveTicket(page);
  await page.route('**/api/v1/charges', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charges: 0, cap: 6, nextChargeAt, regenMs: 1_800_000 }),
    });
  });

  await page.goto('/');

  const button = page.getByRole('button', { name: /Obtenir un ticket/ });
  await expect(button).toBeVisible();
  await expect(button).toBeDisabled();
  await expect(page.getByText(/^0 charges sur 6$/)).toBeVisible();
  await expect(page.getByText(/Aucune charge disponible/).first()).toBeVisible();
});

test('carnet — le compte à rebours crédite sans nouvelle requête', async ({ page }) => {
  let chargeRequests = 0;
  const nextChargeAt = new Date(Date.now() + 2_000).toISOString();

  await stubNoActiveTicket(page);
  await page.route('**/api/v1/charges', async (route) => {
    chargeRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ charges: 0, cap: 6, nextChargeAt, regenMs: 1_800_000 }),
    });
  });

  await page.goto('/');

  const button = page.getByRole('button', { name: /Obtenir un ticket/ });
  const timer = page.getByRole('timer');

  await expect(button).toBeDisabled();
  await expect(timer).toContainText(/00:0[12]/);

  // `chargesAt` crédite la charge dès l'échéance et avance `nextChargeAt` d'un
  // délai entier : l'affichage passe de 00:01 à ~30:00, jamais par un palier
  // 00:00. Le crédit s'observe donc sur le solde, le bouton et le compteur.
  await expect(page.getByText(/^1 charge sur 6$/)).toBeVisible({ timeout: 10_000 });
  await expect(button).toBeEnabled();
  await expect(timer).toContainText(/29:5\d|30:00/);

  // Aucun sondage : une seule lecture du carnet, celle du montage.
  expect(chargeRequests).toBe(1);
});
