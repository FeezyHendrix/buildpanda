import type { BadgeTone } from "@/components/atoms/badge";
import { errorDetails, errorMessage, getApiErrorStatus } from "@/lib/api-error";
import type { Supplier, SupplierScope } from "@/lib/project-types";

/** The 409 the register answers with when the email or phone already exists. */
export interface DuplicateSupplier {
  existingId: string;
  message: string;
}

export function readDuplicate(error: unknown): DuplicateSupplier | null {
  if (getApiErrorStatus(error) !== 409) return null;
  const details = errorDetails<{ existingId?: string }>(error);
  if (!details?.existingId) return null;
  return { existingId: details.existingId, message: errorMessage(error) };
}

export type SupplierScopeFilter = "all" | SupplierScope;
export type SupplierApprovalFilter = "all" | "approved" | "unapproved";

export const SUPPLIER_SCOPE_OPTIONS: { value: SupplierScopeFilter; label: string }[] = [
  { value: "all", label: "All scopes" },
  { value: "organization", label: "Workspace" },
  { value: "project", label: "This project" },
];

export const SUPPLIER_APPROVAL_OPTIONS: { value: SupplierApprovalFilter; label: string }[] = [
  { value: "all", label: "Approved: all" },
  { value: "approved", label: "Approved only" },
  { value: "unapproved", label: "Not approved" },
];

/**
 * A supplier on the company register is reusable across every job; one raised
 * here belongs to this project alone. The badge says which, so nobody edits a
 * shared account thinking it is local.
 */
export const SUPPLIER_SCOPE_META: Record<SupplierScope, { label: string; tone: BadgeTone }> = {
  organization: { label: "Workspace", tone: "accent" },
  project: { label: "This project", tone: "neutral" },
};

/** Fall back to the row's own ownership when an older response omits `scope`. */
export function supplierScope(supplier: Supplier): SupplierScope {
  return supplier.scope ?? (supplier.projectId ? "project" : "organization");
}

export function formatLeadTime(days: number | null): string {
  if (days === null) return "—";
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** Every distinct trade on the register, sorted, for the trade filter. */
export function supplierTrades(suppliers: readonly Supplier[]): string[] {
  const trades = new Set<string>();
  for (const supplier of suppliers) {
    if (supplier.trade) trades.add(supplier.trade);
  }
  // A fresh array built here, so sorting in place mutates nothing shared.
  return [...trades].sort((a, b) => a.localeCompare(b));
}

export function matchesSupplierSearch(supplier: Supplier, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return [supplier.name, supplier.trade, supplier.contactName].some((field) =>
    field?.toLowerCase().includes(q),
  );
}

export interface SupplierFilters {
  search: string;
  trade: string;
  scope: SupplierScopeFilter;
  approval: SupplierApprovalFilter;
}

export const EMPTY_SUPPLIER_FILTERS: SupplierFilters = {
  search: "",
  trade: "all",
  scope: "all",
  approval: "all",
};

export function isFiltering(filters: SupplierFilters): boolean {
  return (
    filters.search.trim().length > 0 ||
    filters.trade !== "all" ||
    filters.scope !== "all" ||
    filters.approval !== "all"
  );
}

export function filterSuppliers(
  suppliers: readonly Supplier[],
  filters: SupplierFilters,
): Supplier[] {
  return suppliers
    .filter((supplier) => filters.trade === "all" || supplier.trade === filters.trade)
    .filter((supplier) => filters.scope === "all" || supplierScope(supplier) === filters.scope)
    .filter(
      (supplier) =>
        filters.approval === "all" ||
        (filters.approval === "approved" ? supplier.approved : !supplier.approved),
    )
    .filter((supplier) => matchesSupplierSearch(supplier, filters.search));
}
