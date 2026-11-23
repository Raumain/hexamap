import type { Generated } from 'kysely';

export type Rarity = 'COMMUNE' | 'INHABITUELLE' | 'RARE' | 'EPIQUE' | 'LEGENDAIRE' | 'MYTHIQUE';

export type CardCategory = 'REGION' | 'DEPARTEMENT' | 'COMMUNE' | 'RUE';
export type TicketStatus = 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED';
export type MarketStatus = 'OPEN' | 'SOLD' | 'CANCELLED';
export type CardSource = 'TICKET' | 'MARKET' | 'REWARD' | 'CRAFT';

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
  score: Generated<number>;
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
  contour_url: string | null;
  blason_credit: string | null;
  path_d: string | null;
  view_box: Generated<string>;
}

export interface RefDepartementTable {
  code: string;
  nom: string;
  code_region: string;
  population: number;
  geom: unknown | null;
  blason_url: string | null;
  contour_url: string | null;
  blason_credit: string | null;
  path_d: string | null;
  view_box: Generated<string>;
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
  blason_url: string | null;
  contour_url: string | null;
  blason_credit: string | null;
  path_d: string | null;
  view_box: Generated<string>;
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

export interface RateLimitTable {
  id: string;
  key: string;
  count: number;
  lastRequest: string;
}

export interface UserScratchChargeTable {
  user_id: string;
  charges: number;
  last_regen_at: Generated<Date>;
}

export interface UserAchievementTable {
  user_id: string;
  achievement_key: string;
  unlocked_at: Generated<Date>;
}

export type FriendshipStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED';

export interface FriendshipTable {
  requester_id: string;
  addressee_id: string;
  status: Generated<FriendshipStatus>;
  created_at: Generated<Date>;
  responded_at: Date | null;
}

export interface BlockTable {
  blocker_id: string;
  blocked_id: string;
  created_at: Generated<Date>;
}

export interface UserProfileTable {
  user_id: string;
  bio: string | null;
  profile_public: Generated<boolean>;
  updated_at: Generated<Date>;
}

export type NotificationKind =
  | 'FRIEND_REQUEST'
  | 'FRIEND_ACCEPTED'
  | 'ACHIEVEMENT'
  | 'MARKET_SOLD'
  | 'MARKET_BOUGHT'
  | 'TRADE_OFFER'
  | 'TRADE_ACCEPTED'
  | 'TRADE_DECLINED'
  | 'TRADE_EXPIRED';

export interface NotificationTable {
  id: Generated<string>;
  user_id: string;
  kind: NotificationKind;
  dedupe_key: string;
  payload: unknown;
  created_at: Generated<Date>;
  read_at: Date | null;
}

export type TradeStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'CANCELLED' | 'EXPIRED';

export interface TradeOfferTable {
  id: Generated<string>;
  proposer_id: string;
  receiver_id: string;
  offered_card_id: string;
  requested_card_id: string;
  status: Generated<TradeStatus>;
  created_at: Generated<Date>;
  responded_at: Date | null;
  expires_at: Date;
}

/** La Sonnette — un abonnement par navigateur, clé métier `endpoint` (base §4.12). */
export interface PushSubscriptionTable {
  id: Generated<string>;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  /** Jour UTC `YYYY-MM-DD` du dernier envoi ; `null` tant qu'aucun envoi n'a eu lieu. */
  last_sent_on: string | null;
  /** Instant de régénération annoncé, pour ne pas réannoncer la même charge. */
  last_notified_charge_at: Date | null;
  last_sent_at: Date | null;
  created_at: Generated<Date>;
}

/** Heures calmes, clé `user_id` : survit au désabonnement (base §4.12). */
export interface PushPreferencesTable {
  user_id: string;
  quiet_start: Generated<number>;
  quiet_end: Generated<number>;
  updated_at: Generated<Date>;
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
  user_scratch_charges: UserScratchChargeTable;
  user_achievements: UserAchievementTable;
  friendships: FriendshipTable;
  blocks: BlockTable;
  user_profiles: UserProfileTable;
  notifications: NotificationTable;
  trade_offers: TradeOfferTable;
  push_subscriptions: PushSubscriptionTable;
  push_preferences: PushPreferencesTable;
}
