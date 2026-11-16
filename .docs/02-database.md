# 02 — Base de données : schéma SQL et types Kysely

> **Contrat de données.**
> Aucune table ni colonne ne doit être utilisée si elle n'est pas définie ici.
> Si un besoin nécessite une nouvelle table/colonne : mettre à jour ce document **avant** d'écrire la migration.
> Dernière mise à jour : 2026-11-15.

---

## 1. Règles

1. **PostgreSQL 16** est la seule base supportée.
2. Toute évolution du schéma = mise à jour de ce fichier + nouvelle migration. Les migrations appliquées ne sont jamais modifiées.
3. Les tables de jeu et de référence sont en `snake_case`.
4. Les tables Better Auth (`user`, `session`, `account`, `verification`) sont **générées par Better Auth**. Ne pas les écrire à la main ; leurs colonnes sont en `camelCase`.
5. Les clés étrangères vers un utilisateur sont de type `text` et référencent `"user"("id")`.
6. Les identifiants applicatifs sont des `uuid` générés par `gen_random_uuid()`.
7. Les requêtes métier passent par Kysely. Le SQL brut est réservé aux migrations, health checks et imports massifs (`COPY`).

---

## 2. Statut des tables

| Table | Statut | Origine |
| :--- | :--- | :--- |
| `game_config` | **Migrée** | `packages/db/migrations/0001_init.ts` |
| `user`, `session`, `account`, `verification` | **Migrée** | `packages/db/migrations/0002_auth.ts` |
| `user_cards`, `tickets`, `ticket_reveals`, `tableaux`, `market_listings`, `currency_ledger` | **Migrée** | `packages/db/migrations/0003_game.ts` |
| `ref_regions`, `ref_departements`, `ref_communes`, `ref_odonymes`, `commune_odonymes` | **Migrée** | `packages/db/migrations/0004_reference.ts` |
| `rateLimit` | **Migrée** | `packages/db/migrations/0005_rate_limit.ts` |

> Tant qu'une table n'est pas au statut **Migrée**, elle ne doit pas être interrogée en runtime.

---

## 3. Schéma Better Auth (généré)

Commande de génération :

```sh
docker compose --profile tools run --rm dev bash -lc \
  'cd apps/api && bun x auth generate --adapter kysely --output /app/auth-schema.sql'
```

SQL exact produit par Better Auth 1.7 avec les champs personnalisés `pseudo` et `currency` :

```sql
create table "user" (
  "id" text not null primary key,
  "name" text not null,
  "email" text not null unique,
  "emailVerified" boolean not null,
  "image" text,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null,
  "pseudo" text,
  "currency" integer
);

create table "session" (
  "id" text not null primary key,
  "expiresAt" timestamptz not null,
  "token" text not null unique,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz not null,
  "ipAddress" text,
  "userAgent" text,
  "userId" text not null references "user" ("id") on delete cascade
);

create table "account" (
  "id" text not null primary key,
  "accountId" text not null,
  "providerId" text not null,
  "userId" text not null references "user" ("id") on delete cascade,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope" text,
  "password" text,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz not null
);

create table "verification" (
  "id" text not null primary key,
  "identifier" text not null,
  "value" text not null,
  "expiresAt" timestamptz not null,
  "createdAt" timestamptz default CURRENT_TIMESTAMP not null,
  "updatedAt" timestamptz default CURRENT_TIMESTAMP not null
);

create index "session_userId_idx" on "session" ("userId");
create index "account_userId_idx" on "account" ("userId");
create index "verification_identifier_idx" on "verification" ("identifier");
```

La table `rateLimit` est créée par Better Auth uniquement quand
`rateLimit: { storage: "database" }` est actif (sinon le rate limiting est en
mémoire). Elle est migrée explicitement par `0005_rate_limit.ts` :

```sql
create table "rateLimit" (
  "id" text not null primary key,
  "key" text not null unique,
  "count" integer not null,
  "lastRequest" bigint not null
);
```

---

## 4. Schéma applicatif

### 4.1 Configuration

```sql
create table game_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
```

### 4.2 Cartes possédées

