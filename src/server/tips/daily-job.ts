import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { tips } from "@/server/db/schema";
import { knownSampleLast, getMarketDataProvider } from "@/server/market-data/adapter";
import { storedBarsFor } from "@/server/research/sources";
import {
  barsForEvaluation,
  evaluateTipSeries,
  istDay,
  resultNote,
  wantsResultAlert,
  type EvalDecision,
  type EvalTip,
} from "@/server/tips/evaluate";
import { notifyTracked } from "@/server/tips/library";
import { transitionTip } from "@/server/tips/repo";
import type { TipRecord } from "@/types/domain";

export type DailyJobResult = {
  checked: number;
  updated: number;
  held: number;
  missingPrice: number;
  alerts: number;
  failures: number;
  rows: Array<{ id: string; symbol: string; action: EvalDecision["action"]; closeReason: EvalDecision["closeReason"]; source: string }>;
};

export async function runDailyTipJob(input: { actorUid: string; requestId: string; now?: Date }): Promise<DailyJobResult> {
  const now = input.now ?? new Date();
  const today = istDay(now);
  const open = await getDb().select().from(tips).where(eq(tips.status, "published")).limit(500);
  const symbols = [...new Set(open.map((row) => row.symbol))];
  const provider = getMarketDataProvider();
  const quotes = symbols.length === 0 ? [] : await provider.getQuotes(symbols);
  const lastBySymbol = new Map(quotes.map((quote) => [quote.symbol, quote.last]));
  const stored = await storedBarsFor(symbols);

  const summary: DailyJobResult = {
    checked: open.length,
    updated: 0,
    held: 0,
    missingPrice: 0,
    alerts: 0,
    failures: 0,
    rows: [],
  };

  for (const row of open) {
    const tip = asEvalTip(row);
    const sampleLast = lastBySymbol.get(row.symbol) ?? knownSampleLast(row.symbol);
    const chosen = barsForEvaluation({
      entry: row.entryMin,
      stored: stored[row.symbol] ?? [],
      last: sampleLast,
      today,
    });
    if (chosen.source === "none") {
      summary.missingPrice += 1;
      continue;
    }
    const decision = evaluateTipSeries(tip, chosen.bars, today);
    if (decision.action === "hold") {
      summary.held += 1;
      continue;
    }
    try {
      await transitionTip({
        tipId: row.id,
        action: decision.action === "expire" ? "expire" : "close",
        reason: decision.reason,
        closeReason: decision.action === "close" ? decision.closeReason : null,
        expectedVersion: row.version,
        actorUid: input.actorUid,
        requestId: input.requestId,
      });
      summary.updated += 1;
      summary.rows.push({
        id: row.id,
        symbol: row.symbol,
        action: decision.action,
        closeReason: decision.closeReason,
        source: chosen.source,
      });
      const note = resultNote(row.symbol, decision);
      if (note) {
        summary.alerts += await notifyTracked({
          tipId: row.id,
          kind: decision.action === "expire" ? "expired" : decision.closeReason ?? "closed",
          title: note.title,
          body: note.body,
          prefsMatch: (prefs) => wantsResultAlert(prefs, decision),
        });
      }
    } catch {
      summary.failures += 1;
    }
  }

  return summary;
}

function asEvalTip(row: typeof tips.$inferSelect): EvalTip & Pick<TipRecord, "id"> {
  return {
    id: row.id,
    side: row.side === "SELL" ? "SELL" : "BUY",
    stopLoss: row.stopLoss,
    targets: (row.targets ?? []) as EvalTip["targets"],
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
    status: row.status,
  };
}
