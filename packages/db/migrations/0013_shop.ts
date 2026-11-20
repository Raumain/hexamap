import { type Kysely, sql } from 'kysely';

/**
 * Boutique — idempotence d'un achat et plafond quotidien
 * (`.docs/02-database.md` §4.6, §4.1).
 *
 * L'unicité d'un webhook ne peut pas être une vérification avant insertion :
 * deux livraisons simultanées du même événement lisent toutes deux « absent »
 * puis insèrent toutes deux. Elle est donc portée par la base, sur un index
 * partiel qui ne couvre que les motifs `PURCHASE:%` — un remboursement
 * (`PURCHASE_REFUND:%`) reste libre de s'écrire.
 *
 * `SHOP_DAILY_PURCHASE_CAP` est une clé de `game_config`, pas une contrainte :
 * un plafond de jeu se règle sans migration.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create unique index if not exists currency_ledger_purchase_uniq
      on currency_ledger (user_id, reason)
      where reason like 'PURCHASE:%'
  `.execute(db);

  await sql`
    insert into game_config (key, value)
    values ('SHOP_DAILY_PURCHASE_CAP', '12000'::jsonb)
    on conflict (key) do nothing
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    delete from game_config
    where key = 'SHOP_DAILY_PURCHASE_CAP' and value = '12000'::jsonb
  `.execute(db);

  await sql`drop index if exists currency_ledger_purchase_uniq`.execute(db);
}