```sql
create table user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  category text not null check (category in ('REGION', 'DEPARTEMENT', 'COMMUNE', 'RUE')),
  ref_code text not null,
  rarity text not null check (
    rarity in ('COMMUNE', 'INHABITUELLE', 'RARE', 'EPIQUE', 'LEGENDAIRE', 'MYTHIQUE')
  ),
  score integer not null check (score >= 0),
  acquired_at timestamptz not null default now(),
  source text not null default 'TICKET' check (source in ('TICKET', 'MARKET', 'REWARD')),
  locked boolean not null default false
);

create index user_cards_owner_idx on user_cards (user_id, category);
create index user_cards_ref_idx on user_cards (category, ref_code);
```

`ref_code` contient : le code région, le code département, le code INSEE de la commune, ou l'identifiant `ref_odonymes.id` sérialisé en texte.

### 4.3 Tickets

```sql
create table tickets (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'EXHAUSTED', 'EXPIRED')),
  grid jsonb not null,
  treasure_index smallint not null check (treasure_index between 0 and 15),
  scrapes_remaining smallint not null default 4 check (scrapes_remaining >= 0),
  renovation_pending boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create unique index tickets_one_active_per_user on tickets (user_id) where status = 'ACTIVE';
create index tickets_user_idx on tickets (user_id, created_at desc);

create table ticket_reveals (
  ticket_id uuid not null references tickets (id) on delete cascade,
  cell_index smallint not null check (cell_index between 0 and 15),
  card_user_id uuid references user_cards (id) on delete set null,
  distance smallint not null check (distance between 0 and 6),
  revealed_at timestamptz not null default now(),
  primary key (ticket_id, cell_index)
);
```

`grid` est un tableau JSON de 16 cases, indexé `0..15` (`index = ligne * 4 + colonne`). Il est **strictement serveur** et n'est jamais envoyé au client.

Forme d'une case :

```ts
type TicketCell =
  | { kind: 'CARD'; card: TicketCard }
  | { kind: 'TREASURE'; card: TicketCard }
  | { kind: 'TWIN'; card: TicketCard }
  | { kind: 'STATION' }
  | { kind: 'BELVEDERE'; card: TicketCard }
  | { kind: 'RENOVATION'; card: TicketCard };

interface TicketCard {
  category: 'REGION' | 'DEPARTEMENT' | 'COMMUNE' | 'RUE';
  ref_code: string;
  rarity: Rarity;
}
```

### 4.4 Tableaux

```sql
create table tableaux (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references "user" ("id") on delete cascade,
  name text not null default 'Mon tableau',
  region_card_id uuid references user_cards (id) on delete set null,
  departement_card_id uuid references user_cards (id) on delete set null,
  commune_card_id uuid references user_cards (id) on delete set null,
  rue_card_id uuid references user_cards (id) on delete set null,
  created_at timestamptz not null default now()
);

create index tableaux_user_idx on tableaux (user_id);
```

### 4.5 Marché V1 (vente et achat direct uniquement)

```sql
create table market_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id text not null references "user" ("id") on delete cascade,
  user_card_id uuid not null references user_cards (id) on delete cascade,
  price integer not null check (price > 0),
  status text not null default 'OPEN' check (status in ('OPEN', 'SOLD', 'CANCELLED')),
  created_at timestamptz not null default now(),
  sold_at timestamptz,
  buyer_id text references "user" ("id") on delete set null
);

create index market_listings_status_idx on market_listings (status, created_at desc);
create unique index market_listings_open_card_idx on market_listings (user_card_id) where status = 'OPEN';
```

### 4.6 Portefeuille

```sql
create table currency_ledger (
  id bigserial primary key,
  user_id text not null references "user" ("id") on delete cascade,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create index currency_ledger_user_idx on currency_ledger (user_id, created_at desc);
```

---

## 5. Schéma des référentiels (import Open Data)

