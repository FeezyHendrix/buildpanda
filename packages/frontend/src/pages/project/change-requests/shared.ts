import type { ChangeRequest, ChangeStatus } from "@/lib/project-types";
import { CHANGE_TYPE_FILTERS, type ChangeTypeFilter } from "./time-claim-position";

export type StatusFilter = ChangeStatus | "all";

/** Every status stays offered: the register holds drafts and executed changes too. */
export const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Approved", label: "Approved" },
  { value: "Executed", label: "Executed" },
  { value: "Rejected", label: "Rejected" },
];

export const TYPE_OPTIONS = CHANGE_TYPE_FILTERS.map((f) => ({ value: f.value, label: f.label }));
export const CURRENCY_OPTIONS = [
  { value: "NGN", label: "NGN" },
  { value: "USD", label: "USD" },
];

/** Values applied with the panel's Apply Filter button; amounts stay text until applied. */
export interface ChangeFilterValues {
  currency: string;
  costFrom: string;
  costTo: string;
  type: ChangeTypeFilter;
}

export function noChangeFilters(currency: string): ChangeFilterValues {
  return { currency, costFrom: "", costTo: "", type: "all" };
}

function parseAmount(value: string): number | null {
  const n = Number(value.replace(/,/g, "").trim());
  return value.trim() === "" || Number.isNaN(n) ? null : n;
}

export function hasCostBound(values: ChangeFilterValues): boolean {
  return parseAmount(values.costFrom) !== null || parseAmount(values.costTo) !== null;
}

export function hasAppliedFilters(values: ChangeFilterValues): boolean {
  return hasCostBound(values) || values.type !== "all";
}

/** A cost range only means something in one currency, so rows in another never match it. */
export function matchesChangeFilters(cr: ChangeRequest, values: ChangeFilterValues): boolean {
  if (values.type !== "all" && cr.type !== values.type) return false;
  const from = parseAmount(values.costFrom);
  const to = parseAmount(values.costTo);
  if (from === null && to === null) return true;
  if (cr.currency !== values.currency) return false;
  return (from === null || cr.costImpact >= from) && (to === null || cr.costImpact <= to);
}

export function matchesChangeSearch(cr: ChangeRequest, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [cr.title, cr.description, cr.reason].some((text) => text?.toLowerCase().includes(q));
}
