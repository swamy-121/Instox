# Instox

Mobile-first PWA for manually published Indian market tips. This repo is the first slice: sign-in, roles, the tip workflow, a free/premium feed, and the admin screens that go with them.

Market data stays behind a server provider. Leave `MARKET_DATA_PROVIDER` unset for the mock adapter. Alice Blue can supply Nifty 50, Bank Nifty, and Sensex after an admin connects each market day. That session is not a redistribution licence. Checkout does not turn on premium.

## Setup

Use Node 22.

```bash
cp .env.example .env.local
npm install
docker compose up -d
```

Put a long random string in `SESSION_SECRET`. `DATABASE_URL` in the example points at the Postgres container (`instox` / `instox` on port 5432). Leave payment keys, the APITxT key, and Firebase fields empty.

```bash
npm run db:migrate
npm run seed
npm run dev
```

Open http://localhost:3000/sign-in. With `NEXT_PUBLIC_DEMO_LOGIN=true`, the one-tap buttons sign in as the seeded accounts (free, premium, editor, publisher, support, admin, super admin, disabled). Phone sign-in sends a code through APITxT when `APITXT_AUTHKEY` is set in the environment or on the admin Integrations page. The product owner chose to send those texts without a DLT template, so the request does not include a template id, a PE id, or a sender. With no key, or when `SMS_PROVIDER=dev`, the code is written to the server log and no text is sent. The code is checked on this server and is not kept after sign-in.

Admin email sign-in uses the seeded admin account. A forgot-password link is printed in the server log outside production. Production email delivery is not wired yet.

Seeded premium tips stay locked for the free user. Sign in as Premium Member to see entry, stop, targets, and rationale.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests, including API authorization checks on an in-memory Postgres |
| `npm run db:migrate` | Apply `drizzle/0000_init.sql` |
| `npm run seed` | Idempotent users, tips, plans, quotes, news, help, shop, and watchlist rows |

CI runs lint, typecheck, unit tests, the migration against Postgres, and `npm run build`.

## Folder layout

```
src/app            routes, layouts, and /api/v1 handlers
src/components     shared UI
src/features       auth provider and the tip form
src/server         auth, roles, entitlements, tips, payments, market data, indicators
src/lib            validation, money, phone, API client
config             plans, sample instruments, indicator flags, disclosure version
drizzle            SQL migration
tests/unit         domain tests and API authorization tests
public/sw.js       service worker (static files and the offline page)
```

The browser does not talk to the database. Tips, roles, entitlements, payments, and audit rows are written by the API, and the route handlers check identity and roles.

## Platform slice

The screener, Pulse score, and 30-day insights read the sample candle set. Every screener and Pulse response says `Sample data` and `live: false`. Stale candles are skipped. ATR and SuperTrend stay off unless an admin saves the flag in ADM-07.

Insights use manual close reasons. Unresolved tips are not wins. Cancelled tips stay out of the win-rate denominator.

Referral codes can be stored and applied. `config/features.json` keeps rewards off, and a referral never grants premium while that flag is false.

Tip alerts use Firebase Cloud Messaging. The browser stores an FCM device token, and the server sends with the Admin SDK when those credentials exist. Alert text does not include entry, stop, targets, or rationale. With an empty web push certificate, the delivery status is `skipped_unconfigured`.

`PAYMENTS_PROVIDER` defaults to `stub`. Razorpay and Cashfree adapters exist for `PAYMENTS_MODE=test` only. Missing keys return 503 and do not create a remote order. A verified webhook still cannot grant premium while the plan in `config/plans.json` has `approved: false`. A super admin can save provider keys on Integrations. Those values are encrypted with `INTEGRATIONS_ENC_KEY` and override the environment when present. Remote checkout stays off.

Admin screens ADM-06 through ADM-11 cover instruments, screener flags, users, plans and manual entitlements, orders and reconciliation, and referrals.

## Research slice

The shop reads `config/shop.json`. Prices are placeholders. An order is held, nothing is charged, and premium is not granted. Fulfilment and refunds are not configured.

Charts draw sample daily candles with an EMA overlay and say they are not live.

Strategy drafts use RSI, EMA, or CPR rules. They version on edit and cannot publish a tip.

Backtests are labeled Hypothetical. Fees and slippage come from `config/backtest.json`. Losing trades stay in the result.

