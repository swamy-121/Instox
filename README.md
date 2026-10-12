# Instox

Mobile-first PWA for manually published Indian market tips. This repo is the first slice: sign-in, roles, the tip workflow, a free/premium feed, and the admin screens that go with them.

Market data stays behind a server provider. Leave `MARKET_DATA_PROVIDER` unset for the mock adapter. Alice Blue can supply last prices when the broker env vars are set, and that session is not a redistribution licence. Checkout does not turn on premium.

## Setup

Use Node 22.

```bash
cp .env.example .env.local
npm install
```

Leave the secret fields empty. Local auth uses the Firebase emulator. The web config can stay blank when `NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true`. The client falls back to the `demo-instox` project id.

## Emulator

Terminal 1:

```bash
npm run emulators
```

That starts Auth on 127.0.0.1:9099, Firestore on 127.0.0.1:8080, and the emulator UI on 127.0.0.1:4000.

Terminal 2:

```bash
npm run seed
npm run dev
```

`npm run seed` reads `.env.local` when those emulator variables are not already exported. With both emulator hosts set, it writes to the emulator. With neither host set, it uses `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` for `FIREBASE_PROJECT_ID`. A second run overwrites the same document ids.

Open http://localhost:3000/sign-in. The emulator user buttons sign in as the seeded accounts (free, premium, editor, publisher, support, admin, super admin, disabled). Phone OTP and Google also run against the Auth emulator. The emulator prints the SMS code. It does not send a real text.

Seeded premium tips stay locked for the free user. Sign in as Premium Member to see entry, stop, targets, and rationale.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (lifecycle, entitlements, tip redaction) |
| `npm run test:rules` | Firestore rules tests. Needs the Firestore emulator. |
| `npm run seed` | Idempotent users, tips, plans, quotes, news, help, shop, and watchlist rows. Works on the emulator and on a project with Admin credentials. |
| `npm run emulators` | Auth and Firestore emulators |

CI runs lint, typecheck, unit tests, rules tests under `firebase emulators:exec`, and `npm run build`.

## Folder layout

```
src/app            routes, layouts, and /api/v1 handlers
src/components     shared UI
src/features       auth provider and the tip form
src/server         auth, roles, entitlements, tips, payments, market data, indicators
src/lib            validation, money, phone, API client
config             plans, sample instruments, indicator flags, disclosure version
tests/unit         domain tests
tests/rules        Firestore security rules
public/sw.js       service worker (static files and the offline page)
```

Firestore client access is narrow. Tips, roles, entitlements, payments, and audit rows are written by the server. The Admin SDK bypasses security rules, so the route handlers check identity and roles themselves.

## Platform slice

The screener, Pulse score, and 30-day insights read the sample candle set. Every screener and Pulse response says `Sample data` and `live: false`. Stale candles are skipped. ATR and SuperTrend stay off unless an admin saves the flag in ADM-07.

Insights use manual close reasons. Unresolved tips are not wins. Cancelled tips stay out of the win-rate denominator.

Referral codes can be stored and applied. `config/features.json` keeps rewards off, and a referral never grants premium while that flag is false.

Tip alerts use Firebase Cloud Messaging. The browser stores an FCM device token, and the server sends with the Admin SDK. Alert text does not include entry, stop, targets, or rationale. With an empty web push certificate, or on the emulator, the delivery status is `skipped_unconfigured`.

`PAYMENTS_PROVIDER` defaults to `stub`. Razorpay and Cashfree adapters exist for `PAYMENTS_MODE=test` only. Missing keys return 503 and do not create a remote order. A verified webhook still cannot grant premium while the plan in `config/plans.json` has `approved: false`.

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
- DEC-002 Plan price, tax, billing, cancellation, and refunds. Plan rows live in Firestore and stay `approved: false`. Manual grants are audited and do not approve the price.
- DEC-003 SEBI / legal operating model. Paid stock-specific tips should stay off until counsel writes that down. Penny-stock publish is disabled in config.
- DEC-004 Market-data vendor and redistribution rights. `MARKET_DATA_PROVIDER=aliceblue` starts a server-side ANT session feed for NSE and BSE symbols. That login is the account's own broker session and does not grant redistribution rights, so `MARKET_DATA_LICENSED` stays false. Tests and CI leave the provider unset and keep the mock adapter. `MARKET_DATA_PROVIDER=dev` reads public chart quotes and is refused when `NODE_ENV` is production.
- DEC-005 Payment provider. Razorpay and Cashfree signature checks exist. No credentials are committed, and remote checkout is off.
- DEC-006 Automatic outcome tracking. Close, cancel, and expire are manual. Insights read those reasons.
- DEC-007 Referral threshold and reward. The ledger exists. Entitlement grants from referrals stay off.
- DEC-008 Shop scope. The catalogue is a placeholder. Fulfilment, shipping, and refunds are not approved.
- DEC-009 Email/SMS notification channels. FCM consent and token storage are built. The web push certificate and Admin credentials are empty, so nothing is sent.
- DEC-010 Named support and grievance contact. The about page says this is unassigned.

## Credentials still required

Leave these empty until a real account exists. Do not commit values.

- Firebase admin client email and private key, for a non-emulator deploy and for FCM sends.
- Firebase web app api key, auth domain, project id, and app id, when you leave the emulator.
- Firebase Cloud Messaging sender id (`NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`).
- Firebase web push certificate (`NEXT_PUBLIC_FIREBASE_VAPID_KEY`). This is the FCM key, not a separate VAPID private key.
- Razorpay key id, key secret, and webhook secret.
- Cashfree client id, client secret, and webhook secret.
- `MARKET_DATA_PROVIDER` (`aliceblue` or `dev`; leave unset for the mock feed).
- Alice Blue user id (`ALICEBLUE_USER_ID`) and API key (`ALICEBLUE_API_KEY`). There is no separate app secret. Optional `ALICEBLUE_SESSION_ID` skips the API-key login when a session already exists. Log in through the ANT website or app once that day before the session call can succeed. Broker credentials stay on the server and are not written to Firestore or sent to the browser.
- `MARKET_DATA_LICENSED` stays false until redistribution rights are decided.
