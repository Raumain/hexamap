import { expect, type Page, test } from '@playwright/test';

// Le Palmarès est le seul endroit où `tableaux.score` est lu comme une vérité
// figée : la salle ne recalcule rien, le rang vient du serveur. Un score figé
// peut sembler juste dans une réponse HTTP et se déplacer sous les yeux du
// joueur ; ce cas regarde donc jouer le parcours complet — deux soumissions
// réelles, deux lectures du classement, la salle avant et après rechargement —
// plutôt que de relire la colonne.
//
// La géographie vient de `fixtures/tableau-fixture.ts`, exécutée par
// `global-setup.ts` : le compte possède `E2E-R1` → `E2E-D1` → `E2E-C-RARE-0`
// (combo complet, trois liens, ×5) et l'odonyme réellement rattaché à cette
// commune, plus une contre-épreuve hors-zone (`E2E-D2`). Les totaux ne sont
// jamais écrits en dur : le multiplicateur est l'affaire du serveur, et `E2E-D2`
// pourrait appartenir à `E2E-R1` selon le référentiel semé.

const PALMARES_LIMIT = 100;
const ORIGIN = process.env.E2E_BASE_URL ?? 'https://hexamap.test';
const ALIGNE = 'Tableau aligné';
const DISPERSE = 'Tableau dispersé';

/**
 * Node et Chromium ne composent pas les milliers de la même façon : le séparateur
 * `fr-FR` peut être une espace fine insécable (U+202F) ici, une espace là. On
 * compare donc des suites de chiffres, sans jamais relâcher les chiffres eux-mêmes.
 */
function compact(value: string): string {
  return value.replace(/\s/g, '');
}

const REGION_CODE = 'E2E-R1';
const DEPARTEMENT_ALIGNE = 'E2E-D1';
const DEPARTEMENT_DISPERSE = 'E2E-D2';
const COMMUNE_CODE = 'E2E-C-RARE-0';
const RUE_NOM = 'Rue E2E INHABITUELLE 0';

interface CollectionCard {
  id: string;
  category: string;
  refCode: string;
  nom: string;
  rarity: string;
  score: number;
}

interface CardsBody {
  items: CollectionCard[];
}

interface SubmittedTableau {
  id: string;
  name: string;
  total: number;
}

interface SubmitBody {
  tableau: SubmittedTableau;
}

interface PalmaresItem {
  rank: number;
  tableauId: string;
  name: string;
  score: number;
  yours: boolean;
  player: { id: string; pseudo: string; profilePublic: boolean };
}

interface PalmaresBody {
  week: string;
  current: boolean;
  total: number;
  items: PalmaresItem[];
}

/** Les deux lignes témoins de la salle, relues à l'identique après rechargement. */
interface DisplayedRows {
  aligned: string;
  disperse: string;
}

interface SubmitInput {
  name: string;
  regionCardId: string;
  departementCardId: string;
  communeCardId: string;
  rueCardId: string;
}

async function collection(page: Page): Promise<CollectionCard[]> {
  const response = await page.request.get('/api/v1/cards?limit=5000');
  expect(response.ok()).toBe(true);
  return ((await response.json()) as CardsBody).items;
}

/**
 * Identifie une carte possédée, ou nomme celle qui manque. `user_cards` n'a
 * aucune unicité sur `ref_code` : le compte peut posséder plusieurs exemplaires
 * du même lieu, et `GET /cards` les rend par date d'acquisition décroissante.
 * Un odonyme arrive ainsi **deux fois** — la copie d'un ticket porte le score de
 * référence, celle de la fixture du combo porte le score de la planche —, donc
 * prendre le premier exemplaire rendrait le total soumis dépendant de l'ordre
 * des tickets. On garde la copie au score le plus haut : le total cesse alors de
 * varier d'un passage du banc à l'autre, ce dont dépendent les lignes déjà
 * classées par les passages précédents.
 */
function pickCard(
  cards: CollectionCard[],
  matches: (card: CollectionCard) => boolean,
  label: string,
): CollectionCard {
  const candidates = cards.filter(matches);
  expect(candidates.length, `${label} absente de la collection du compte E2E`).toBeGreaterThan(0);

  return candidates.reduce((best, card) => (card.score > best.score ? card : best));
}

/** Soumet un tableau par le vrai endpoint : `header origin` compris, comme le navigateur. */
async function submit(page: Page, input: SubmitInput): Promise<SubmittedTableau> {
  const response = await page.request.post('/api/v1/tableaux', {
    headers: { origin: ORIGIN },
    data: input,
  });
  const body = (await response.json()) as SubmitBody;
  expect(response.status(), `soumission « ${input.name} » refusée : ${JSON.stringify(body)}`).toBe(
    201,
  );

  return body.tableau;
}

async function readPalmares(page: Page): Promise<PalmaresBody> {
  const response = await page.request.get(`/api/v1/palmares?limit=${PALMARES_LIMIT}`);
  const body = (await response.json()) as PalmaresBody;
  expect(response.status(), `lecture du classement refusée : ${JSON.stringify(body)}`).toBe(200);

  return body;
}

