import type { FeatureFlagKey } from "@/lib/feature-flags";

/**
 * The finance section is three tabbed pages under `finances/*`. Each tab keeps
 * the feature flag its standalone page used to be gated by, so hiding a flag
 * hides the tab. The active tab lives in `?tab=` so links and reloads keep it;
 * the first tab of each page is the default and needs no query string.
 *
 * Shared by the pages, the sidebar and the breadcrumb trail, so a tab is
 * renamed in exactly one place.
 */
export interface FinanceTab<T extends string = string> {
  id: T;
  label: string;
  flag?: FeatureFlagKey;
}

export const CONTRACT_TABS = [
  { id: "stages", label: "Stages & billing", flag: "commercial.finances" },
  { id: "terms", label: "Terms", flag: "commercial.finances" },
  { id: "final-account", label: "Final account", flag: "commercial.finances" },
] as const satisfies readonly FinanceTab[];
export type ContractTab = (typeof CONTRACT_TABS)[number]["id"];

export const BILLING_TABS = [
  { id: "invoices", label: "Invoices", flag: "commercial.invoices" },
  { id: "payment-requests", label: "Payment requests", flag: "commercial.paymentClaims" },
  { id: "stage-payments", label: "Stage payments", flag: "commercial.finances" },
] as const satisfies readonly FinanceTab[];
export type BillingTab = (typeof BILLING_TABS)[number]["id"];

export const COSTS_TABS = [
  { id: "budget", label: "Budget", flag: "commercial.budget" },
  { id: "expenses", label: "Expenses", flag: "commercial.transactions" },
  { id: "purchase-orders", label: "Purchase orders", flag: "commercial.purchaseOrders" },
] as const satisfies readonly FinanceTab[];
export type CostsTab = (typeof COSTS_TABS)[number]["id"];

/** Route tail → its tab set, for the breadcrumb trail (Finance › Contract › Terms). */
export const FINANCE_TABBED_PAGES: Record<string, readonly FinanceTab[]> = {
  "finances/contract": CONTRACT_TABS,
  "finances/billing": BILLING_TABS,
  "finances/costs": COSTS_TABS,
};

/** Builds the project-relative path for a finance tab; the default tab needs no query. */
export function financeTabPath(
  page: keyof typeof FINANCE_TABBED_PAGES,
  tab?: string,
): string {
  const tabs = FINANCE_TABBED_PAGES[page];
  if (!tab || tab === tabs?.[0]?.id) return page;
  return `${page}?tab=${tab}`;
}
