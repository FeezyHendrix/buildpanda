const CURRENCY_LOCALE: Record<string, string> = {
  NGN: "en-NG",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  CAD: "en-CA",
};

/** An amount in the project's currency, matching the web's formatting. */
export function formatMoney(value: number, currency = "NGN"): string {
  try {
    return new Intl.NumberFormat(CURRENCY_LOCALE[currency] ?? "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}
