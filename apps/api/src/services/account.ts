import {
  normalizePseudo,
  PASSWORD_MIN_LENGTH,
  pseudoErrorMessage,
  validatePseudo,
} from '@hexamap/shared';
import { auth } from '../auth';
import { db } from '../db';
import { accountDeletionEnabled } from '../lib/account-switch';
import { HttpError } from '../lib/http-error';
import { mailTransportConfigured } from '../lib/mailer';

/** `23505` est le code PostgreSQL d'une violation d'unicité. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

/** Le corps d'une `APIError` Better Auth porte le code machine stable. */
function authErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('body' in error)) {
    return null;
  }
  const body = (error as { body?: { code?: unknown } }).body;
  return typeof body?.code === 'string' ? body.code : null;
}

/**
 * Change le pseudo du compte. L'unicité est portée par l'index
 * `user_pseudo_lower_idx` : un `UPDATE` qui le viole lève `23505`, ce qui
 * élimine la course entre un `SELECT` de disponibilité et l'écriture.
 */
export async function updatePseudo(userId: string, rawPseudo: string): Promise<{ pseudo: string }> {
  const validation = validatePseudo(rawPseudo);
  if (!validation.ok) {
    throw new HttpError(422, 'PSEUDO_INVALID', pseudoErrorMessage(validation.problem));
  }

  try {
    await db
      .updateTable('user')
      .set({ pseudo: validation.pseudo, updatedAt: new Date() })
      .where('id', '=', userId)
      .execute();
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HttpError(409, 'PSEUDO_TAKEN', 'Ce pseudo est déjà pris.');
    }
    throw error;
  }

  return { pseudo: validation.pseudo };
}

/**
 * Demande un changement de courriel. Rien n'est écrit en base : Better Auth
 * envoie un lien signé, et c'est l'ouverture de ce lien qui applique le
 * changement. Le courriel actuel est donc rendu inchangé.
 *
 * Sans transport de courriel (`MAIL_OUTBOX_DIR`), aucun lien ne peut partir :
 * la route refuse **avant** toute lecture en base et avant Better Auth, plutôt
 * que d'annoncer un envoi qui n'aura pas lieu.
 */
export async function requestEmailChange(
  headers: Headers,
  userId: string,
  newEmail: string,
): Promise<{ pending: true; email: string }> {
  if (!mailTransportConfigured()) {
    throw new HttpError(
      503,
      'EMAIL_VERIFICATION_DISABLED',
      'Le changement d’adresse n’est pas encore ouvert : aucun courriel ne peut être envoyé.',
    );
  }

  const email = newEmail.trim().toLowerCase();

  const current = await db
    .selectFrom('user')
    .select('email')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();

  const taken = await db
    .selectFrom('user')
    .select('id')
    .where('email', '=', email)
    .where('id', '!=', userId)
    .executeTakeFirst();
  if (taken) {
    throw new HttpError(400, 'EMAIL_ALREADY_EXISTS', 'Ce courriel est déjà utilisé.');
  }

  await auth.api.changeEmail({ body: { newEmail: email }, headers });

  return { pending: true, email: current.email };
}

/**
 * Change le mot de passe. `currentPassword` est obligatoire même quand Better
 * Auth le tolère absent : une session volée ne doit pas suffire à verrouiller
 * le compte.
 */
export async function changePassword(
  headers: Headers,
  input: { currentPassword?: string; newPassword: string },
): Promise<{ status: true }> {
  const currentPassword = input.currentPassword ?? '';
  if (currentPassword.length === 0) {
    throw new HttpError(400, 'CURRENT_PASSWORD_REQUIRED', 'Le mot de passe actuel est requis.');
  }
  if (input.newPassword.length < PASSWORD_MIN_LENGTH) {
    throw new HttpError(
      400,
      'PASSWORD_TOO_SHORT',
      `Le nouveau mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères.`,
    );
  }

  try {
    await auth.api.changePassword({
      body: { currentPassword, newPassword: input.newPassword, revokeOtherSessions: false },
      headers,
    });
  } catch (error) {
    if (authErrorCode(error) === 'INVALID_PASSWORD') {
      throw new HttpError(400, 'INVALID_PASSWORD', 'Le mot de passe actuel est incorrect.');
    }
    throw error;
  }

  return { status: true };
}

