import { boolean, doublePrecision, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    displayName: text("display_name").notNull().default(""),
    email: text("email"),
    phoneNumber: text("phone_number"),
    photoUrl: text("photo_url"),
    status: text("status").notNull().default("active"),
    locale: text("locale").notNull().default("en-IN"),
    timezone: text("timezone").notNull().default("Asia/Kolkata"),
    passwordHash: text("password_hash"),
    consentVersion: text("consent_version"),
    consentAt: text("consent_at"),
    providers: jsonb("providers").$type<string[]>().notNull().default([]),
    tipPush: boolean("tip_push").notNull().default(false),
    marketingPush: boolean("marketing_push").notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_phone_idx").on(table.phoneNumber),
    index("users_created_at_idx").on(table.createdAt),
    index("users_status_idx").on(table.status),
  ],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: text("user_id").primaryKey(),
    roles: text("roles").array().notNull(),
    grantedBy: text("granted_by").notNull(),
    grantedAt: text("granted_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("user_roles_roles_idx").using("gin", table.roles)],
);

export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: text("user_id").notNull(),
    authTime: text("auth_time").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("sessions_user_idx").on(table.userId), index("sessions_expires_idx").on(table.expiresAt)],
);

export const otpChallenges = pgTable(
  "otp_challenges",
  {
    id: text("id").primaryKey(),
    phoneNumber: text("phone_number").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("otp_phone_idx").on(table.phoneNumber, table.createdAt)],
);

export const passwordResets = pgTable(
  "password_resets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tokenHash: text("token_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    consumedAt: text("consumed_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("password_resets_user_idx").on(table.userId)],
);

export const entitlements = pgTable(
  "entitlements",
  {
    userId: text("user_id").primaryKey(),
    planId: text("plan_id"),
    status: text("status").notNull(),
    startsAt: text("starts_at"),
    endsAt: text("ends_at"),
    sourceOrderId: text("source_order_id"),
    source: text("source").notNull().default("manual"),
    version: integer("version").notNull().default(1),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("entitlements_status_idx").on(table.status), index("entitlements_plan_idx").on(table.planId)],
);

export const contentDocuments = pgTable(
  "content_documents",
  {
    collection: text("collection").notNull(),
    id: text("id").notNull(),
    body: jsonb("body").$type<Record<string, unknown>>().notNull(),
    status: text("status"),
    sort: integer("sort").notNull().default(0),
    active: boolean("active"),
  },
  (table) => [
    primaryKey({ columns: [table.collection, table.id] }),
    index("content_status_idx").on(table.collection, table.status),
    index("content_sort_idx").on(table.collection, table.sort),
  ],
);

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    planId: text("plan_id").notNull(),
    status: text("status").notNull(),
    periodEnd: text("period_end"),
    cancelRequestedAt: text("cancel_requested_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("subscriptions_user_idx").on(table.userId), index("subscriptions_status_idx").on(table.status)],
);

export const paymentOrders = pgTable(
  "payment_orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    planId: text("plan_id").notNull(),
    provider: text("provider").notNull(),
    providerOrderId: text("provider_order_id"),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    idempotencyKey: text("idempotency_key"),
    createdAt: text("created_at").notNull(),
    expiresAt: text("expires_at"),
    verifiedAt: text("verified_at"),
    failureCode: text("failure_code"),
    placeholder: boolean("placeholder").notNull().default(true),
    entitlementGranted: boolean("entitlement_granted").notNull().default(false),
    statusReason: text("status_reason"),
    statusUpdatedBy: text("status_updated_by"),
    updatedAt: text("updated_at"),
  },
  (table) => [
    index("payment_orders_user_idx").on(table.userId),
    index("payment_orders_status_idx").on(table.status),
    index("payment_orders_created_idx").on(table.createdAt),
  ],
);

export const paymentEvents = pgTable(
  "payment_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider").notNull(),
    providerEventId: text("provider_event_id").notNull(),
    orderId: text("order_id").notNull(),
    eventType: text("event_type").notNull(),
    amountMinor: integer("amount_minor"),
    currency: text("currency"),
    signatureVerified: boolean("signature_verified").notNull(),
    payloadHash: text("payload_hash").notNull(),
    receivedAt: text("received_at").notNull(),
  },
  (table) => [
    uniqueIndex("payment_events_provider_idx").on(table.provider, table.providerEventId),
    index("payment_events_order_idx").on(table.orderId),
  ],
);

