import { useMemo } from "react";
import { Badge } from "@/components/atoms/badge";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableEmptyRow,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import type { Invoice } from "@/hooks/use-invoices";
import { formatCurrency } from "@/lib/formatters";
import type { Currency } from "@/lib/project-types";
import type { InvoiceAction } from "./invoice-action-dialogs";
import {
  budgetMonthLabel,
  counterpartyLabel,
  counterpartyName,
  invoicePeriodLabel,
  isVoided,
} from "./invoice-model";
import { InvoiceStatusSelect } from "./invoice-status-select";

/**
 * The invoice register: one row per invoice with an inline status control.
 * Every figure is a recorded amount; a row never charges or pays anything.
 *
 * A certificate with a receipt on it is an accounting record — the row offers
 * Void (with a reason), never Delete.
 */

const COLUMN_COUNT = 9;

export interface InvoiceRowHandlers {
  onView: (invoice: Invoice) => void;
  onAction: (invoice: Invoice, action: InvoiceAction) => void;
  onDownloadPdf: (invoice: Invoice) => void;
}

interface InvoiceTableProps extends InvoiceRowHandlers {
  projectId: string;
  currency: Currency;
  invoices: Invoice[];
  isLoading: boolean;
  isFiltered: boolean;
  canManage: boolean;
  onAdd?: () => void;
  onClearFilters: () => void;
}

export function InvoiceTable({
  projectId,
  currency,
  invoices,
  isLoading,
  isFiltered,
  canManage,
  onAdd,
  onClearFilters,
  onView,
  onAction,
  onDownloadPdf,
}: InvoiceTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[960px]">
        <TableHead>
          <tr>
            <TableHeaderCell>Invoice #</TableHeaderCell>
            <TableHeaderCell>Budget month</TableHeaderCell>
            <TableHeaderCell>Party</TableHeaderCell>
            <TableHeaderCell>Period</TableHeaderCell>
            <TableHeaderCell align="right">Amount</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
            <TableHeaderCell align="right">Paid</TableHeaderCell>
            <TableHeaderCell align="right">Balance</TableHeaderCell>
            <TableHeaderCell align="right" className="w-[72px]">
              <span className="sr-only">Actions</span>
            </TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableEmptyRow colSpan={COLUMN_COUNT} className="py-12">
              <div className="flex items-center justify-center">
                <Spinner size="md" />
              </div>
            </TableEmptyRow>
          ) : invoices.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              {isFiltered ? (
                <EmptyState
                  variant="inline"
                  title="No invoices match"
                  description="Try another status or search term."
                  action={{ label: "Clear filters", onClick: onClearFilters }}
                />
              ) : (
                <EmptyState
                  variant="inline"
                  icon={<FinancesIcon />}
                  title="No invoices yet"
                  description="Add an invoice or record a bill to track what's billed, held back and paid."
                  action={canManage && onAdd ? { label: "Add invoice", onClick: onAdd } : undefined}
                />
              )}
            </TableEmptyRow>
          ) : (
            invoices.map((invoice) => (
              <InvoiceRow
                key={invoice.id}
                projectId={projectId}
                currency={currency}
                invoice={invoice}
                canManage={canManage}
                onView={onView}
                onAction={onAction}
                onDownloadPdf={onDownloadPdf}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

InvoiceTable.displayName = "InvoiceTable";

/** Late paid, or still running late — the figure the API computed, never a date sum done here. */
function LatenessBadge({ invoice }: { invoice: Invoice }) {
  if (invoice.paidLateDays && invoice.paidLateDays > 0) {
    return (
      <Badge tone="warning" size="sm" dot>
        Paid {invoice.paidLateDays}d late
      </Badge>
    );
  }
  if (invoice.overdueDays && invoice.overdueDays > 0) {
    return (
      <Badge tone="danger" size="sm" dot>
        {invoice.overdueDays}d overdue
      </Badge>
    );
  }
  return null;
}

LatenessBadge.displayName = "LatenessBadge";

interface InvoiceRowProps extends InvoiceRowHandlers {
  projectId: string;
  currency: Currency;
  invoice: Invoice;
  canManage: boolean;
}

function InvoiceRow({ projectId, currency, invoice, canManage, onView, onAction, onDownloadPdf }: InvoiceRowProps) {
  const money = (value: number) => formatCurrency(value, invoice.currency || currency);
  const voided = isVoided(invoice);
  const hasPayments = invoice.payments.length > 0;

  const actions = useMemo<RowActionItem[]>(
    () => [
      { label: "View", onSelect: () => onView(invoice) },
      ...(canManage && !voided ? [{ label: "Edit", onSelect: () => onAction(invoice, "edit") }] : []),
      { label: "PDF", onSelect: () => onDownloadPdf(invoice) },
      ...(invoice.invoiceType === "progress"
        ? [{ label: "Pay application", onSelect: () => onAction(invoice, "pay-application") }]
        : []),
      ...(canManage && !voided ? [{ label: "Send", onSelect: () => onAction(invoice, "send") }] : []),
      ...(canManage && !voided ? [{ label: "Query", onSelect: () => onAction(invoice, "query") }] : []),
      // A certificate with money recorded against it is voided, never deleted.
      ...(canManage && !voided && hasPayments
        ? [{ label: "Void", tone: "danger" as const, onSelect: () => onAction(invoice, "void") }]
        : []),
      ...(canManage && !voided && !hasPayments
        ? [{ label: "Delete", tone: "danger" as const, onSelect: () => onAction(invoice, "delete") }]
        : []),
    ],
    [invoice, canManage, voided, hasPayments, onView, onAction, onDownloadPdf],
  );

  return (
    <TableRow tone={voided ? "muted" : "default"} onClick={() => onView(invoice)}>
      <TableCell className="whitespace-nowrap font-medium text-ink">{invoice.number ?? "—"}</TableCell>
      <TableCell className="whitespace-nowrap">{budgetMonthLabel(invoice)}</TableCell>
      <TableCell>
        <p className="font-medium text-ink">{counterpartyName(invoice)}</p>
        <p className="text-xs text-ink-muted">
          {counterpartyLabel(invoice)}
          {invoice.trade ? ` · ${invoice.trade}` : ""}
        </p>
      </TableCell>
      <TableCell className="whitespace-nowrap text-gray-600">{invoicePeriodLabel(invoice)}</TableCell>
      <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums">
        {money(invoice.totalInvoiced)}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusSelect projectId={projectId} invoice={invoice} disabled={!canManage || voided} />
          <LatenessBadge invoice={invoice} />
        </div>
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">{money(invoice.amountPaid)}</TableCell>
      <TableCell align="right" className="whitespace-nowrap font-medium tabular-nums text-primary-500">
        {money(invoice.balanceDue)}
      </TableCell>
      <TableCell align="right" onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-end">
          <RowActionsMenu ariaLabel={`Actions for ${counterpartyName(invoice)}`} items={actions} />
        </div>
      </TableCell>
    </TableRow>
  );
}

InvoiceRow.displayName = "InvoiceRow";