export interface AccountExport {
  achievements: {
    key: string;
    unlockedAt: string;
  }[];
  cards: {
    id: string;
    category: string;
    refCode: string;
    rarity: string;
    score: number;
    acquiredAt: string;
    source: string;
  }[];
  friendships: {
    requesterId: string;
    addresseeId: string;
    status: string;
    createdAt: string;
    respondedAt: string | null;
  }[];
  ledger: {
    delta: number;
    reason: string;
    createdAt: string;
  }[];
  profile: {
    exportedAt: string;
    id: string;
    pseudo: string | null;
    name: string;
    email: string;
    emailVerified: boolean;
    createdAt: string;
    bio: string | null;
    profilePublic: boolean;
  };
  tableaux: {
    id: string;
    name: string;
    regionCardId: string | null;
    departementCardId: string | null;
    communeCardId: string | null;
    rueCardId: string | null;
    createdAt: string;
  }[];
}

/**
 * Assemble l'export RGPD du compte : **six familles exactement**, sans habillage.
 * La projection est une liste blanche — ni session, ni compte d'authentification,
 * ni solde brut (`currency`), ni `grid`, ni `treasure_index`. Le solde se lit
 * dans le grand-livre, qui fait partie de l'export.
 */
export async function buildAccountExport(userId: string): Promise<AccountExport> {
  // `repeatable read` : les sept lectures voient le même instantané. Sans lui,
  // une vente conclue pendant l'export montrerait une carte transférée et un
  // grand-livre qui l'ignore, ou l'inverse.
  const { userRow, profileRow, cards, tableaux, achievements, ledger, friendships } = await db
    .transaction()
    .setIsolationLevel('repeatable read')
    .execute(async (trx) => {
      const [userRow, profileRow, cards, tableaux, achievements, ledger, friendships] =
        await Promise.all([
          trx
            .selectFrom('user')
            .select(['id', 'pseudo', 'name', 'email', 'emailVerified', 'createdAt'])
            .where('id', '=', userId)
            .executeTakeFirstOrThrow(),
          trx
            .selectFrom('user_profiles')
            .select(['bio', 'profile_public'])
            .where('user_id', '=', userId)
            .executeTakeFirst(),
          trx
            .selectFrom('user_cards')
            .select(['id', 'category', 'ref_code', 'rarity', 'score', 'acquired_at', 'source'])
            .where('user_id', '=', userId)
            .orderBy('acquired_at', 'asc')
            .execute(),
          trx
            .selectFrom('tableaux')
            .select([
              'id',
              'name',
              'region_card_id',
              'departement_card_id',
              'commune_card_id',
              'rue_card_id',
              'created_at',
            ])
            .where('user_id', '=', userId)
            .orderBy('created_at', 'asc')
            .execute(),
          trx
            .selectFrom('user_achievements')
            .select(['achievement_key', 'unlocked_at'])
            .where('user_id', '=', userId)
            .orderBy('unlocked_at', 'asc')
            .execute(),
          trx
            .selectFrom('currency_ledger')
            .select(['delta', 'reason', 'created_at'])
            .where('user_id', '=', userId)
            .orderBy('created_at', 'asc')
            .execute(),
          trx
            .selectFrom('friendships')
            .select(['requester_id', 'addressee_id', 'status', 'created_at', 'responded_at'])
            .where((eb) =>
              eb.or([eb('requester_id', '=', userId), eb('addressee_id', '=', userId)]),
            )
            .orderBy('created_at', 'asc')
            .execute(),
        ]);

      return { userRow, profileRow, cards, tableaux, achievements, ledger, friendships };
    });

  return {
    profile: {
      exportedAt: new Date().toISOString(),
      id: userRow.id,
      pseudo: userRow.pseudo,
      name: userRow.name,
      email: userRow.email,
      emailVerified: userRow.emailVerified,
      createdAt: userRow.createdAt.toISOString(),
      bio: profileRow?.bio ?? null,
      profilePublic: profileRow?.profile_public ?? true,
    },
    cards: cards.map((card) => ({
      id: card.id,
      category: card.category,
      refCode: card.ref_code,
      rarity: card.rarity,
      score: card.score,
      acquiredAt: card.acquired_at.toISOString(),
      source: card.source,
    })),
    tableaux: tableaux.map((tableau) => ({
      id: tableau.id,
      name: tableau.name,
      regionCardId: tableau.region_card_id,
      departementCardId: tableau.departement_card_id,
      communeCardId: tableau.commune_card_id,
      rueCardId: tableau.rue_card_id,
      createdAt: tableau.created_at.toISOString(),
    })),
    achievements: achievements.map((achievement) => ({
      key: achievement.achievement_key,
      unlockedAt: achievement.unlocked_at.toISOString(),
    })),
    ledger: ledger.map((line) => ({
      delta: line.delta,
      reason: line.reason,
      createdAt: line.created_at.toISOString(),
    })),
    friendships: friendships.map((friendship) => ({
      requesterId: friendship.requester_id,
      addresseeId: friendship.addressee_id,
      status: friendship.status,
      createdAt: friendship.created_at.toISOString(),
      respondedAt: friendship.responded_at?.toISOString() ?? null,
    })),
  };
}

