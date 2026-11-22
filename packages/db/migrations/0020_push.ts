import { type Kysely, sql } from 'kysely';

/**
 * La Sonnette — abonnements de poussée et préférences (`.docs/02-database.md` §4.12).
 *
 * **Deux tables, et la séparation porte le contrat.** Le désabonnement supprime la
 * ligne de `push_subscriptions` : c'est ce qu'exige le service de push quand il répond
 * `404` ou `410`, et c'est la seule façon d'arrêter vraiment l'envoi. Une préférence
 * posée sur cette ligne disparaîtrait avec elle, et le joueur qui réactive retrouverait
 * les heures calmes par défaut sans l'avoir demandé. `push_preferences` vit donc à part,
 * clé `user_id`, et survit au désabonnement.
 *
 * `last_sent_on` est un `text` `YYYY-MM-DD` et non un `date` : le driver `pg` relit un
 * `date` en `Date` à minuit **local**, ce qui ferait dériver le quota d'un jour aux
 * bords. La colonne porte le jour UTC tel que `utcDay()` de `packages/shared` le produit.
 *
 * `user_scratch_charges_empty_idx` est l'index de balayage de l'ordonnanceur : partiel
 * sur `charges = 0`, il rend un battement à vide gratuit, et `push_subscriptions_user_idx`
 * conduit la jointure inverse.
 *
 * Rejouable : `if not exists` partout.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
    create table if not exists push_subscriptions (
      id uuid primary key default gen_random_uuid(),
      user_id text not null references "user" ("id") on delete cascade,
      endpoint text not null,
      p256dh text not null,
      auth text not null,
      last_sent_on text check (last_sent_on is null or last_sent_on ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
      last_notified_charge_at timestamptz,
      last_sent_at timestamptz,
      created_at timestamptz not null default now()
    )
  `.execute(db);

  // Un point de terminaison désigne un navigateur, pas un compte : la réinscription
  // depuis le même navigateur réassigne la ligne au nouveau compte, elle ne la duplique pas.
  await sql`create unique index if not exists push_subscriptions_endpoint_idx
    on push_subscriptions (endpoint)`.execute(db);

  await sql`create index if not exists push_subscriptions_user_idx
    on push_subscriptions (user_id)`.execute(db);

  await sql`
    create table if not exists push_preferences (
      user_id text primary key references "user" ("id") on delete cascade,
      quiet_start smallint not null default 22 check (quiet_start between 0 and 23),
      quiet_end smallint not null default 8 check (quiet_end between 0 and 23),
      updated_at timestamptz not null default now()
    )
  `.execute(db);

  await sql`create index if not exists user_scratch_charges_empty_idx
    on user_scratch_charges (last_regen_at) where charges = 0`.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`drop index if exists user_scratch_charges_empty_idx`.execute(db);
  await sql`drop table if exists push_preferences`.execute(db);
  await sql`drop table if exists push_subscriptions`.execute(db);
}
