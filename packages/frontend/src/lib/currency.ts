export type CurrencyCode = "NGN" | "USD" | "GBP" | "EUR" | "GHS" | "ZAR" | "KES";

export interface CurrencyOption {
  code: CurrencyCode;
  symbol: string;
  label: string;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  { code: "NGN", symbol: "₦", label: "Nigerian Naira" },
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "GBP", symbol: "£", label: "British Pound" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "GHS", symbol: "GH₵", label: "Ghanaian Cedi" },
  { code: "ZAR", symbol: "R", label: "South African Rand" },
  { code: "KES", symbol: "KSh", label: "Kenyan Shilling" },
];

export const CURRENCY_CODES = SUPPORTED_CURRENCIES.map((c) => c.code);

export function currencySymbol(code: string): string {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code)?.symbol ?? `${code} `;
}

export function currencyLabel(code: string): string {
  const found = SUPPORTED_CURRENCIES.find((c) => c.code === code);
  return found ? `${found.code} — ${found.label}` : code;
}
