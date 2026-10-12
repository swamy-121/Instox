CREATE TABLE IF NOT EXISTS crm_contacts (
  id text PRIMARY KEY,
  user_id text,
  kind text NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  stage text NOT NULL,
  plan_id text,
  renewal_at text,
  trial_ends_at text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS crm_contacts_user_idx ON crm_contacts (user_id);
CREATE INDEX IF NOT EXISTS crm_contacts_stage_idx ON crm_contacts (stage);
CREATE INDEX IF NOT EXISTS crm_contacts_plan_idx ON crm_contacts (plan_id);
CREATE INDEX IF NOT EXISTS crm_contacts_trial_idx ON crm_contacts (trial_ends_at);
CREATE INDEX IF NOT EXISTS crm_contacts_phone_idx ON crm_contacts (phone);

CREATE TABLE IF NOT EXISTS crm_notes (
  id text PRIMARY KEY,
  contact_id text NOT NULL,
  author_id text NOT NULL,
  body text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS crm_notes_contact_idx ON crm_notes (contact_id, created_at);

CREATE TABLE IF NOT EXISTS crm_reminders (
  id text PRIMARY KEY,
  contact_id text NOT NULL,
  author_id text NOT NULL,
  body text NOT NULL,
  due_at text NOT NULL,
  done_at text,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS crm_reminders_contact_idx ON crm_reminders (contact_id, due_at);

CREATE TABLE IF NOT EXISTS crm_activities (
  id text PRIMARY KEY,
  contact_id text NOT NULL,
  kind text NOT NULL,
  summary text NOT NULL,
  created_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS crm_activities_contact_idx ON crm_activities (contact_id, created_at);

CREATE TABLE IF NOT EXISTS voice_campaigns (
  id text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  language text NOT NULL,
  voice text NOT NULL,
  prompt text NOT NULL,
  provider_agent_id text,
  created_by text NOT NULL,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS voice_campaigns_created_idx ON voice_campaigns (created_at);

CREATE TABLE IF NOT EXISTS voice_calls (
  id text PRIMARY KEY,
  campaign_id text NOT NULL,
  contact_id text NOT NULL,
  provider text NOT NULL,
  provider_call_id text,
  status text NOT NULL,
  duration_seconds integer,
  recording_url text,
  transcript text,
  simulated boolean NOT NULL DEFAULT false,
  started_at text,
  ended_at text,
  created_at text NOT NULL,
  updated_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS voice_calls_contact_idx ON voice_calls (contact_id);
CREATE INDEX IF NOT EXISTS voice_calls_campaign_idx ON voice_calls (campaign_id);
CREATE UNIQUE INDEX IF NOT EXISTS voice_calls_provider_idx ON voice_calls (provider, provider_call_id);