The sample instrument list is not an exchange master.

## Open decisions

These still block a real launch. The product owner approved starting this build anyway. The decisions themselves are not closed.

- DEC-001 Brand palette and logo. Resolved from the official wordmark. `in` is teal `#0194A8` and `Stox` is green `#027332`, on white. Primary buttons and the active tab use the logo green `#027332`. Interface text uses `#013316`. Profit `#0F7A45` and loss `#B42318` stay separate from the logo green so gain and loss stay readable.
- DEC-002 Plan price, tax, billing, cancellation, and refunds. Plan rows live in Postgres and stay `approved: false`. Manual grants are audited and do not approve the price.
- DEC-003 SEBI / legal operating model. Paid stock-specific tips should stay off until counsel writes that down. Penny-stock publish is disabled in config.
- DEC-004 Market-data vendor and redistribution rights. `MARKET_DATA_PROVIDER=aliceblue` streams Nifty 50, Bank Nifty, and Sensex after an admin uses Connect Alice Blue. The provider and Alice Blue app credentials can also be saved on Integrations. The daily login is the account's own broker session and does not grant redistribution rights, so `MARKET_DATA_LICENSED` stays false. Until that session is stored, those cards keep the last known values and show Delayed. Tests and CI leave the provider unset and keep the mock adapter. `MARKET_DATA_PROVIDER=dev` reads public chart quotes for the same three indices and is refused when `NODE_ENV` is production.
- DEC-005 Payment provider. Razorpay and Cashfree signature checks exist. No credentials are committed, and remote checkout is off. Keys can be entered on Integrations instead of the environment.
- DEC-006 Automatic outcome tracking. Close, cancel, and expire are manual. Insights read those reasons.
- DEC-007 Referral threshold and reward. The ledger exists. Entitlement grants from referrals stay off.
- DEC-008 Shop scope. The catalogue is a placeholder. Fulfilment, shipping, and refunds are not approved.
- DEC-009 Email/SMS notification channels. Phone sign-in uses APITxT when a key is saved, and the product owner chose to send without a DLT template. FCM consent and token storage are built. The web push certificate can be saved on Integrations. Admin credentials stay empty, so push is not sent.
- DEC-010 Named support and grievance contact. The about page says this is unassigned.

## Credentials still required

Leave these empty until a real account exists. Do not commit values.

These stay in the server environment because the app cannot boot or encrypt secrets without them:

- `DATABASE_URL`, the Postgres connection string.
- `SESSION_SECRET`, a random string of at least 16 characters. It signs session cookies and hashes phone codes.
- `INTEGRATIONS_ENC_KEY`, a random string of at least 16 characters. It encrypts secrets saved on Integrations.

Firebase is optional and is only used to send push:

- Firebase admin client email and private key, for FCM sends.
- Firebase web app api key, auth domain, project id, app id, and messaging sender id, when the browser should register for push.

- `PAYMENTS_MODE` stays `test`. Remote checkout stays off.
- `MARKET_DATA_LICENSED` stays false until redistribution rights are decided.

A super admin can enter these on Integrations. The same names still work as environment fallbacks when the saved field is empty:

- `APITXT_AUTHKEY`, the APITxT key for phone codes. Texts are sent without a DLT template. Leave it empty, or set `SMS_PROVIDER=dev`, and the code is written to the server log.
- Firebase web push certificate (`NEXT_PUBLIC_FIREBASE_VAPID_KEY`). This is the FCM key, not a separate VAPID private key.
- Razorpay key id, key secret, and webhook secret.
- Cashfree client id, client secret, and webhook secret.
- `PAYMENTS_PROVIDER` (`stub`, `razorpay`, or `cashfree`).
- `FCM_SEND_MODE` (`token` or `topic`).
- `MARKET_DATA_PROVIDER` (`aliceblue` or `dev`; leave unset for the mock feed).
- Alice Blue app code (`ALICEBLUE_APP_CODE`) and API secret (`ALICEBLUE_API_SECRET`) from the developer portal at https://a3.aliceblueonline.com/. Register the redirect URL `https://<your-host>/api/v1/admin/market/aliceblue/callback`. An admin presses Connect Alice Blue once each market day. The session token stays on the server. If it is missing, index cards show Delayed, the admin panel shows a red banner, and admins with an FCM token get one reminder after 9:00 AM IST on NSE market days.
