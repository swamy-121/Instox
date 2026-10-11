export function formatInr(priceMinor: number): string {
  const rupees = priceMinor / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(rupees);
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function isTickAligned(price: number, tickSize: number): boolean {
  const pricePaise = Math.round(price * 100);
  const tickPaise = Math.round(tickSize * 100);
  if (tickPaise <= 0) return false;
  return pricePaise % tickPaise === 0;
}