/** Le rang est la position, et les scores ne remontent jamais : le serveur a déjà trié. */
function assertRanking(body: PalmaresBody): void {
  expect(body.items.length).toBeGreaterThan(1);

  let previousScore = Number.POSITIVE_INFINITY;
  body.items.forEach((item, index) => {
    expect(item.rank, `rang du ${index + 1}ᵉ élément du classement`).toBe(index + 1);
    expect(
      item.score,
      `score du rang ${item.rank} supérieur à celui du rang précédent`,
    ).toBeLessThanOrEqual(previousScore);
    previousScore = item.score;
  });
}

function itemOf(body: PalmaresBody, tableauId: string, label: string): PalmaresItem {
  const found = body.items.find((item) => item.tableauId === tableauId);
  expect(found, `${label} absent du classement de la semaine`).toBeDefined();

  if (found === undefined) {
    throw new Error(`${label} absent du classement de la semaine`);
  }

  return found;
}

function rowIndex(rows: string[], name: string): number {
  const index = rows.findIndex((row) => row.includes(name));
  expect(index, `aucune ligne « ${name} » dans la salle`).toBeGreaterThanOrEqual(0);

  if (index < 0) {
    throw new Error(`aucune ligne « ${name} » dans la salle`);
  }

  return index;
}

/**
 * L'ordre se lit sur les lignes rendues, pas sur un locator strict : chaque
 * passage du banc laisse ses deux tableaux dans la semaine, donc plusieurs
 * lignes portent les mêmes noms. Toutes les lignes « Tableau aligné » passent
 * avant toutes les « Tableau dispersé », la première occurrence de chacune est
 * donc le bon témoin.
 */
async function displayedRows(
  page: Page,
  totalAligne: number,
  totalDisperse: number,
): Promise<DisplayedRows> {
  const rows = await page.getByRole('listitem').allInnerTexts();
  const indexAligne = rowIndex(rows, ALIGNE);
  const indexDisperse = rowIndex(rows, DISPERSE);

  expect(indexAligne, `« ${ALIGNE} » doit précéder « ${DISPERSE} » dans la salle`).toBeLessThan(
    indexDisperse,
  );

  const aligned = rows[indexAligne] ?? '';
  const disperse = rows[indexDisperse] ?? '';

  expect(compact(aligned), 'la ligne alignée doit porter le score de la soumission').toContain(
    String(totalAligne),
  );
  expect(compact(disperse), 'la ligne dispersée doit porter le score de la soumission').toContain(
    String(totalDisperse),
  );

  return { aligned, disperse };
}