/**
 * Annule les annonces ouvertes du vendeur avant la suppression du compte, et
 * rend les cartes à leur propriétaire dans la **même** transaction.
 *
 * Les annonces seront ensuite emportées par la cascade de `seller_id`, mais une
 * carte ne doit pas rester exposée au Comptoir pendant l'intervalle — et si la
 * suppression échoue après cette étape, remettre `locked = false` évite de
 * laisser des cartes définitivement invendables.
 */
export async function cancelOpenListings(userId: string): Promise<number> {
  return db.transaction().execute(async (trx) => {
    const cancelled = await trx
      .updateTable('market_listings')
      .set({ status: 'CANCELLED' })
      .where('seller_id', '=', userId)
      .where('status', '=', 'OPEN')
      .returning('user_card_id')
      .execute();

    const cardIds = cancelled.map((row) => row.user_card_id);
    if (cardIds.length > 0) {
      await trx
        .updateTable('user_cards')
        .set({ locked: false })
        .where('id', 'in', cardIds)
        .execute();
    }

    return cancelled.length;
  });
}

type CountRow = { count: string | number | bigint };

async function countRows(query: Promise<CountRow | undefined>): Promise<number> {
  return Number((await query)?.count ?? 0);
}

/**
 * Compte ce qui reste d'un compte après suppression. Une seule valeur non nulle
 * fait **échouer** l'appel : une cascade incomplète est un défaut serveur, pas
 * une ligne de journal. Le rapport est rendu quand tout est à zéro.
 *
 * `ticket_reveals` n'a pas d'identifiant de joueur : il se compte par les
 * `ticket_id` relevés **avant** la suppression, puisque la cascade les emporte.
 */
