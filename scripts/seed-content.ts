import shop from "../config/shop.json";
import plans from "../config/plans.json";
import { MEMBER_COPY_DEFAULTS } from "../src/lib/member-copy";
import { mergeContent, saveContent } from "../src/server/content/store";
import { getDb } from "../src/server/db/client";
import { watchlistItems } from "../src/server/db/schema";
import { writeSetting } from "../src/server/db/settings";
import { sampleCandleEnd, sampleCandles } from "../src/server/market-data/candles";
import { sampleInstruments } from "../src/server/market-data/instruments";

const NOW = "2026-10-11T10:00:00.000Z";

function seriesAround(symbol: string, last: number, count = 30) {
  const end = Date.parse(NOW);
  const candles = [];
  let price = last * 0.97;
  for (let index = count - 1; index >= 0; index -= 1) {
    const wave = Math.sin(index / 3) * last * 0.004;
    const open = Math.round(price * 100) / 100;
    const close = Math.round((price + wave) * 100) / 100;
    const high = Math.max(open, close) + last * 0.001;
    const low = Math.min(open, close) - last * 0.001;
    const closeTime = new Date(end - index * 24 * 60 * 60 * 1000).toISOString();
    const openTime = new Date(Date.parse(closeTime) - 24 * 60 * 60 * 1000).toISOString();
    candles.push({
      open,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close,
      openTime,
      closeTime,
      sourceTimestamp: closeTime,
      freshnessStatus: "sample",
    });
    price = close;
  }
  return { id: symbol, symbol, candles };
}