```sql
create table ref_regions (
  code text primary key,
  nom text not null,
  geom jsonb,
  blason_url text
);

create table ref_departements (
  code text primary key,
  nom text not null,
  code_region text not null references ref_regions (code),
  population integer not null default 0,
  geom jsonb,
  blason_url text
);

create index ref_departements_region_idx on ref_departements (code_region);

create table ref_communes (
  code_insee text primary key,
  nom text not null,
  code_departement text not null references ref_departements (code),
  code_region text not null references ref_regions (code),
  population integer not null check (population >= 0),
  latitude double precision,
  longitude double precision,
  rarete text not null check (
    rarete in ('COMMUNE', 'INHABITUELLE', 'RARE', 'EPIQUE', 'LEGENDAIRE', 'MYTHIQUE')
  ),
  score_base integer not null check (score_base >= 0),
  draw_bucket smallint not null default 0,
  geom jsonb
);

create index ref_communes_rarete_bucket_idx on ref_communes (rarete, draw_bucket);
create index ref_communes_departement_idx on ref_communes (code_departement);

create table ref_odonymes (
  id bigserial primary key,
  nom_normalise text not null unique,
  nom_affichage text not null,
  nb_communes integer not null check (nb_communes >= 1),
  rarete text not null check (
    rarete in ('COMMUNE', 'INHABITUELLE', 'RARE', 'EPIQUE', 'LEGENDAIRE', 'MYTHIQUE')
  ),
  score_base integer not null check (score_base >= 0),
  draw_bucket smallint not null default 0
);

create index ref_odonymes_rarete_bucket_idx on ref_odonymes (rarete, draw_bucket);

create table commune_odonymes (
  code_insee text not null references ref_communes (code_insee) on delete cascade,
  odonyme_id bigint not null references ref_odonymes (id) on delete cascade,
  primary key (code_insee, odonyme_id)
);

create index commune_odonymes_odonyme_idx on commune_odonymes (odonyme_id);
```

---

## 6. Types Kysely

Source : `packages/db/src/schema.ts`. Ce fichier doit rester le miroir exact du SQL ci-dessus.

```ts
import type { Generated } from 'kysely';

export type Rarity =
  | 'COMMUNE'
  | 'INHABITUELLE'
  | 'RARE'
  | 'EPIQUE'
  | 'LEGENDAIRE'
  | 'MYTHIQUE';

export type CardCategory = 'REGION' | 'DEPARTEMENT' | 'COMMUNE' | 'RUE';
export type TicketStatus = 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED';
export type MarketStatus = 'OPEN' | 'SOLD' | 'CANCELLED';
export type CardSource = 'TICKET' | 'MARKET' | 'REWARD';

export interface UserTable {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  pseudo: string | null;
  currency: number | null;
}

export interface SessionTable {
  id: string;
  expiresAt: Date;
  token: string;
  createdAt: Date;
  updatedAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string;
}

export interface AccountTable {
  id: string;
  accountId: string;
  providerId: string;
  userId: string;
  accessToken: string | null;
  refreshToken: string | null;
  idToken: string | null;
  accessTokenExpiresAt: Date | null;
  refreshTokenExpiresAt: Date | null;
  scope: string | null;
  password: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface VerificationTable {
  id: string;
  identifier: string;
  value: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RateLimitTable {
  id: string;
  key: string;
  count: number;
  lastRequest: string;
}

export interface GameConfigTable {
  key: string;
  value: unknown;
  updated_at: Generated<Date>;
}

export interface UserCardTable {
  id: Generated<string>;
  user_id: string;
  category: CardCategory;
  ref_code: string;
  rarity: Rarity;
  score: number;
  acquired_at: Generated<Date>;
  source: Generated<CardSource>;
  locked: Generated<boolean>;
}

export interface TicketTable {
  id: Generated<string>;
  user_id: string;
  status: Generated<TicketStatus>;
  grid: unknown;
  treasure_index: number;
  scrapes_remaining: Generated<number>;
  renovation_pending: Generated<boolean>;
  created_at: Generated<Date>;
  expires_at: Date | null;
}

export interface TicketRevealTable {
  ticket_id: string;
  cell_index: number;
  card_user_id: string | null;
  distance: number;
  revealed_at: Generated<Date>;
}

export interface TableauTable {
  id: Generated<string>;
  user_id: string;
  name: Generated<string>;
  region_card_id: string | null;
  departement_card_id: string | null;
  commune_card_id: string | null;
  rue_card_id: string | null;
  created_at: Generated<Date>;
}

export interface MarketListingTable {
  id: Generated<string>;
  seller_id: string;
  user_card_id: string;
  price: number;
  status: Generated<MarketStatus>;
  created_at: Generated<Date>;
  sold_at: Date | null;
  buyer_id: string | null;
}

export interface CurrencyLedgerTable {
  id: Generated<string>;
  user_id: string;
  delta: number;
  reason: string;
  created_at: Generated<Date>;
}

export interface RefRegionTable {
  code: string;
  nom: string;
  geom: unknown | null;
  blason_url: string | null;
}

export interface RefDepartementTable {
  code: string;
  nom: string;
  code_region: string;
  population: number;
  geom: unknown | null;
  blason_url: string | null;
}

export interface RefCommuneTable {
  code_insee: string;
  nom: string;
  code_departement: string;
  code_region: string;
  population: number;
  latitude: number | null;
  longitude: number | null;
  rarete: Rarity;
  score_base: number;
  draw_bucket: Generated<number>;
  geom: unknown | null;
}

export interface RefOdonymeTable {
  id: Generated<string>;
  nom_normalise: string;
  nom_affichage: string;
  nb_communes: number;
  rarete: Rarity;
  score_base: number;
  draw_bucket: Generated<number>;
}

export interface CommuneOdonymeTable {
  code_insee: string;
  odonyme_id: string;
}

export interface Database {
  user: UserTable;
  session: SessionTable;
  account: AccountTable;
  verification: VerificationTable;
  rateLimit: RateLimitTable;
  game_config: GameConfigTable;
  user_cards: UserCardTable;
  tickets: TicketTable;
  ticket_reveals: TicketRevealTable;
  tableaux: TableauTable;
  market_listings: MarketListingTable;
  currency_ledger: CurrencyLedgerTable;
  ref_regions: RefRegionTable;
  ref_departements: RefDepartementTable;
  ref_communes: RefCommuneTable;
  ref_odonymes: RefOdonymeTable;
  commune_odonymes: CommuneOdonymeTable;
}
```

