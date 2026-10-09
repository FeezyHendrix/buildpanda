import { useMemo, useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { SearchInput } from "@/components/atoms/search-input";
import { FilterTabs } from "@/components/molecules/filter-tabs";
import { useProjectInvoices, type Invoice } from "@/hooks/use-invoices";
import { BUDGET_INVOICES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCurrency } from "@/lib/formatters";
import { INVOICE_STATUS_TONE } from "@/lib/project-meta";
import type { Currency } from "@/lib/project-types";
import { INVOICE_STATUS_LABEL, invoicePeriodLabel } from "../invoices/invoice-model";
import { OverviewCard, OverviewEmpty, OverviewList, OverviewRow } from "./overview-cards";

/**
 * The latest invoices, newest first, narrowed by a status filter and a search
 * over vendor, number and trade. Filtering is `useState` applied during
 * render; the list is the same cached query the invoices tab reads.
 */

const RECENT_N = 5;
const SEARCH_N = 10;

const FILTERS = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
] as const;
type InvoiceFilter = (typeof FILTERS)[number]["value"];

export function matchesFilter(invoice: Invoice, filter: InvoiceFilter): boolean {
  if (filter === "all") return true;
  if (filter === "paid") return invoice.status === "Paid";
  return invoice.balanceDue > 0 && invoice.status !== "Void" && invoice.status !== "Draft";
}

export function matchesSearch(invoice: Invoice, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return [invoice.vendorName, invoice.number ?? "", invoice.trade].some((field) => field.toLowerCase().includes(needle));
}

export function recentInvoices(invoices: Invoice[], filter: InvoiceFilter, query: string): Invoice[] {
  // `filter` returns a fresh array, so sorting it never touches the cache.
  return invoices
    .filter((invoice) => matchesFilter(invoice, filter) && matchesSearch(invoice, query))
    .sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? "") || b.id.localeCompare(a.id))
    .slice(0, query.trim() ? SEARCH_N : RECENT_N);
}

interface RecentInvoicesPanelProps {
  invoices: Invoice[];
  currency: Currency;
  to: string;
  className?: string;
}

/** The presentational half, so it can be rendered with any list of invoices. */
export function RecentInvoicesPanel({ invoices, currency, to, className }: RecentInvoicesPanelProps) {
  const [filter, setFilter] = useState<InvoiceFilter>("all");
  const [query, setQuery] = useState("");
  const shown = useMemo(() => recentInvoices(invoices, filter, query), [invoices, filter, query]);
  const matching = useMemo(
    () => invoices.filter((invoice) => matchesFilter(invoice, filter) && matchesSearch(invoice, query)).length,
    [invoices, filter, query],
  );
  const filtered = filter !== "all" || query.trim().length > 0;

  return (
    <OverviewCard title="Recent invoices" to={to} className={className}>
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <div className="w-full max-w-[220px]">
          <SearchInput
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search vendor or number"
            aria-label="Search invoices"
            className="h-9 bg-surface-alt text-sm"
          />
        </div>
        <FilterTabs items={FILTERS} value={filter} onChange={setFilter} ariaLabel="Invoice filter" />
        <p className="ml-auto text-xs text-ink-muted" aria-live="polite">
          {shown.length} of {matching}
        </p>
      </div>

      {shown.length === 0 ? (
        <OverviewEmpty>{invoices.length === 0 ? "No invoices yet." : "No invoices match this search or filter."}</OverviewEmpty>
      ) : (
        <OverviewList>
          {shown.map((invoice) => (
            <OverviewRow
              key={invoice.id}
              to={to}
              label={invoice.vendorName}
              sub={[invoice.number ?? invoice.trade, invoicePeriodLabel(invoice)].filter(Boolean).join(" · ")}
              value={formatCurrency(invoice.balanceDue, invoice.currency || currency)}
              helper={
                <Badge tone={INVOICE_STATUS_TONE[invoice.status]} size="sm">
                  {INVOICE_STATUS_LABEL[invoice.status]}
                </Badge>
              }
            />
          ))}
        </OverviewList>
      )}
      {filtered && shown.length > 0 && matching > shown.length ? (
        <p className="mt-2 text-xs text-ink-muted">Showing the newest {shown.length}. Open the invoices tab for the rest.</p>
      ) : null}
    </OverviewCard>
  );
}

RecentInvoicesPanel.displayName = "RecentInvoicesPanel";

interface RecentInvoicesCardProps {
  projectId: string;
  currency: Currency;
  className?: string;
}

export function RecentInvoicesCard({ projectId, currency, className }: RecentInvoicesCardProps) {
  const { data: invoices = [] } = useProjectInvoices(projectId);
  const to = `/project/${projectId}/${financeTabPath(BUDGET_INVOICES_PATH, "invoices")}`;
  return <RecentInvoicesPanel invoices={invoices} currency={currency} to={to} className={className} />;
}

RecentInvoicesCard.displayName = "RecentInvoicesCard";