export const tips = pgTable(
  "tips",
  {
    id: text("id").primaryKey(),
    symbol: text("symbol").notNull(),
    instrumentId: text("instrument_id").notNull(),
    segment: text("segment").notNull(),
    category: text("category").notNull(),
    side: text("side").notNull(),
    entryMin: doublePrecision("entry_min").notNull(),
    entryMax: doublePrecision("entry_max"),
    stopLoss: doublePrecision("stop_loss").notNull(),
    targets: jsonb("targets").$type<Array<{ label: string; price: number }>>().notNull(),
    optionType: text("option_type"),
    strikePrice: doublePrecision("strike_price"),
    expiry: text("expiry"),
    underlying: text("underlying"),
    lotSize: integer("lot_size"),
    timeframe: text("timeframe").notNull(),
    thesis: text("thesis").notNull(),
    riskDisclosureVersion: text("risk_disclosure_version").notNull(),
    accessTier: text("access_tier").notNull(),
    status: text("status").notNull(),
    closeReason: text("close_reason"),
    publishedAt: text("published_at"),
    expiresAt: text("expires_at"),
    createdBy: text("created_by").notNull(),
    updatedBy: text("updated_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    version: integer("version").notNull(),
    featured: boolean("featured").notNull().default(false),
    publishedSort: text("published_sort"),
    updatedSort: text("updated_sort").notNull(),
  },
  (table) => [
    index("tips_status_idx").on(table.status),
    index("tips_published_sort_idx").on(table.publishedSort),
    index("tips_updated_sort_idx").on(table.updatedSort),
    index("tips_symbol_idx").on(table.symbol),
    index("tips_status_tier_idx").on(table.status, table.accessTier),
  ],
);

export const tipEvents = pgTable(
  "tip_events",
  {
    id: text("id").primaryKey(),
    tipId: text("tip_id").notNull(),
    eventType: text("event_type").notNull(),
    oldStatus: text("old_status"),
    newStatus: text("new_status"),
    oldVersion: integer("old_version"),
    newVersion: integer("new_version"),
    reason: text("reason").notNull(),
    actorUid: text("actor_uid").notNull(),
    occurredAt: text("occurred_at").notNull(),
    requestId: text("request_id").notNull(),
    previous: jsonb("previous").$type<Record<string, unknown> | null>(),
  },
  (table) => [index("tip_events_tip_idx").on(table.tipId, table.occurredAt)],
);

export const idempotencyKeys = pgTable("idempotency_keys", {
  id: text("id").primaryKey(),
  orderId: text("order_id"),
  tipId: text("tip_id"),
  action: text("action"),
  actorUid: text("actor_uid"),
  checkout: jsonb("checkout").$type<Record<string, unknown> | null>(),
  createdAt: text("created_at").notNull(),
});

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    actorUid: text("actor_uid").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason").notNull(),
    occurredAt: text("occurred_at").notNull(),
    requestId: text("request_id").notNull(),
  },
  (table) => [index("audit_logs_occurred_idx").on(table.occurredAt), index("audit_logs_actor_idx").on(table.actorUid)],
);

export const watchlistItems = pgTable(
  "watchlist_items",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    symbol: text("symbol").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("watchlist_user_symbol_idx").on(table.userId, table.symbol), index("watchlist_user_idx").on(table.userId)],
);

