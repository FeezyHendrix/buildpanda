import { useMemo } from "react";
import { FinancesIcon } from "@/components/atoms/project-nav-icons";
import { Spinner } from "@/components/atoms/spinner";
import { Table, TableBody, TableCell, TableEmptyRow, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { EmptyState } from "@/components/molecules/empty-state";
import { RowActionsMenu, type RowActionItem } from "@/components/molecules/row-actions-menu";
import type { Invoice, InvoiceStatus } from "@/hooks/use-invoices";
import { formatCurrency, formatLongDate } from "@/lib/formatters";
import type { Currency } from "@/lib/project-types";
import { cn } from "@/lib/utils";
import type { InvoiceAction } from "./invoice-action-dialogs";
import { INVOICE_PILL, counterpartyName, invoiceStatusLabel, isVoided, nextInvoiceStatuses } from "./invoice-model";

/**
 * The invoice register. Every figure is a recorded amount; a row never charges
 * or pays anything. A certificate with a receipt on it is an accounting record,
 * so its row offers Void (with a reason), never Delete.
 */

const COLUMNS = ["Invoice", "Status", "Date", "Vendor", "Amount"] as const;
const COLUMN_COUNT = COLUMNS.length + 1;
const HEADER_CELL = "h-[52px] px-[24px] py-0 text-caption-l font-medium normal-case text-[#525252]";
const BODY_CELL = "px-[24px] py-0 text-caption-l text-[#1E1E1E]";

/** Column widths as shares of the 1116px design table (the same grid as Expenses). */
const COLUMN_WIDTHS = ["18.1%", "20.2%", "17.7%", "21.4%", "16.4%", "6.2%"] as const;

export function StatusPill({ status, className }: { status: InvoiceStatus; className?: string }) {
  return (
    <span className={cn("inline-flex h-[24px] items-center whitespace-nowrap rounded-full border px-[8px] text-caption-m font-medium", INVOICE_PILL[status], className)}>
      {invoiceStatusLabel(status)}
    </span>
  );
}

StatusPill.displayName = "StatusPill";

export interface InvoiceRowHandlers {
  onView: (invoice: Invoice) => void;
  onAction: (invoice: Invoice, action: InvoiceAction) => void;
  onDownloadPdf: (invoice: Invoice) => void;
  onMoveStatus: (invoice: Invoice, status: InvoiceStatus) => void;
}

interface InvoiceTableProps extends InvoiceRowHandlers {
  currency: Currency;
  invoices: Invoice[];
  isLoading: boolean;
  isFiltered: boolean;
  canManage: boolean;
  onAdd?: () => void;
  onClearFilters: () => void;
}

export function InvoiceTable({ currency, invoices, isLoading, isFiltered, canManage, onAdd, onClearFilters, ...handlers }: InvoiceTableProps) {
  return (
    <div className="border border-[#EEEEEE] bg-white">
      <Table className="min-w-[900px] table-fixed">
        <colgroup>
          {COLUMN_WIDTHS.map((width, index) => (
            <col key={index} style={{ width }} />
          ))}
        </colgroup>
        <TableHead>
          <tr>
            {COLUMNS.map((column) => (
              <TableHeaderCell key={column} className={HEADER_CELL}>
                {column}
              </TableHeaderCell>
            ))}
            <TableHeaderCell className={HEADER_CELL}>
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
                <EmptyState variant="inline" title="No invoices match" description="Try another status, date or search term." action={{ label: "Clear filters", onClick: onClearFilters }} />
              ) : (
                <EmptyState
                  variant="inline"
                  icon={<FinancesIcon />}
                  title="No invoices yet"
                  description="Add an invoice or record a bill to track what's billed, held back and paid."
                  action={canManage && onAdd ? { label: "Create invoice", onClick: onAdd } : undefined}
                />
              )}
            </TableEmptyRow>
          ) : (
            invoices.map((invoice) => <InvoiceRow key={invoice.id} currency={currency} invoice={invoice} canManage={canManage} {...handlers} />)
          )}
        </TableBody>
      </Table>
    </div>
  );
}

InvoiceTable.displayName = "InvoiceTable";

interface InvoiceRowProps extends InvoiceRowHandlers {
  currency: Currency;
  invoice: Invoice;
  canManage: boolean;
}

/** The actions an invoice offers, in the order a QS reaches for them. Shared by the row and the sheet. */
export function invoiceMenuItems(
  invoice: Invoice,
  canManage: boolean,
  { onView, onAction, onDownloadPdf, onMoveStatus }: InvoiceRowHandlers,
  includeView = true,
): RowActionItem[] {
  const voided = isVoided(invoice);
  const hasPayments = invoice.payments.length > 0;
  return [
    ...(includeView ? [{ label: "View", onSelect: () => onView(invoice) }] : []),
    ...(canManage && !voided ? [{ label: "Edit", onSelect: () => onAction(invoice, "edit") }] : []),
    { label: "Download PDF", onSelect: () => onDownloadPdf(invoice) },
    ...(invoice.invoiceType === "progress" ? [{ label: "Pay application", onSelect: () => onAction(invoice, "pay-application") }] : []),
    ...(canManage && !voided ? [{ label: "Send", onSelect: () => onAction(invoice, "send") }] : []),
    ...(canManage && !voided ? [{ label: "Query", onSelect: () => onAction(invoice, "query") }] : []),
    ...(canManage && !voided
      ? nextInvoiceStatuses(invoice)
          .filter((status) => status !== "Queried" && status !== "Sent")
          .map((status) => ({ label: `Mark ${invoiceStatusLabel(status).toLowerCase()}`, onSelect: () => onMoveStatus(invoice, status) }))
      : []),
    // A certificate with money recorded against it is voided, never deleted.
    ...(canManage && !voided && hasPayments ? [{ label: "Void", tone: "danger" as const, onSelect: () => onAction(invoice, "void") }] : []),
    ...(canManage && !voided && !hasPayments ? [{ label: "Delete", tone: "danger" as const, onSelect: () => onAction(invoice, "delete") }] : []),
  ];
}

function InvoiceRow({ currency, invoice, canManage, ...handlers }: InvoiceRowProps) {
  const voided = isVoided(invoice);
  const actions = useMemo(() => invoiceMenuItems(invoice, canManage, handlers), [invoice, canManage, handlers.onView, handlers.onAction, handlers.onDownloadPdf, handlers.onMoveStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <TableRow tone={voided ? "muted" : "default"} onClick={() => handlers.onView(invoice)} className="h-[52px] border-[#EEEEEE]">
      <TableCell className={BODY_CELL}>
        <p className="truncate">{invoice.number ?? "—"}</p>
      </TableCell>
      <TableCell className={BODY_CELL}>
        <StatusPill status={voided ? "Void" : invoice.status} />
      </TableCell>
      <TableCell className={`${BODY_CELL} whitespace-nowrap`}>{formatLongDate(invoice.issueDate) || "—"}</TableCell>
      <TableCell className={BODY_CELL}>
        <p className="truncate">{counterpartyName(invoice)}</p>
      </TableCell>
      <TableCell className={`${BODY_CELL} whitespace-nowrap tabular-nums`}>{formatCurrency(invoice.totalInvoiced, invoice.currency || currency)}</TableCell>
      <TableCell className={BODY_CELL} onClick={(event) => event.stopPropagation()}>
        <div className="flex justify-center">
          <RowActionsMenu ariaLabel={`Actions for ${invoice.number ?? counterpartyName(invoice)}`} items={actions} appearance="house" />
        </div>
      </TableCell>
    </TableRow>
  );
}

InvoiceRow.displayName = "InvoiceRow";