test('palmarès — deux tableaux soumis, un classement, un score figé', async ({ page }) => {
  const cards = await collection(page);

  const region = pickCard(
    cards,
    (card) => card.category === 'REGION' && card.refCode === REGION_CODE,
    `Région ${REGION_CODE}`,
  );
  const departementAligne = pickCard(
    cards,
    (card) => card.category === 'DEPARTEMENT' && card.refCode === DEPARTEMENT_ALIGNE,
    `Département ${DEPARTEMENT_ALIGNE}`,
  );
  const departementDisperse = pickCard(
    cards,
    (card) => card.category === 'DEPARTEMENT' && card.refCode === DEPARTEMENT_DISPERSE,
    `Département ${DEPARTEMENT_DISPERSE}`,
  );
  const commune = pickCard(
    cards,
    (card) => card.category === 'COMMUNE' && card.refCode === COMMUNE_CODE,
    `Commune ${COMMUNE_CODE}`,
  );
  const rue = pickCard(
    cards,
    (card) => card.category === 'RUE' && card.nom === RUE_NOM,
    `Rue ${RUE_NOM}`,
  );

  // 1. Le tableau aligné valide les trois liens ; le dispersé n'en valide que
  //    deux au mieux, puisque son département n'est pas celui de la commune.
  //    Même région, même commune, même rue : la seule différence est le lien
  //    département → commune, donc le multiplicateur du serveur.
  const aligne = await submit(page, {
    name: ALIGNE,
    regionCardId: region.id,
    departementCardId: departementAligne.id,
    communeCardId: commune.id,
    rueCardId: rue.id,
  });
  const disperse = await submit(page, {
    name: DISPERSE,
    regionCardId: region.id,
    departementCardId: departementDisperse.id,
    communeCardId: commune.id,
    rueCardId: rue.id,
  });

  expect(
    aligne.total,
    'le tableau aligné doit valider strictement plus de liens que le dispersé',
  ).toBeGreaterThan(disperse.total);

  // 2. Le classement ne bouge pas entre deux lectures : même semaine, mêmes
  //    rangs, mêmes tableaux. C'est le critère qui interdit un tri côté
  //    navigateur et un `ORDER BY` non total côté serveur.
  const firstRead = await readPalmares(page);
  const secondRead = await readPalmares(page);

  expect(secondRead.week).toBe(firstRead.week);
  expect(secondRead.items.map((item) => [item.rank, item.tableauId])).toEqual(
    firstRead.items.map((item) => [item.rank, item.tableauId]),
  );

  assertRanking(firstRead);

  const itemAligne = itemOf(firstRead, aligne.id, ALIGNE);
  const itemDisperse = itemOf(firstRead, disperse.id, DISPERSE);

  expect(itemAligne.rank, 'le tableau aligné doit devancer le dispersé').toBeLessThan(
    itemDisperse.rank,
  );
  expect(
    itemAligne.score,
    'le classement doit porter le score de la soumission, jamais un recalcul',
  ).toBe(aligne.total);
  expect(itemDisperse.score, 'le classement doit porter le score de la soumission').toBe(
    disperse.total,
  );

  // 3. La salle affiche ce que le serveur a classé : ordre, semaine, scores.
  await page.goto('/palmares');
  await expect(page.getByRole('heading', { name: 'Le Palmarès' })).toBeVisible();
  await expect(page.getByText(`Semaine ${firstRead.week}`).first()).toBeVisible();

  const beforeReload = await displayedRows(page, aligne.total, disperse.total);

  // 4. Un second rendu, complet, ne déplace ni l'ordre ni les nombres : le score
  //    est figé en base, pas recalculé à l'affichage.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Le Palmarès' })).toBeVisible();

  const afterReload = await displayedRows(page, aligne.total, disperse.total);

  expect(afterReload, 'les deux lignes témoins doivent être identiques après rechargement').toEqual(
    beforeReload,
  );

  await test.info().attach('palmares', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  // 5. Les deux sorties que la salle promet : la vitrine du joueur et le cartel
  //    d'une carte. Un `href` présent ne prouve rien : on demande la destination.
  //    `/card/$cardId` est une route du SPA, dont le repli de navigation répond
  //    200 même quand la carte est illisible (`.docs/01-architecture.md` §6.1) ;
  //    la seule preuve est `/api/v1/cards/:id`, qui refuse `CARD_NOT_VISIBLE` sur
  //    la carte d'un tiers (`.docs/01-architecture.md` §2.9). La ligne se repère
  //    par son rang serveur : les passages précédents du banc laissent des
  //    tableaux homonymes appartenant à d'autres comptes.
  const rows = page.locator('ol > li');
  const rendered = await rows.count();
  expect(rendered, 'la salle doit rendre au moins les deux lignes témoins').toBeGreaterThan(1);
  expect(
    firstRead.items.length,
    'le classement doit contenir au moins les lignes rendues',
  ).toBeGreaterThanOrEqual(rendered);

  for (const [label, item] of [
    [ALIGNE, itemAligne],
    [DISPERSE, itemDisperse],
  ] as const) {
    expect(item.yours, `« ${label} » doit appartenir au joueur courant`).toBe(true);
    expect(
      item.rank,
      `« ${label} » doit figurer dans les lignes rendues (rang ${item.rank})`,
    ).toBeLessThanOrEqual(rendered);

    const row = rows.nth(item.rank - 1);
    expect(
      await row.textContent(),
      `la ligne du rang ${item.rank} doit être « ${label} »`,
    ).toContain(item.name);

    const href = await row.locator('a[href*="/card/"]').first().getAttribute('href');
    expect(href, `la ligne « ${label} » doit lier son propre cartel`).not.toBeNull();
    const cardId = (href ?? '').match(/\/card\/([^/?#]+)/)?.[1];
    expect(cardId, `lien de cartel illisible sur la ligne « ${label} »`).toBeTruthy();
    const response = await page.request.get(`/api/v1/cards/${cardId ?? ''}`);
    expect(response.ok(), `le cartel de la ligne « ${label} » doit répondre 200`).toBe(true);
  }

  // 6. Les règles de la salle sur *toutes* les lignes rendues, pas seulement sur
  //    les témoins : une carte d'un autre joueur n'est pas lisible, donc elle ne
  //    se lie pas ; une vitrine privée répond 404 par dessein, donc elle ne se
  //    lie pas non plus. La charge utile de référence est celle de la salle.
  let foreignRendered = 0;
  for (let index = 0; index < rendered; index += 1) {
    const row = rows.nth(index);
    const item = firstRead.items[index];
    expect(item, `aucune entrée serveur pour la ligne ${index + 1}`).toBeDefined();
    if (item === undefined) continue;

    expect(
      await row.textContent(),
      `la ligne ${index + 1} doit correspondre au rang ${item.rank}`,
    ).toContain(item.name);

    const cardLinks = await row.locator('a[href*="/card/"]').count();
    const playerLinks = await row.locator('a[href*="/players/"]').count();

    if (!item.yours) {
      foreignRendered += 1;
      expect(cardLinks, `le rang ${item.rank} ne doit pas lier le cartel d'un autre joueur`).toBe(
        0,
      );
    }
    expect(
      playerLinks,
      `le rang ${item.rank} doit ${item.player.profilePublic ? 'lier' : 'ne pas lier'} sa vitrine`,
    ).toBe(item.player.profilePublic ? 1 : 0);
  }
  console.log(`[e2e] entrées étrangères classées : ${foreignRendered}`);
});
