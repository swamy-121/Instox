import { z } from "zod";

const id = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);

const candle = z.object({
  open: z.number(),
  high: z.number(),
  low: z.number(),
  close: z.number(),
  openTime: z.string(),
  closeTime: z.string(),
  sourceTimestamp: z.string(),
  freshnessStatus: z.string(),
});

export const contentSchemas = {
  indices: z.object({
    id,
    symbol: z.string().min(1).max(32),
    name: z.string().min(1).max(80),
    last: z.number(),
    changePct: z.number(),
    kind: z.enum(["index", "stock"]),
    sort: z.number().int(),
  }),
  newsArticles: z.object({
    id,
    title: z.string().min(1).max(160),
    summary: z.string().min(1).max(800),
    source: z.string().min(1).max(80),
    category: z.string().min(1).max(40),
    publishedAt: z.string().min(10).max(40),
    status: z.enum(["published", "draft"]),
    sort: z.number().int(),
  }),
  helpArticles: z.object({
    id,
    question: z.string().min(1).max(200),
    answer: z.string().min(1).max(2000),
    status: z.enum(["published", "draft"]),
    sort: z.number().int(),
  }),
  onboardingSlides: z.object({
    id,
    title: z.string().min(1).max(80),
    body: z.string().min(1).max(400),
    icon: z.enum(["chart", "search", "news"]),
    sort: z.number().int(),
  }),
  shopProducts: z.object({
    id,
    name: z.string().min(1).max(80),
    description: z.string().min(1).max(400),
    priceMinor: z.number().int().nonnegative(),
    currency: z.string().min(3).max(8),
    active: z.boolean(),
    approved: z.boolean(),
    fulfillment: z.literal("unconfigured"),
    sort: z.number().int(),
  }),
  contentDocs: z.object({
    id,
    title: z.string().min(1).max(120),
    body: z.string().min(1).max(800),
    kind: z.enum(["splash", "support", "note"]),
  }),
  paymentMethods: z.object({
    id,
    name: z.string().min(1).max(40),
    detail: z.string().min(1).max(120),
    active: z.boolean(),
    sort: z.number().int(),
  }),
  plans: z.object({
    id,
    name: z.string().min(1).max(80),
    description: z.string().min(1).max(400),
    priceMinor: z.number().int().nonnegative(),
    currency: z.string().min(3).max(8),
    billingPeriod: z.string().min(1).max(20),
    features: z.array(z.string().min(1).max(80)).max(12),
    active: z.boolean(),
    approved: z.boolean(),
    effectiveFrom: z.string().min(10).max(40),
    taxTreatment: z.string().min(1).max(40),
    placeholder: z.boolean(),
    accessDays: z.number().int().positive().optional(),
    listed: z.boolean().optional(),
    mostPopular: z.boolean().optional(),
  }),
  candleSeries: z.object({
    id,
    symbol: z.string().min(1).max(32),
    candles: z.array(candle).max(120),
  }),
} as const;

export type ContentName = keyof typeof contentSchemas;
export type ContentRecord<T extends ContentName = ContentName> = z.infer<(typeof contentSchemas)[T]>;

export const PUBLIC_CONTENT: ContentName[] = [
  "indices",
  "newsArticles",
  "helpArticles",
  "onboardingSlides",
  "shopProducts",
  "contentDocs",
  "paymentMethods",
  "plans",
];

export function isContentName(value: string): value is ContentName {
  return value in contentSchemas;
}

export function parseContent<T extends ContentName>(name: T, input: unknown): ContentRecord<T> {
  return contentSchemas[name].parse(input) as ContentRecord<T>;
}

/** Returns null when a stored document does not match the collection. One bad row must not blank the feed. */
export function tryParseContent<T extends ContentName>(name: T, input: unknown): ContentRecord<T> | null {
  const result = contentSchemas[name].safeParse(input);
  return result.success ? (result.data as ContentRecord<T>) : null;
}

export function publicRecord<T extends ContentName>(name: T, record: ContentRecord<T>): ContentRecord<T> | null {
  if (name === "newsArticles" || name === "helpArticles") {
    return (record as { status?: string }).status === "published" ? record : null;
  }
  if (name === "shopProducts" || name === "paymentMethods" || name === "plans") {
    return (record as { active?: boolean }).active === false ? null : record;
  }
  if (name === "candleSeries") return null;
  return record;
}
