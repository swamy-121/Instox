export type Recommendable = {
  id: string;
  symbol: string;
  featured?: boolean;
  publishedAt: string | null;
};

/** Featured ideas first, then symbols the member already saved, then newer publish dates. */
export function rankRecommended<T extends Recommendable>(tips: T[], savedSymbols: readonly string[], limit = 6): T[] {
  const saved = new Set(savedSymbols);
  return [...tips]
    .sort((a, b) => {
      const featured = Number(b.featured === true) - Number(a.featured === true);
      if (featured !== 0) return featured;
      const familiar = Number(saved.has(b.symbol)) - Number(saved.has(a.symbol));
      if (familiar !== 0) return familiar;
      return (b.publishedAt ?? "").localeCompare(a.publishedAt ?? "");
    })
    .slice(0, Math.max(0, limit));
}