export const referralCodes = pgTable(
  "referral_codes",
  {
    code: text("code").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [uniqueIndex("referral_codes_user_idx").on(table.userId)],
);

export const referralAccounts = pgTable("referral_accounts", {
  userId: text("user_id").primaryKey(),
  code: text("code").notNull(),
  conversions: integer("conversions").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const referrals = pgTable(
  "referrals",
  {
    referredUserId: text("referred_user_id").primaryKey(),
    referrerUserId: text("referrer_user_id").notNull(),
    code: text("code").notNull(),
    qualified: boolean("qualified").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("referrals_referrer_idx").on(table.referrerUserId)],
);

export const rewardLedger = pgTable(
  "reward_ledger",
  {
    id: text("id").primaryKey(),
    referrerUserId: text("referrer_user_id").notNull(),
    referredUserId: text("referred_user_id").notNull(),
    status: text("status").notNull(),
    rewardDays: integer("reward_days").notNull(),
    reason: text("reason").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("reward_ledger_referrer_idx").on(table.referrerUserId)],
);

export const fcmTokens = pgTable(
  "fcm_tokens",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    token: text("token").notNull(),
    platform: text("platform").notNull().default("web"),
    revoked: boolean("revoked").notNull().default(false),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("fcm_tokens_user_idx").on(table.userId)],
);

export const notificationCampaigns = pgTable(
  "notification_campaigns",
  {
    id: text("id").primaryKey(),
    tipId: text("tip_id"),
    title: text("title"),
    body: text("body"),
    audience: text("audience"),
    kind: text("kind").notNull(),
    channel: text("channel").notNull(),
    status: text("status").notNull(),
    configured: boolean("configured"),
    counts: jsonb("counts").$type<Record<string, number> | null>(),
    createdBy: text("created_by"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at"),
    reason: text("reason"),
  },
  (table) => [index("notification_campaigns_created_idx").on(table.createdAt), index("notification_campaigns_kind_idx").on(table.kind)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").notNull(),
    tokenId: text("token_id"),
    status: text("status").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("alerts_campaign_idx").on(table.campaignId), index("alerts_status_idx").on(table.status)],
);

export const instruments = pgTable("instruments", {
  symbol: text("symbol").primaryKey(),
  exchange: text("exchange").notNull(),
  segment: text("segment").notNull(),
  instrumentType: text("instrument_type").notNull(),
  tickSize: doublePrecision("tick_size").notNull(),
  lotSize: integer("lot_size"),
  isEligible: boolean("is_eligible").notNull(),
  eligibilitySource: text("eligibility_source").notNull(),
  effectiveFrom: text("effective_from").notNull(),
  effectiveTo: text("effective_to"),
  dataLabel: text("data_label").notNull(),
  updatedAt: text("updated_at"),
  updatedBy: text("updated_by"),
});

export const marketQuotes = pgTable("market_quotes", {
  symbol: text("symbol").primaryKey(),
  last: doublePrecision("last"),
  changePct: doublePrecision("change_pct"),
  sourceTimestamp: text("source_timestamp"),
  updatedAt: text("updated_at").notNull(),
  providerId: text("provider_id").notNull(),
});

export const candleSeries = pgTable("candle_series", {
  symbol: text("symbol").primaryKey(),
  candles: jsonb("candles").$type<unknown[]>().notNull(),
});

export const strategies = pgTable(
  "strategies",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    rules: jsonb("rules").$type<unknown[]>().notNull(),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("strategies_user_idx").on(table.userId)],
);

export const backtests = pgTable(
  "backtests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    symbol: text("symbol").notNull(),
    result: jsonb("result").$type<Record<string, unknown>>().notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("backtests_user_idx").on(table.userId), index("backtests_symbol_idx").on(table.symbol)],
);

export const shopOrders = pgTable(
  "shop_orders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    productId: text("product_id").notNull(),
    amountMinor: integer("amount_minor").notNull(),
    currency: text("currency").notNull(),
    status: text("status").notNull(),
    fulfillment: text("fulfillment").notNull(),
    grantsEntitlement: boolean("grants_entitlement").notNull().default(false),
    idempotencyKey: text("idempotency_key"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("shop_orders_user_idx").on(table.userId), index("shop_orders_status_idx").on(table.status)],
);

export const deletionRequests = pgTable(
  "deletion_requests",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    status: text("status").notNull(),
    reason: text("reason").notNull(),
    requestedAt: text("requested_at").notNull(),
    requestId: text("request_id").notNull(),
    note: text("note").notNull(),
  },
  (table) => [index("deletion_requests_user_idx").on(table.userId)],
);

export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").$type<Record<string, unknown>>().notNull(),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at"),
});

export const crmContacts = pgTable(
  "crm_contacts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    kind: text("kind").notNull(),
    name: text("name").notNull(),
    phone: text("phone"),
    email: text("email"),
    stage: text("stage").notNull(),
    planId: text("plan_id"),
    renewalAt: text("renewal_at"),
    trialEndsAt: text("trial_ends_at"),
    tags: text("tags").array().notNull().default([]),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("crm_contacts_user_idx").on(table.userId),
    index("crm_contacts_stage_idx").on(table.stage),
    index("crm_contacts_plan_idx").on(table.planId),
    index("crm_contacts_trial_idx").on(table.trialEndsAt),
    index("crm_contacts_phone_idx").on(table.phone),
  ],
);

export const crmNotes = pgTable(
  "crm_notes",
  {
    id: text("id").primaryKey(),
    contactId: text("contact_id").notNull(),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("crm_notes_contact_idx").on(table.contactId, table.createdAt)],
);

