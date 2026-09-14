import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { useProjectInvoices, type Invoice } from "@/hooks/use-invoices";
import { BUDGET_INVOICES_PATH, financeTabPath } from "@/lib/finance-routes";
import { formatCurrency } from "@/lib/formatters";
import { INVOICE_STATUS_TONE } from "@/lib/project-meta";
import type { Currency } from "@/lib/project-types";
import { INVOICE_STATUS_LABEL, invoicePeriodLabel } from "../invoices/invoice-model";
import { OverviewCard, OverviewEmpty } from "./overview-cards";

/** The last five invoices, newest first, with where each stands and what is still owed. */

const RECENT_N = 5;

export function recentInvoices(invoices: Invoice[]): Invoice[] {
  // Copy first: the cached list must not be sorted in place.
  return [...invoices]
    .sort((a, b) => (b.issueDate ?? "").localeCompare(a.issueDate ?? "") || b.id.localeCompare(a.id))
    .slice(0, RECENT_N);
}

export function RecentInvoicesCard({ projectId, currency }: { projectId: string; currency: Currency }) {
  const { data: invoices = [] } = useProjectInvoices(projectId);
  const recent = useMemo(() => recentInvoices(invoices), [invoices]);

  return (
    <OverviewCard
      title="Recent invoices"
      description="The latest invoices raised on this build."
      to={`/project/${projectId}/${financeTabPath(BUDGET_INVOICES_PATH, "invoices")}`}
    >
      {recent.length === 0 ? (
        <OverviewEmpty>No invoices yet.</OverviewEmpty>
      ) : (
        <div className="-mx-6 -mb-6 overflow-hidden rounded-b-2xl border-t border-line-hair">
          <Table>
            <TableHead>
              <tr>
                <TableHeaderCell>Invoice</TableHeaderCell>
                <TableHeaderCell>Period</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
                <TableHeaderCell align="right">Amount</TableHeaderCell>
                <TableHeaderCell align="right">Balance</TableHeaderCell>
              </tr>
            </TableHead>
            <TableBody>
              {recent.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <p className="font-medium text-ink">{invoice.vendorName}</p>
                    <p className="text-xs text-ink-muted">{invoice.number ?? invoice.trade}</p>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-gray-600">{invoicePeriodLabel(invoice)}</TableCell>
                  <TableCell>
                    <Badge tone={INVOICE_STATUS_TONE[invoice.status]} size="sm">
                      {INVOICE_STATUS_LABEL[invoice.status]}
                    </Badge>
                  </TableCell>
                  <TableCell align="right" className="whitespace-nowrap tabular-nums">
                    {formatCurrency(invoice.totalInvoiced, invoice.currency || currency)}
                  </TableCell>
                  <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums text-primary-500">
                    {formatCurrency(invoice.balanceDue, invoice.currency || currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </OverviewCard>
  );
}

RecentInvoicesCard.displayName = "RecentInvoicesCard";