> `bigserial` est typé `Generated<string>` car le driver `pg` renvoie les `int8` en chaîne. Ne pas les convertir en `number` sans configuration explicite.

---

## 7. Invariants et requêtes de référence

### 7.1 Invariants

- Un utilisateur a au plus **un ticket `ACTIVE`** (index unique partiel).
- `treasure_index ∈ [0, 15]`.
- `distance = |L1 - L2| + |C1 - C2| ∈ [0, 6]`.
- Une carte ne peut être dans qu'une seule annonce **ouverte** (index unique partiel `market_listings_open_card_idx`).
- Un achat est atomique : débit acheteur, crédit vendeur, transfert de `user_cards.user_id`, statut `SOLD`, `buyer_id`, `sold_at`.
- Les cartes verrouillées (`locked = true`) ne peuvent pas être vendues ou supprimées.

### 7.2 Tirage d'une carte d'un palier

```sql
select *
from ref_communes
where rarete = $1
order by random()
limit 1;
```

Optimisation prévue : `draw_bucket` + index `(rarete, draw_bucket)`.

### 7.3 Vérification d'une rue dans une commune

```sql
select 1
from commune_odonymes
where code_insee = $1
  and odonyme_id = $2;
```

### 7.4 Vérification d'alignement

```sql
select
  d.code_region = $region_code as region_departement,
  c.code_departement = d.code as departement_commune
from ref_departements d
join ref_communes c on c.code_departement = d.code
where d.code = $departement_code
  and c.code_insee = $commune_code;

select exists (
  select 1 from commune_odonymes
  where code_insee = $commune_code and odonyme_id = $odonyme_id
) as commune_rue;
```

---

## 8. Checklist de migration

1. Mettre à jour `.docs/02-database.md` (statut, DDL, types).
2. Créer une nouvelle migration dans `packages/db/migrations/`.
3. Enregistrer la migration dans `packages/db/src/migrator.ts`.
4. Mettre à jour `packages/db/src/schema.ts`.
5. Exécuter la migration dans le conteneur.
6. Lancer `bun run typecheck`, `bun run lint`, `bun test packages/spec`.
7. Passer le statut de la table à **Migrée** dans ce document.
