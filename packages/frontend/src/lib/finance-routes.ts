import type { FeatureFlagKey } from "@/lib/feature-flags";

/**
 * The finance section is an overview plus three tabbed pages under
 * `finances/*` (change orders live at `change-requests`). Each tab keeps the
 * feature flag its standalone page used to be gated by, so hiding a flag hides
 * the tab. The active tab lives in `?tab=` so links and reloads keep it; the
 * first tab of each page is the default and needs no query string.
 *
 * Shared by the pages, the sidebar, the breadcrumb trail and the legacy
 * redirects, so a tab is renamed in exactly one place.
 */
export interface FinanceTab<T extends string = string> {
  id: T;
  label: string;
  flag?: FeatureFlagKey;
}

export const FINANCE_OVERVIEW_PATH = "finances";
export const CONTRACTS_PHASES_PATH = "finances/contracts-phases";
export const EXPENSES_PATH = "finances/expenses";
export const BUDGET_INVOICES_PATH = "finances/budget-invoices";
export const CHANGE_ORDERS_PATH = "change-requests";

export const CONTRACTS_PHASES_TABS = [
  { id: "contracts", label: "Contracts", flag: "commercial.finances" },
  { id: "phases", label: "Phases", flag: "commercial.finances" },
] as const satisfies readonly FinanceTab[];
export type ContractsPhasesTab = (typeof CONTRACTS_PHASES_TABS)[number]["id"];

export const EXPENSES_TABS = [
  { id: "expenses", label: "Expenses", flag: "commercial.transactions" },
  { id: "purchase-orders", label: "Purchase orders", flag: "commercial.purchaseOrders" },
] as const satisfies readonly FinanceTab[];
export type ExpensesTab = (typeof EXPENSES_TABS)[number]["id"];

export const BUDGET_INVOICES_TABS = [
  { id: "budget", label: "Budget", flag: "commercial.finances" },
  { id: "invoices", label: "Invoices", flag: "commercial.invoices" },
  { id: "payments", label: "Payments", flag: "commercial.invoices" },
] as const satisfies readonly FinanceTab[];
export type BudgetInvoicesTab = (typeof BUDGET_INVOICES_TABS)[number]["id"];

/** Route tail → its tab set, for the breadcrumb trail (Finance › Budget & invoices › Payments). */
export const FINANCE_TABBED_PAGES: Record<string, readonly FinanceTab[]> = {
  [CONTRACTS_PHASES_PATH]: CONTRACTS_PHASES_TABS,
  [EXPENSES_PATH]: EXPENSES_TABS,
  [BUDGET_INVOICES_PATH]: BUDGET_INVOICES_TABS,
};

/** Builds the project-relative path for a finance tab; the default tab needs no query. */
export function financeTabPath(page: keyof typeof FINANCE_TABBED_PAGES, tab?: string): string {
  const tabs = FINANCE_TABBED_PAGES[page];
  if (!tab || tab === tabs?.[0]?.id) return page;
  return `${page}?tab=${tab}`;
}

/** The main contract drawer opened on its Final account section — where the old final-account page lands. */
export const FINAL_ACCOUNT_PATH = `${CONTRACTS_PHASES_PATH}?drawer=main&view=final-account`;

/**
 * Where each retired finance path now lives. Keys are route tails (without
 * the `/project/:id/` prefix); the `?tab=` of the old tabbed pages picks the
 * new page. Unrelated query params (`compose=1&period=`) survive the hop so
 * the invoice composer deep link keeps working.
 */
const LEGACY_TABBED: Record<string, Record<string, string>> = {
  "finances/contract": {
    "": BUDGET_INVOICES_PATH,
    stages: BUDGET_INVOICES_PATH,
    terms: CONTRACTS_PHASES_PATH,
    "final-account": FINAL_ACCOUNT_PATH,
  },
  "finances/billing": {
    "": financeTabPath(BUDGET_INVOICES_PATH, "invoices"),
    invoices: financeTabPath(BUDGET_INVOICES_PATH, "invoices"),
    "payment-requests": financeTabPath(BUDGET_INVOICES_PATH, "payments"),
    "stage-payments": financeTabPath(BUDGET_INVOICES_PATH, "payments"),
  },
  "finances/costs": {
    "": BUDGET_INVOICES_PATH,
    budget: BUDGET_INVOICES_PATH,
    expenses: EXPENSES_PATH,
    "purchase-orders": financeTabPath(EXPENSES_PATH, "purchase-orders"),
  },
};

const LEGACY_FLAT: Record<string, string> = {
  "finances/contract-stages": BUDGET_INVOICES_PATH,
  "finances/final-account": FINAL_ACCOUNT_PATH,
  "finances/payments": financeTabPath(BUDGET_INVOICES_PATH, "payments"),
  "finances/milestone-payments": financeTabPath(BUDGET_INVOICES_PATH, "payments"),
  "finances/payment-claims": financeTabPath(BUDGET_INVOICES_PATH, "payments"),
  "finances/invoices": financeTabPath(BUDGET_INVOICES_PATH, "invoices"),
  "finances/invoices/new": `${financeTabPath(BUDGET_INVOICES_PATH, "invoices")}&compose=1`,
  "finances/budget": BUDGET_INVOICES_PATH,
  "finances/budget-allocation": BUDGET_INVOICES_PATH,
  "finances/transactions": EXPENSES_PATH,
  "finances/purchase-orders": financeTabPath(EXPENSES_PATH, "purchase-orders"),
  milestones: financeTabPath(BUDGET_INVOICES_PATH, "payments"),
  "schedules/milestones": financeTabPath(BUDGET_INVOICES_PATH, "payments"),
};

export const LEGACY_FINANCE_PATHS: readonly string[] = [
  ...Object.keys(LEGACY_TABBED),
  ...Object.keys(LEGACY_FLAT),
];

/** Resolves a retired finance tail + search string to its new project-relative path. */
export function resolveLegacyFinancePath(tail: string, search: string): string {
  const params = new URLSearchParams(search);
  const tab = params.get("tab") ?? "";
  params.delete("tab");
  const tabbed = LEGACY_TABBED[tail];
  const target = tabbed ? (tabbed[tab] ?? tabbed[""]!) : (LEGACY_FLAT[tail] ?? BUDGET_INVOICES_PATH);
  const rest = params.toString();
  if (!rest) return target;
  return `${target}${target.includes("?") ? "&" : "?"}${rest}`;
}
