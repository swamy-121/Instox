"use client";

import { useEffect, useState } from "react";
import type { StreamQuote } from "@/features/market/live-quotes";

export function useLiveQuotes(feed: string | undefined): { quotes: Map<string, StreamQuote>; streamDown: boolean } {
  const enabled = feed === "aliceblue" || feed === "dev";
  const [quotes, setQuotes] = useState<Map<string, StreamQuote>>(new Map());
  const [streamDown, setStreamDown] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const source = new EventSource("/api/v1/market/stream");
    source.onmessage = (event) => {
      try {
        const body = JSON.parse(String(event.data)) as { quotes?: StreamQuote[] };
        setStreamDown(false);
        if (!body.quotes?.length) return;
        setQuotes((current) => {
          const next = new Map(current);
          for (const quote of body.quotes ?? []) {
            if (quote?.symbol) next.set(quote.symbol, quote);
          }
          return next;
        });
      } catch {
        setStreamDown(true);
      }
    };
    source.onerror = () => setStreamDown(true);
    return () => source.close();
  }, [enabled]);

  return { quotes, streamDown };
}
