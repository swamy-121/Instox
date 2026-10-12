CREATE TABLE IF NOT EXISTS schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  email text,
  phone_number text,
  photo_url text,
  status text NOT NULL DEFAULT 'active',
  locale text NOT NULL DEFAULT 'en-IN',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  password_hash text,
  consent_version text,
  consent_at text,
  providers jsonb NOT NULL DEFAULT '[]'::jsonb,
  tip_push boolean NOT NULL DEFAULT false,
  marketing_push boolean NOT NULL DEFAULT false,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON users (phone_number);
CREATE INDEX IF NOT EXISTS users_created_at_idx ON users (created_at);
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

CREATE TABLE IF NOT EXISTS user_roles (
  user_id text PRIMARY KEY,
  roles text[] NOT NULL,
  granted_by text NOT NULL,
  granted_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS user_roles_roles_idx ON user_roles USING gin (roles);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  user_id text NOT NULL,
  auth_time text NOT NULL,
  expires_at text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS otp_challenges (
  id text PRIMARY KEY,
  phone_number text NOT NULL,
  code_hash text NOT NULL,
  expires_at text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  consumed_at text,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS otp_phone_idx ON otp_challenges (phone_number, created_at);

CREATE TABLE IF NOT EXISTS password_resets (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  token_hash text NOT NULL,
  expires_at text NOT NULL,
  consumed_at text,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id);

CREATE TABLE IF NOT EXISTS entitlements (
  user_id text PRIMARY KEY,
  plan_id text,
  status text NOT NULL,
  starts_at text,
  ends_at text,
  source_order_id text,
  source text NOT NULL DEFAULT 'manual',
  version integer NOT NULL DEFAULT 1,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS entitlements_status_idx ON entitlements (status);
CREATE INDEX IF NOT EXISTS entitlements_plan_idx ON entitlements (plan_id);

CREATE TABLE IF NOT EXISTS content_documents (
  collection text NOT NULL,
  id text NOT NULL,
  body jsonb NOT NULL,
  status text,
  sort integer NOT NULL DEFAULT 0,
  active boolean,
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS content_status_idx ON content_documents (collection, status);
CREATE INDEX IF NOT EXISTS content_sort_idx ON content_documents (collection, sort);

CREATE TABLE IF NOT EXISTS subscriptions (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  plan_id text NOT NULL,
  status text NOT NULL,
  period_end text,
  cancel_requested_at text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON subscriptions (user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status);

CREATE TABLE IF NOT EXISTS payment_orders (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  plan_id text NOT NULL,
  provider text NOT NULL,
  provider_order_id text,
  amount_minor integer NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  idempotency_key text,
  created_at text NOT NULL,
  expires_at text,
  verified_at text,
  failure_code text,
  placeholder boolean NOT NULL DEFAULT true,
  entitlement_granted boolean NOT NULL DEFAULT false,
  status_reason text,
  status_updated_by text,
  updated_at text
);
CREATE INDEX IF NOT EXISTS payment_orders_user_idx ON payment_orders (user_id);
CREATE INDEX IF NOT EXISTS payment_orders_status_idx ON payment_orders (status);
CREATE INDEX IF NOT EXISTS payment_orders_created_idx ON payment_orders (created_at);

CREATE TABLE IF NOT EXISTS payment_events (
  id text PRIMARY KEY,
  provider text NOT NULL,
  provider_event_id text NOT NULL,
  order_id text NOT NULL,
  event_type text NOT NULL,
  amount_minor integer,
  currency text,
  signature_verified boolean NOT NULL,
  payload_hash text NOT NULL,
  received_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS payment_events_provider_idx ON payment_events (provider, provider_event_id);
CREATE INDEX IF NOT EXISTS payment_events_order_idx ON payment_events (order_id);

CREATE TABLE IF NOT EXISTS tips (
  id text PRIMARY KEY,
  symbol text NOT NULL,
  instrument_id text NOT NULL,
  segment text NOT NULL,
  category text NOT NULL,
  side text NOT NULL,
  entry_min double precision NOT NULL,
  entry_max double precision,
  stop_loss double precision NOT NULL,
  targets jsonb NOT NULL,
  option_type text,
  strike_price double precision,
  expiry text,
  underlying text,
  lot_size integer,
  timeframe text NOT NULL,
  thesis text NOT NULL,
  risk_disclosure_version text NOT NULL,
  access_tier text NOT NULL,
  status text NOT NULL,
  close_reason text,
  published_at text,
  expires_at text,
  created_by text NOT NULL,
  updated_by text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL,
  schema_version integer NOT NULL,
  version integer NOT NULL,
  featured boolean NOT NULL DEFAULT false,
  published_sort text,
  updated_sort text NOT NULL
);
CREATE INDEX IF NOT EXISTS tips_status_idx ON tips (status);
CREATE INDEX IF NOT EXISTS tips_published_sort_idx ON tips (published_sort);
CREATE INDEX IF NOT EXISTS tips_updated_sort_idx ON tips (updated_sort);
CREATE INDEX IF NOT EXISTS tips_symbol_idx ON tips (symbol);
CREATE INDEX IF NOT EXISTS tips_status_tier_idx ON tips (status, access_tier);

CREATE TABLE IF NOT EXISTS tip_events (
  id text PRIMARY KEY,
  tip_id text NOT NULL,
  event_type text NOT NULL,
  old_status text,
  new_status text,
  old_version integer,
  new_version integer,
  reason text NOT NULL,
  actor_uid text NOT NULL,
  occurred_at text NOT NULL,
  request_id text NOT NULL,
  previous jsonb
);
CREATE INDEX IF NOT EXISTS tip_events_tip_idx ON tip_events (tip_id, occurred_at);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id text PRIMARY KEY,
  order_id text,
  tip_id text,
  action text,
  actor_uid text,
  checkout jsonb,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  actor_uid text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  occurred_at text NOT NULL,
  request_id text NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_logs_occurred_idx ON audit_logs (occurred_at);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit_logs (actor_uid);

CREATE TABLE IF NOT EXISTS watchlist_items (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  symbol text NOT NULL,
  created_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS watchlist_user_symbol_idx ON watchlist_items (user_id, symbol);
CREATE INDEX IF NOT EXISTS watchlist_user_idx ON watchlist_items (user_id);

CREATE TABLE IF NOT EXISTS referral_codes (
  code text PRIMARY KEY,
  user_id text NOT NULL,
  created_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS referral_codes_user_idx ON referral_codes (user_id);

CREATE TABLE IF NOT EXISTS referral_accounts (
  user_id text PRIMARY KEY,
  code text NOT NULL,
  conversions integer NOT NULL DEFAULT 0,
  created_at text NOT NULL,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS referrals (
  referred_user_id text PRIMARY KEY,
  referrer_user_id text NOT NULL,
  code text NOT NULL,
  qualified boolean NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS referrals_referrer_idx ON referrals (referrer_user_id);

CREATE TABLE IF NOT EXISTS reward_ledger (
  id text PRIMARY KEY,
  referrer_user_id text NOT NULL,
  referred_user_id text NOT NULL,
  status text NOT NULL,
  reward_days integer NOT NULL,
  reason text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS reward_ledger_referrer_idx ON reward_ledger (referrer_user_id);

CREATE TABLE IF NOT EXISTS fcm_tokens (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'web',
  revoked boolean NOT NULL DEFAULT false,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS fcm_tokens_user_idx ON fcm_tokens (user_id);

CREATE TABLE IF NOT EXISTS notification_campaigns (
  id text PRIMARY KEY,
  tip_id text,
  title text,
  body text,
  audience text,
  kind text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL,
  configured boolean,
  counts jsonb,
  created_by text,
  created_at text NOT NULL,
  updated_at text,
  reason text
);
CREATE INDEX IF NOT EXISTS notification_campaigns_created_idx ON notification_campaigns (created_at);
CREATE INDEX IF NOT EXISTS notification_campaigns_kind_idx ON notification_campaigns (kind);

CREATE TABLE IF NOT EXISTS alerts (
  id text PRIMARY KEY,
  campaign_id text NOT NULL,
  token_id text,
  status text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  url text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS alerts_campaign_idx ON alerts (campaign_id);
CREATE INDEX IF NOT EXISTS alerts_status_idx ON alerts (status);

CREATE TABLE IF NOT EXISTS instruments (
  symbol text PRIMARY KEY,
  exchange text NOT NULL,
  segment text NOT NULL,
  instrument_type text NOT NULL,
  tick_size double precision NOT NULL,
  lot_size integer,
  is_eligible boolean NOT NULL,
  eligibility_source text NOT NULL,
  effective_from text NOT NULL,
  effective_to text,
  data_label text NOT NULL,
  updated_at text,
  updated_by text
);

CREATE TABLE IF NOT EXISTS market_quotes (
  symbol text PRIMARY KEY,
  last double precision,
  change_pct double precision,
  source_timestamp text,
  updated_at text NOT NULL,
  provider_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS candle_series (
  symbol text PRIMARY KEY,
  candles jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS strategies (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  name text NOT NULL,
  rules jsonb NOT NULL,
  version integer NOT NULL,
  status text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS strategies_user_idx ON strategies (user_id);

CREATE TABLE IF NOT EXISTS backtests (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  symbol text NOT NULL,
  result jsonb NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS backtests_user_idx ON backtests (user_id);
CREATE INDEX IF NOT EXISTS backtests_symbol_idx ON backtests (symbol);

CREATE TABLE IF NOT EXISTS shop_orders (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  product_id text NOT NULL,
  amount_minor integer NOT NULL,
  currency text NOT NULL,
  status text NOT NULL,
  fulfillment text NOT NULL,
  grants_entitlement boolean NOT NULL DEFAULT false,
  idempotency_key text,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS shop_orders_user_idx ON shop_orders (user_id);
CREATE INDEX IF NOT EXISTS shop_orders_status_idx ON shop_orders (status);

CREATE TABLE IF NOT EXISTS deletion_requests (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  status text NOT NULL,
  reason text NOT NULL,
  requested_at text NOT NULL,
  request_id text NOT NULL,
  note text NOT NULL
);
CREATE INDEX IF NOT EXISTS deletion_requests_user_idx ON deletion_requests (user_id);

CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by text,
  updated_at text
);

CREATE TABLE IF NOT EXISTS integration_secrets (
  field_key text PRIMARY KEY,
  iv text NOT NULL,
  tag text NOT NULL,
  data text NOT NULL,
  updated_by text,
  updated_at text
);
