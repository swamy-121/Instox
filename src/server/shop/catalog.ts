import { readFileSync } from "node:fs";
import path from "node:path";
import { AppError } from "@/lib/errors";

export type ShopProduct = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  currency: string;
  active: boolean;
  approved: boolean;
  fulfillment: "unconfigured";
};

type ShopFile = { note: string; products: ShopProduct[] };

let cached: ShopFile | null = null;

export function loadShop(): ShopFile {
  if (cached) return cached;
  const filePath = process.env.SHOP_CONFIG_PATH
    ? path.resolve(process.env.SHOP_CONFIG_PATH)
    : path.join(process.cwd(), "config", "shop.json");
  cached = JSON.parse(readFileSync(filePath, "utf8")) as ShopFile;
  return cached;
}

export function resetShopCache(): void {
  cached = null;
}

export type ShopOrderDecision = {
  product: ShopProduct;
  amountMinor: number;
  currency: string;
  status: "held_unapproved" | "held_unfulfilled";
  fulfillment: "unconfigured";
  grantsEntitlement: false;
  message: string;
};

/** A shop row never charges a card and never grants tip access. Unapproved prices stay held. */
export function decideShopOrder(productId: string, products = loadShop().products): ShopOrderDecision {
  const product = products.find((item) => item.id === productId);
  if (!product || !product.active) {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "That product is not available.");
  }
  if (product.fulfillment !== "unconfigured") {
    throw new AppError(422, "BUSINESS_RULE_FAILED", "Fulfilment for this product is not configured.");
  }
  return {
    product,
    amountMinor: product.priceMinor,
    currency: product.currency,
    status: product.approved ? "held_unfulfilled" : "held_unapproved",
    fulfillment: "unconfigured",
    grantsEntitlement: false,
    message: product.approved
      ? "Fulfilment is not configured. Nothing was charged and premium was not granted."
      : "This price is not approved and fulfilment is not configured. Nothing was charged and premium was not granted.",
  };
}