/** Overwrites starter documents by id so a second run does not duplicate them. */
export async function seedCatalog(): Promise<void> {
  const indices = [
    { id: "NIFTY", symbol: "NIFTY", name: "Nifty 50", last: 24635.5, changePct: 0.82, kind: "index" as const, sort: 1 },
    { id: "SENSEX", symbol: "SENSEX", name: "Sensex", last: 80421.1, changePct: 0.62, kind: "index" as const, sort: 2 },
    { id: "BANKNIFTY", symbol: "BANKNIFTY", name: "Nifty Bank", last: 52340, changePct: -0.19, kind: "index" as const, sort: 3 },
    { id: "NIFTYFIN", symbol: "NIFTYFIN", name: "Nifty Financial Services", last: 23450, changePct: 0.35, kind: "index" as const, sort: 4 },
    { id: "RELIANCE", symbol: "RELIANCE", name: "Reliance Industries", last: 2864.5, changePct: 2.35, kind: "stock" as const, sort: 10 },
    { id: "TCS", symbol: "TCS", name: "Tata Consultancy Services", last: 3982.1, changePct: -1.2, kind: "stock" as const, sort: 11 },
    { id: "HDFCBANK", symbol: "HDFCBANK", name: "HDFC Bank", last: 1702.3, changePct: 0.85, kind: "stock" as const, sort: 12 },
    { id: "INFY", symbol: "INFY", name: "Infosys", last: 1468.9, changePct: 1.15, kind: "stock" as const, sort: 13 },
    { id: "SBIN", symbol: "SBIN", name: "State Bank of India", last: 812.4, changePct: -0.65, kind: "stock" as const, sort: 14 },
    { id: "ITC", symbol: "ITC", name: "ITC", last: 468.2, changePct: 0.42, kind: "stock" as const, sort: 15 },
  ];
  for (const row of indices) await saveContent("indices", row);

  const news = [
    { id: "news_rbi", title: "RBI keeps the policy rate unchanged", summary: "The reserve bank left the policy rate unchanged and said inflation is still the guide for the next meeting.", source: "Sample wire", category: "Economy", publishedAt: "2026-10-11T04:30:00.000Z", status: "published" as const, sort: 1 },
    { id: "news_results", title: "Infosys posts a steady second quarter", summary: "The company reported revenue in line with its own range. This starter item is not a live report.", source: "Sample wire", category: "Results", publishedAt: "2026-10-10T12:00:00.000Z", status: "published" as const, sort: 2 },
    { id: "news_fed", title: "Global markets open higher after the Fed note", summary: "Index futures were higher in early trade. Figures in this feed are stored sample copy.", source: "Sample wire", category: "Global", publishedAt: "2026-10-10T06:00:00.000Z", status: "published" as const, sort: 3 },
    { id: "news_oil", title: "Oil prices ease as supply concerns cool", summary: "Crude slipped in the sample tape. It is not a quote you can trade from.", source: "Sample wire", category: "Commodities", publishedAt: "2026-10-09T09:00:00.000Z", status: "published" as const, sort: 4 },
    { id: "news_draft", title: "Metals tape note still in draft", summary: "This row stays unpublished until an editor marks it published.", source: "Desk", category: "Commodities", publishedAt: "2026-10-11T11:00:00.000Z", status: "draft" as const, sort: 5 },
  ];
  for (const row of news) await saveContent("newsArticles", row);

  const ads = [
    { id: "ad_home", title: "Premium ideas", body: "A home placement. It does not change who can read a tip.", placement: "home", status: "published" as const, sort: 1 },
    { id: "ad_tips", title: "Screener tools", body: "A tips placement that is still a draft.", placement: "tips", status: "draft" as const, sort: 2 },
  ];
  for (const row of ads) await saveContent("advertisements", row);

  const help = [
    { id: "help_tips", question: "What is a tip?", answer: "A tip is a manually written idea with an entry, a stop, and targets. Instox does not place the trade.", status: "published" as const, sort: 1 },
    { id: "help_premium", question: "When do premium levels show?", answer: "Premium entry, stop, targets, and the write-up stay on the server until the account has an active plan.", status: "published" as const, sort: 2 },
    { id: "help_payments", question: "Does checkout charge my card?", answer: "No. Plan prices are not approved, and remote checkout is off. A payment order is recorded as a placeholder.", status: "published" as const, sort: 3 },
    { id: "help_contact", question: "Who handles a grievance?", answer: "A named grievance contact is not assigned yet. The support record in admin is the place to set one.", status: "published" as const, sort: 4 },
  ];
  for (const row of help) await saveContent("helpArticles", row);

  const slides = [
    { id: "slide_ideas", title: "Real Time Trading Ideas", body: "Get curated stock ideas, market analysis and expert insights.", icon: "chart" as const, sort: 1 },
    { id: "slide_screens", title: "Screeners & Market Tools", body: "Find the best opportunities with powerful screeners and analytics.", icon: "search" as const, sort: 2 },
    { id: "slide_news", title: "Stay Ahead with News", body: "Get the latest market news and updates.", icon: "news" as const, sort: 3 },
  ];
  for (const row of slides) await saveContent("onboardingSlides", row);

  const products = [
    ...shop.products.map((product, index) => ({ ...product, sort: index + 1 })),
    { id: "trading_course", name: "Trading Course", description: "A starter course listing. It does not ship and it does not unlock premium tips.", priceMinor: 499900, currency: "INR", active: true, approved: false, fulfillment: "unconfigured" as const, sort: 10 },
    { id: "strategy_course", name: "Strategy Course", description: "A strategy course listing. Fulfilment and refunds are not approved.", priceMinor: 299900, currency: "INR", active: true, approved: false, fulfillment: "unconfigured" as const, sort: 11 },
    { id: "indicators_pack", name: "Indicators Pack", description: "A digital pack listing. Nothing is delivered until fulfilment is configured.", priceMinor: 149900, currency: "INR", active: true, approved: false, fulfillment: "unconfigured" as const, sort: 12 },
  ];
  for (const row of products) await saveContent("shopProducts", row);

  const methods = [
    { id: "upi", name: "UPI", detail: "Pay by UPI. Remote checkout is off.", active: true, sort: 1 },
    { id: "razorpay", name: "Razorpay", detail: "Cards, UPI, and netbanking through Razorpay when keys exist.", active: true, sort: 2 },
    { id: "cashfree", name: "Cashfree", detail: "Cashfree stays in test mode until credentials are set.", active: true, sort: 3 },
  ];
  for (const row of methods) await saveContent("paymentMethods", row);

  const docs = [
    { id: "splash", title: "Smart Trading Ideas for a Smarter You", body: "Instant Trading Ideas", kind: "splash" as const },
    { id: "plans", title: "unapproved-placeholder", body: plans.note, kind: "note" as const },
    { id: "shop", title: "Shop", body: shop.note, kind: "note" as const },
    { id: "support", title: "Help and support", body: "A named grievance contact is not assigned. Update this record when one is.", kind: "support" as const },
  ];
  for (const row of docs) await saveContent("contentDocs", row);

  const extraPlans = [
    { id: "basic_monthly", name: "Basic", description: "Free tips plus the screener. Price, tax, and renewal are not approved.", priceMinor: 9900, currency: "INR", billingPeriod: "monthly", features: ["Free tips", "Screener", "News"], active: true, approved: false, effectiveFrom: "2026-10-11T00:00:00.000Z", taxTreatment: "unapproved", placeholder: true, accessDays: 30, listed: true, mostPopular: false },
    { id: "basic_yearly", name: "Basic", description: "Basic for a year. Price, tax, and renewal are not approved.", priceMinor: 99900, currency: "INR", billingPeriod: "yearly", features: ["Free tips", "Screener", "News"], active: true, approved: false, effectiveFrom: "2026-10-11T00:00:00.000Z", taxTreatment: "unapproved", placeholder: true, accessDays: 365, listed: true, mostPopular: false },
    { id: "pro_monthly", name: "Pro", description: "Premium ideas while the plan is active. The price is not approved.", priceMinor: 29900, currency: "INR", billingPeriod: "monthly", features: ["Everything in Basic", "Premium tips", "Options and F&O ideas"], active: true, approved: false, effectiveFrom: "2026-10-11T00:00:00.000Z", taxTreatment: "unapproved", placeholder: true, accessDays: 30, listed: true, mostPopular: true },
    { id: "pro_yearly", name: "Pro", description: "Pro for a year. The price is not approved.", priceMinor: 299900, currency: "INR", billingPeriod: "yearly", features: ["Everything in Basic", "Premium tips", "Options and F&O ideas"], active: true, approved: false, effectiveFrom: "2026-10-11T00:00:00.000Z", taxTreatment: "unapproved", placeholder: true, accessDays: 365, listed: true, mostPopular: true },
  ];
  for (const row of extraPlans) await saveContent("plans", row);
  await mergeContent("plans", "premium_monthly", { listed: false });
  await mergeContent("plans", "free", { listed: false });

  const end = sampleCandleEnd(new Date(NOW));
  for (const instrument of sampleInstruments()) {
    const candles = sampleCandles(instrument.symbol, 40, end);
    await saveContent("candleSeries", { id: instrument.symbol, symbol: instrument.symbol, candles });
  }
  for (const symbol of ["NIFTY", "SENSEX", "BANKNIFTY", "NIFTYFIN"] as const) {
    const last = indices.find((row) => row.symbol === symbol)?.last ?? 100;
    await saveContent("candleSeries", seriesAround(symbol, last));
  }

  const db = getDb();
  for (const symbol of ["RELIANCE", "TCS", "INFY"]) {
    await db.insert(watchlistItems).values({
      id: `seed_free_${symbol}`,
      userId: "seed_free",
      symbol,
      createdAt: NOW,
    }).onConflictDoNothing();
  }

  const tiles = [
    { id: "tile_tips", href: "/tips", label: "Tips", icon: "tips" as const, status: "published" as const, sort: 1 },
    { id: "tile_screener", href: "/screener", label: "Screener", icon: "screener" as const, status: "published" as const, sort: 2 },
    { id: "tile_news", href: "/news", label: "News", icon: "news" as const, status: "published" as const, sort: 3 },
    { id: "tile_shop", href: "/shop", label: "Shop", icon: "shop" as const, status: "published" as const, sort: 4 },
  ];
  for (const row of tiles) await saveContent("homeTiles", row);

  const more = [
    { id: "more_profile", href: "/profile", label: "My profile", status: "published" as const, sort: 1 },
    { id: "more_watchlist", href: "/watchlist", label: "Watchlist", status: "published" as const, sort: 2 },
    { id: "more_market", href: "/market", label: "Market overview", status: "published" as const, sort: 3 },
    { id: "more_insights", href: "/insights", label: "Insights history", status: "published" as const, sort: 4 },
    { id: "more_shop", href: "/shop", label: "Shop", status: "published" as const, sort: 5 },
    { id: "more_premium", href: "/premium", label: "Go Premium", status: "published" as const, sort: 6 },
    { id: "more_settings", href: "/settings", label: "Settings", status: "published" as const, sort: 7 },
    { id: "more_help", href: "/help", label: "Help and support", status: "published" as const, sort: 8 },
    { id: "more_pricing", href: "/pricing", label: "Plans", status: "published" as const, sort: 9 },
    { id: "more_saved", href: "/tips/saved", label: "Saved ideas", status: "published" as const, sort: 10 },
    { id: "more_recommended", href: "/tips/recommended", label: "Ideas for you", status: "published" as const, sort: 11 },
    { id: "more_tracked", href: "/tips/tracked", label: "Tracked ideas", status: "published" as const, sort: 12 },
    { id: "more_alerts", href: "/tips/alerts", label: "Tip alerts", status: "published" as const, sort: 13 },
    { id: "more_check", href: "/tip-check", label: "Check a stock", status: "published" as const, sort: 14 },
    { id: "more_pulse", href: "/pulse", label: "Pulse", status: "published" as const, sort: 15 },
    { id: "more_levels", href: "/levels", label: "Support and resistance", status: "published" as const, sort: 16 },
    { id: "more_options", href: "/options", label: "Option chain notes", status: "published" as const, sort: 17 },
    { id: "more_backtest", href: "/backtest", label: "Practice backtest", status: "published" as const, sort: 18 },
  ];
  for (const row of more) await saveContent("moreLinks", row);

  const watchDefaults = [
    { id: "default_RELIANCE", symbol: "RELIANCE", status: "published" as const, sort: 1 },
    { id: "default_TCS", symbol: "TCS", status: "published" as const, sort: 2 },
    { id: "default_INFY", symbol: "INFY", status: "published" as const, sort: 3 },
  ];
  for (const row of watchDefaults) await saveContent("watchlistDefaults", row);

  const templates = [
    { id: "tpl_open", name: "Market open", title: "Market open", body: "The session is open. This template is not sent on its own.", kind: "reminder" as const, status: "published" as const, sort: 1 },
    { id: "tpl_tip", name: "New tip", title: "New idea", body: "A new tip is published. Open the app to read it.", kind: "tip" as const, status: "draft" as const, sort: 2 },
  ];
  for (const row of templates) await saveContent("notificationTemplates", row);

  await writeSetting("public", {
    key: "public",
    value: { product: "instox", sampleData: true, ...MEMBER_COPY_DEFAULTS },
  }, "seed");
}
