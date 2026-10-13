CREATE TABLE IF NOT EXISTS saved_tips (
  user_id text NOT NULL,
  tip_id text NOT NULL,
  created_at text NOT NULL,
  PRIMARY KEY (user_id, tip_id)
);
CREATE INDEX IF NOT EXISTS saved_tips_user_idx ON saved_tips (user_id);

CREATE TABLE IF NOT EXISTS tracked_tips (
  user_id text NOT NULL,
  tip_id text NOT NULL,
  created_at text NOT NULL,
  PRIMARY KEY (user_id, tip_id)
);
CREATE INDEX IF NOT EXISTS tracked_tips_tip_idx ON tracked_tips (tip_id);

CREATE TABLE IF NOT EXISTS tip_alert_prefs (
  user_id text PRIMARY KEY,
  target_hit boolean NOT NULL DEFAULT true,
  stop_loss boolean NOT NULL DEFAULT true,
  expired boolean NOT NULL DEFAULT false,
  updated_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS member_alerts (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  tip_id text,
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  read_at text,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS member_alerts_user_idx ON member_alerts (user_id, created_at);

CREATE TABLE IF NOT EXISTS tip_checks (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  symbol text NOT NULL,
  side text NOT NULL,
  agreement integer NOT NULL,
  summary text NOT NULL,
  source text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS tip_checks_user_idx ON tip_checks (user_id, created_at);
CREATE INDEX IF NOT EXISTS tip_checks_symbol_idx ON tip_checks (symbol);

CREATE TABLE IF NOT EXISTS daily_bars (
  symbol text NOT NULL,
  trade_date text NOT NULL,
  open double precision NOT NULL,
  high double precision NOT NULL,
  low double precision NOT NULL,
  close double precision NOT NULL,
  volume double precision NOT NULL,
  source text NOT NULL,
  PRIMARY KEY (symbol, trade_date)
);

CREATE TABLE IF NOT EXISTS option_oi (
  trade_date text NOT NULL,
  underlying text NOT NULL,
  expiry text NOT NULL,
  strike double precision NOT NULL,
  option_type text NOT NULL,
  open_interest double precision NOT NULL,
  oi_change double precision NOT NULL,
  ltp double precision NOT NULL,
  iv double precision,
  volume double precision NOT NULL,
  source text NOT NULL,
  PRIMARY KEY (trade_date, underlying, expiry, strike, option_type)
);
CREATE INDEX IF NOT EXISTS option_oi_underlying_idx ON option_oi (underlying, trade_date);

CREATE TABLE IF NOT EXISTS affiliates (
  id text PRIMARY KEY,
  name text NOT NULL,
  code text NOT NULL,
  commission_bps integer NOT NULL,
  status text NOT NULL,
  notes text NOT NULL DEFAULT '',
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS affiliates_code_idx ON affiliates (code);

CREATE TABLE IF NOT EXISTS job_runs (
  id text PRIMARY KEY,
  job text NOT NULL,
  status text NOT NULL,
  summary jsonb NOT NULL,
  actor_id text NOT NULL,
  started_at text NOT NULL,
  finished_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS job_runs_job_idx ON job_runs (job, started_at);