export const crmReminders = pgTable(
  "crm_reminders",
  {
    id: text("id").primaryKey(),
    contactId: text("contact_id").notNull(),
    authorId: text("author_id").notNull(),
    body: text("body").notNull(),
    dueAt: text("due_at").notNull(),
    doneAt: text("done_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("crm_reminders_contact_idx").on(table.contactId, table.dueAt)],
);

export const crmActivities = pgTable(
  "crm_activities",
  {
    id: text("id").primaryKey(),
    contactId: text("contact_id").notNull(),
    kind: text("kind").notNull(),
    summary: text("summary").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("crm_activities_contact_idx").on(table.contactId, table.createdAt)],
);

export const voiceCampaigns = pgTable(
  "voice_campaigns",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    language: text("language").notNull(),
    voice: text("voice").notNull(),
    prompt: text("prompt").notNull(),
    providerAgentId: text("provider_agent_id"),
    createdBy: text("created_by").notNull(),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [index("voice_campaigns_created_idx").on(table.createdAt)],
);

export const voiceCalls = pgTable(
  "voice_calls",
  {
    id: text("id").primaryKey(),
    campaignId: text("campaign_id").notNull(),
    contactId: text("contact_id").notNull(),
    provider: text("provider").notNull(),
    providerCallId: text("provider_call_id"),
    status: text("status").notNull(),
    durationSeconds: integer("duration_seconds"),
    recordingUrl: text("recording_url"),
    transcript: text("transcript"),
    simulated: boolean("simulated").notNull().default(false),
    startedAt: text("started_at"),
    endedAt: text("ended_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("voice_calls_contact_idx").on(table.contactId),
    index("voice_calls_campaign_idx").on(table.campaignId),
    uniqueIndex("voice_calls_provider_idx").on(table.provider, table.providerCallId),
  ],
);

export const savedTips = pgTable(
  "saved_tips",
  {
    userId: text("user_id").notNull(),
    tipId: text("tip_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tipId] }), index("saved_tips_user_idx").on(table.userId)],
);

export const trackedTips = pgTable(
  "tracked_tips",
  {
    userId: text("user_id").notNull(),
    tipId: text("tip_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.tipId] }), index("tracked_tips_tip_idx").on(table.tipId)],
);

export const tipAlertPrefs = pgTable("tip_alert_prefs", {
  userId: text("user_id").primaryKey(),
  targetHit: boolean("target_hit").notNull().default(true),
  stopLoss: boolean("stop_loss").notNull().default(true),
  expired: boolean("expired").notNull().default(false),
  updatedAt: text("updated_at").notNull(),
});

export const memberAlerts = pgTable(
  "member_alerts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    tipId: text("tip_id"),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    readAt: text("read_at"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("member_alerts_user_idx").on(table.userId, table.createdAt)],
);

export const tipChecks = pgTable(
  "tip_checks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    symbol: text("symbol").notNull(),
    side: text("side").notNull(),
    agreement: integer("agreement").notNull(),
    summary: text("summary").notNull(),
    source: text("source").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (table) => [index("tip_checks_user_idx").on(table.userId, table.createdAt), index("tip_checks_symbol_idx").on(table.symbol)],
);

export const dailyBars = pgTable(
  "daily_bars",
  {
    symbol: text("symbol").notNull(),
    tradeDate: text("trade_date").notNull(),
    open: doublePrecision("open").notNull(),
    high: doublePrecision("high").notNull(),
    low: doublePrecision("low").notNull(),
    close: doublePrecision("close").notNull(),
    volume: doublePrecision("volume").notNull(),
    source: text("source").notNull(),
  },
  (table) => [primaryKey({ columns: [table.symbol, table.tradeDate] })],
);

export const optionOi = pgTable(
  "option_oi",
  {
    tradeDate: text("trade_date").notNull(),
    underlying: text("underlying").notNull(),
    expiry: text("expiry").notNull(),
    strike: doublePrecision("strike").notNull(),
    optionType: text("option_type").notNull(),
    openInterest: doublePrecision("open_interest").notNull(),
    oiChange: doublePrecision("oi_change").notNull(),
    ltp: doublePrecision("ltp").notNull(),
    iv: doublePrecision("iv"),
    volume: doublePrecision("volume").notNull(),
    source: text("source").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.tradeDate, table.underlying, table.expiry, table.strike, table.optionType] }),
    index("option_oi_underlying_idx").on(table.underlying, table.tradeDate),
  ],
);

export const affiliates = pgTable(
  "affiliates",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    commissionBps: integer("commission_bps").notNull(),
    status: text("status").notNull(),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("affiliates_code_idx").on(table.code)],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: text("id").primaryKey(),
    job: text("job").notNull(),
    status: text("status").notNull(),
    summary: jsonb("summary").$type<Record<string, unknown>>().notNull(),
    actorId: text("actor_id").notNull(),
    startedAt: text("started_at").notNull(),
    finishedAt: text("finished_at").notNull(),
  },
  (table) => [index("job_runs_job_idx").on(table.job, table.startedAt)],
);

export const integrationSecrets = pgTable("integration_secrets", {
  fieldKey: text("field_key").primaryKey(),
  iv: text("iv").notNull(),
  tag: text("tag").notNull(),
  data: text("data").notNull(),
  updatedBy: text("updated_by"),
  updatedAt: text("updated_at"),
});
