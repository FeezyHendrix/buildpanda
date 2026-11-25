import { MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/atoms/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/atoms/dropdown-menu";
import { useProjectInvoices, type Invoice } from "@/hooks/use-invoices";
import { BUDGET_INVOICES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCurrency, formatLongDate } from "@/lib/formatters";
import { INVOICE_STATUS_TONE } from "@/lib/project-meta";
import type { Currency } from "@/lib/project-types";
import { INVOICE_STATUS_LABEL } from "../invoices/invoice-model";
import { OverviewCard, OverviewEmpty } from "./overview-cards";

/**
 * The latest invoices as a table, newest first. Searching and filtering the
 * whole list belongs to the invoices tab ("View More"); this card only shows
 * what came in last. It reads the same cached query that tab does.
 */

const RECENT_N = 5;

/** Invoice, status, date, vendor, amount, row menu. Shared by the header and every row. */
const COLUMNS = "grid grid-cols-[minmax(0,202fr)_minmax(0,225fr)_minmax(0,198fr)_minmax(0,240fr)_minmax(0,193fr)_24px] items-center px-[24px]";

/** The newest invoices first; `slice` and `sort` work on a copy, never the cache. */
export function recentInvoices(invoices: Invoice[]): Invoice[] {
  return [...invoices]
    .sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? "") || b.id.localeCompare(a.id))
    .slice(0, RECENT_N);
}

function InvoiceRow({ invoice, currency, to }: { invoice: Invoice; currency: Currency; to: string }) {
  const navigate = useNavigate();
  const name = invoice.number ?? invoice.trade;
  return (
    <li className={`${COLUMNS} min-h-[52px] border-b border-[#EEEEEE] py-[8px] text-caption-l text-[#1E1E1E] last:border-b-0`}>
      <span className="truncate">{name}</span>
      <span>
        <Badge tone={INVOICE_STATUS_TONE[invoice.status]} size="sm">
          {INVOICE_STATUS_LABEL[invoice.status]}
        </Badge>
      </span>
      <span className="truncate">{invoice.issueDate ? formatLongDate(invoice.issueDate) : "—"}</span>
      <span className="truncate">{invoice.vendorName}</span>
      <span className="truncate tabular-nums">{formatCurrency(invoice.totalInvoiced, invoice.currency || currency)}</span>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              aria-label={`Actions for ${name}`}
              className="flex size-[24px] items-center justify-center text-[#1E1E1E] outline-none hover:bg-[#F5F5F5] focus-visible:ring-2 focus-visible:ring-gray-900/10"
            >
              <MoreVertical className="size-[18px]" strokeWidth={2} aria-hidden />
            </button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => navigate(to)}>View in invoices</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

interface RecentInvoicesPanelProps {
  invoices: Invoice[];
  currency: Currency;
  to: string;
  className?: string;
}

/** The presentational half, so it can be rendered with any list of invoices. */
export function RecentInvoicesPanel({ invoices, currency, to, className }: RecentInvoicesPanelProps) {
  const shown = recentInvoices(invoices);

  return (
    <OverviewCard title="Recent invoices" to={to} className={className} bodyClassName="p-0">
      {shown.length === 0 ? (
        <div className="px-[24px]">
          <OverviewEmpty>No invoices yet.</OverviewEmpty>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className={`${COLUMNS} h-[51px] bg-[#F5F5F5] text-caption-l font-medium text-[#4D4D4D]`} role="row">
              <span>Invoice</span>
              <span>Status</span>
              <span>Date</span>
              <span>Vendor</span>
              <span>Amount</span>
              <span />
            </div>
            <ul>
              {shown.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} currency={currency} to={to} />
              ))}
            </ul>
          </div>
        </div>
      )}
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
