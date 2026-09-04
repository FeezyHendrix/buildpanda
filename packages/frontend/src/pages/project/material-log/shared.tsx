import type { ComponentType } from "react";
import type { BadgeTone } from "@/components/atoms/badge";
import type {
  LedgerEntry,
  LedgerEntryType,
  StockLevel,
} from "@/lib/project-types";
import {
  AlertTriangleIcon,
  ArrowIntoSiteIcon,
  ArrowOutOfSiteIcon,
  ClipboardCheckIcon,
  ReversalIcon,
} from "./icons";

type IconComponent = ComponentType<{ className?: string }>;

export function formatQty(value: number): string {
  return Number.isInteger(value)
    ? value.toLocaleString()
    : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

// Units are free text typed on site — "bags", "lengths", "m3". Crews usually
// type them already plural, so inflecting them produces "bagses". Show what was
// entered; only fix the two that have a real typographic form.
export function displayUnit(unit: string): string {
  const u = (unit || "unit").trim();
  if (/^m3$/i.test(u)) return "m³";
  if (/^m2$/i.test(u)) return "m²";
  return u;
}

export function formatMeasure(quantity: number, unit: string): string {
  return `${formatQty(quantity)} ${displayUnit(unit)}`;
}

/**
 * Ledger entry types mapped to semantic design-system tokens.
 *
 * Colour is never the only carrier: each type also has a distinct icon shape
 * and a short text label, so the ledger stays readable for the ~8% of men with
 * red-green colour blindness (WCAG 1.4.1).
 */
export const ENTRY_TYPE_META: Record<
  LedgerEntryType,
  { label: string; tone: BadgeTone; Icon: IconComponent; verb: string }
> = {
  IN: {
    label: "In",
    tone: "success",
    Icon: ArrowIntoSiteIcon,
    verb: "Received",
  },
  USED: {
    label: "Used",
    tone: "warning",
    Icon: ArrowOutOfSiteIcon,
    verb: "Used",
  },
  VOID: {
    label: "Void",
    tone: "neutral",
    Icon: ReversalIcon,
    verb: "Reversal",
  },
};

export type LedgerFilter = "all" | "IN" | "USED" | "voided" | "flagged";

export const LEDGER_FILTERS: { value: LedgerFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "IN", label: "Received" },
  { value: "USED", label: "Used" },
  { value: "voided", label: "Voided" },
  { value: "flagged", label: "Flagged" },
];

export function isFlagged(entry: LedgerEntry): boolean {
  return entry.negativeStock || entry.timestampSuspect;
}

/**
 * The ledger is an append-only audit trail, so filtering only ever narrows the
 * view — a voided entry is still part of the record and stays visible under
 * "All" and under its own entry type.
 */
export function matchesLedgerFilter(
  entry: LedgerEntry,
  filter: LedgerFilter,
): boolean {
  switch (filter) {
    case "all":
      return true;
    case "IN":
    case "USED":
      return entry.entryType === filter;
    case "voided":
      return entry.status === "Voided" || entry.entryType === "VOID";
    case "flagged":
      return isFlagged(entry);
  }
}

/**
 * A stock line only earns a badge when something is wrong. Healthy materials
 * stay quiet so the exceptions are the thing your eye lands on.
 */
export function stockAlert(
  stock: StockLevel,
): { label: string; tone: BadgeTone; Icon: IconComponent } | null {
  if (stock.onHandQty < 0) {
    return {
      label: "Negative stock",
      tone: "danger",
      Icon: AlertTriangleIcon,
    };
  }
  if (stock.lowStock) {
    return {
      label: "Below reorder level",
      tone: "warning",
      Icon: ClipboardCheckIcon,
    };
  }
  return null;
}

/** Exceptions first, then alphabetical — the order a PM reads the grid in. */
export function sortStockByUrgency(stock: StockLevel[]): StockLevel[] {
  const rank = (s: StockLevel): number => {
    if (s.onHandQty < 0) return 0;
    if (s.lowStock) return 1;
    return 2;
  };
  // Copy first — `stock` is the React Query cache array and must not be mutated.
  return [...stock].sort(
    (a, b) => rank(a) - rank(b) || a.materialName.localeCompare(b.materialName),
  );
}