export async function assertAccountPurged(
  userId: string,
  ticketIds: string[],
): Promise<Record<string, number>> {
  const counts = () =>
    db
      .selectFrom('user')
      .select((eb) => eb.fn.countAll().as('count'))
      .where('id', '=', userId);

  const [
    users,
    sessions,
    accounts,
    cards,
    tickets,
    reveals,
    tableaux,
    listings,
    ledger,
    charges,
    achievements,
    friendships,
    blocks,
    profiles,
    purchased,
  ] = await Promise.all([
    countRows(counts().executeTakeFirst()),
    countRows(
      db
        .selectFrom('session')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('userId', '=', userId)
        .executeTakeFirst(),
    ),
    countRows(
      db
        .selectFrom('account')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('userId', '=', userId)
        .executeTakeFirst(),
    ),
    countRows(
      db
        .selectFrom('user_cards')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', userId)
        .executeTakeFirst(),
    ),
    countRows(
      db
        .selectFrom('tickets')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', userId)
        .executeTakeFirst(),
    ),
    ticketIds.length === 0
      ? Promise.resolve(0)
      : countRows(
          db
            .selectFrom('ticket_reveals')
            .select((eb) => eb.fn.countAll().as('count'))
            .where('ticket_id', 'in', ticketIds)
            .executeTakeFirst(),
        ),
    countRows(
      db
        .selectFrom('tableaux')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', userId)
        .executeTakeFirst(),
    ),
    countRows(
      db
        .selectFrom('market_listings')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('seller_id', '=', userId)
        .executeTakeFirst(),
    ),
    countRows(
      db
        .selectFrom('currency_ledger')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', userId)
        .executeTakeFirst(),
    ),
    countRows(
      db
        .selectFrom('user_scratch_charges')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', userId)
        .executeTakeFirst(),
    ),
    countRows(
      db
        .selectFrom('user_achievements')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', userId)
        .executeTakeFirst(),
    ),
    countRows(
      db
        .selectFrom('friendships')
        .select((eb) => eb.fn.countAll().as('count'))
        .where((eb) => eb.or([eb('requester_id', '=', userId), eb('addressee_id', '=', userId)]))
        .executeTakeFirst(),
    ),
    countRows(
      db
        .selectFrom('blocks')
        .select((eb) => eb.fn.countAll().as('count'))
        .where((eb) => eb.or([eb('blocker_id', '=', userId), eb('blocked_id', '=', userId)]))
        .executeTakeFirst(),
    ),
    countRows(
      db
        .selectFrom('user_profiles')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('user_id', '=', userId)
        .executeTakeFirst(),
    ),
    // `buyer_id` est `on delete set null` : l'annonce d'un autre joueur survit,
    // mais ne doit plus désigner le compte supprimé.
    countRows(
      db
        .selectFrom('market_listings')
        .select((eb) => eb.fn.countAll().as('count'))
        .where('buyer_id', '=', userId)
        .executeTakeFirst(),
    ),
  ]);

  const report: Record<string, number> = {
    user: users,
    session: sessions,
    account: accounts,
    user_cards: cards,
    tickets,
    ticket_reveals: reveals,
    tableaux,
    market_listings: listings,
    currency_ledger: ledger,
    user_scratch_charges: charges,
    user_achievements: achievements,
    friendships,
    blocks,
    user_profiles: profiles,
    market_listings_buyer_id: purchased,
  };

  for (const [table, value] of Object.entries(report)) {
    if (value !== 0) {
      throw new HttpError(
        500,
        'ACCOUNT_PURGE_INCOMPLETE',
        `La suppression du compte est incomplète (${table} = ${value}) : la purge a laissé des lignes derrière elle.`,
      );
    }
  }

  return report;
}

/**
 * Supprime le compte et vérifie la cascade. L'interrupteur est relu ici, donc un
 * appel direct ne contourne pas le refus du hook `beforeDelete` : les deux
 * chemins répondent la même chose.
 */
export async function deleteAccount(
  userId: string,
  input: { password: string; confirmation: string },
  headers: Headers,
): Promise<{ deleted: true; cascade: Record<string, number> }> {
  if (!accountDeletionEnabled()) {
    throw new HttpError(
      503,
      'ACCOUNT_DELETION_DISABLED',
      'La suppression de compte est momentanément indisponible.',
    );
  }

  // Réauthentification d'abord : c'est l'ordre du contrat (§2.9), et il ne
  // laisse aucune lecture de compte à un porteur de session volée qui ignore
  // le mot de passe.
  try {
    const verified = await auth.api.verifyPassword({
      body: { password: input.password },
      headers,
    });
    if (!verified.status) {
      throw new HttpError(401, 'INVALID_PASSWORD', 'Mot de passe incorrect.');
    }
  } catch (error) {
    if (authErrorCode(error) === 'INVALID_PASSWORD') {
      throw new HttpError(401, 'INVALID_PASSWORD', 'Mot de passe incorrect.');
    }
    throw error;
  }

  const userRow = await db
    .selectFrom('user')
    .select('pseudo')
    .where('id', '=', userId)
    .executeTakeFirstOrThrow();

  // Confirmation **exacte** après `trim`, des deux côtés du réseau : le libellé
  // promet « exactement », et une comparaison insensible à la casse ne tiendrait
  // pas la promesse inverse. Seule l'unicité du pseudo ignore la casse.
  const expected = normalizePseudo(userRow.pseudo ?? '');
  if (normalizePseudo(input.confirmation) !== expected) {
    throw new HttpError(
      400,
      'CONFIRMATION_MISMATCH',
      'Le pseudo de confirmation ne correspond pas à votre compte.',
    );
  }

  // Les révélations n'ont pas d'identifiant de joueur : elles se comptent par
  // ticket, et les tickets disparaissent avec le compte.
  const ticketRows = await db
    .selectFrom('tickets')
    .select('id')
    .where('user_id', '=', userId)
    .execute();
  const ticketIds = ticketRows.map((row) => row.id);

  await cancelOpenListings(userId);
  await auth.api.deleteUser({ body: { password: input.password }, headers });

  return { deleted: true, cascade: await assertAccountPurged(userId, ticketIds) };
}
