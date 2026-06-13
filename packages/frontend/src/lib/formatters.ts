const CURRENCY_LOCALE: Record<string, string> = {
  NGN: "en-NG",
  USD: "en-US",
  EUR: "en-IE",
  GBP: "en-GB",
  CAD: "en-CA",
};

export type TimeOfDay = "Morning" | "Afternoon" | "Evening";

export function formatWholeCurrency(value: number, currency: string): string {
  return formatCurrency(value, currency, { whole: true });
}

export function formatCurrency(
  value: number,
  currency: string,
  opts: { compact?: boolean; signed?: boolean; whole?: boolean } = {},
): string {
  const { compact = false, signed = false, whole = false } = opts;
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";
  const noDecimals = compact || whole;
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      notation: compact ? "compact" : "standard",
      minimumFractionDigits: noDecimals ? 0 : 2,
      maximumFractionDigits: compact ? 1 : noDecimals ? 0 : 2,
      signDisplay: signed ? "exceptZero" : "auto",
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

export function currencySymbol(currency: string): string {
  const locale = CURRENCY_LOCALE[currency] ?? "en-US";
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    return parts.find((p) => p.type === "currency")?.value ?? currency;
  } catch {
    return currency;
  }
}

export function timeOfDay(date = new Date()): TimeOfDay {
  const h = date.getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

export function firstName(fullName: string, fallback = "there"): string {
  const trimmed = fullName.trim();
  if (!trimmed) return fallback;
  return trimmed.split(/\s+/)[0] ?? fallback;
}

export function formatTimeAgo(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const diffMs = Math.max(0, now.getTime() - then.getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  return then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const DATE_LOCALE = "en-GB";

type DateInput = Date | string | null | undefined;

function toValidDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatShortDate(value: DateInput): string {
  const d = toValidDate(value);
  return d ? d.toLocaleDateString(DATE_LOCALE, { day: "2-digit", month: "short", year: "numeric" }) : "";
}

export function formatLongDate(value: DateInput): string {
  const d = toValidDate(value);
  return d ? d.toLocaleDateString(DATE_LOCALE, { day: "numeric", month: "long", year: "numeric" }) : "";
}

export function formatDayMonth(value: DateInput): string {
  const d = toValidDate(value);
  return d ? d.toLocaleDateString(DATE_LOCALE, { day: "2-digit", month: "short" }) : "";
}

export function formatActivityTimestamp(value: DateInput): string {
  const d = toValidDate(value);
  return d
    ? d.toLocaleDateString(DATE_LOCALE, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
}

export function pct(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}
