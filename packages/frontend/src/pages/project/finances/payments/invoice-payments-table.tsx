import { Fragment } from "react";
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
import type { InvoicePaymentsRow } from "@/hooks/use-invoices";
import { formatCurrency } from "@/lib/formatters";
import { INVOICE_STATUS_TONE } from "@/lib/project-meta";
import { cn } from "@/lib/utils";
import { INVOICE_STATUS_LABEL } from "../invoices/invoice-model";

/**
 * Invoices as parent rows, each folding open to the payments recorded against
 * it. Every line is a logged movement — the money itself moved off-platform.
 */

const COLUMN_COUNT = 7;

interface InvoicePaymentsTableProps {
  rows: InvoicePaymentsRow[];
  currency: string;
  isLoading: boolean;
  isFiltered: boolean;
  expanded: ReadonlySet<string>;
  onToggle: (invoiceId: string) => void;
  onOpenInvoice: (invoiceId: string) => void;
}

export function InvoicePaymentsTable({
  rows,
  currency,
  isLoading,
  isFiltered,
  expanded,
  onToggle,
  onOpenInvoice,
}: InvoicePaymentsTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-line-hair bg-white">
      <Table className="min-w-[860px]">
        <TableHead>
          <tr>
            <TableHeaderCell className="w-10 px-4">
              <span className="sr-only">Expand</span>
            </TableHeaderCell>
            <TableHeaderCell>Invoice #</TableHeaderCell>
            <TableHeaderCell>Party</TableHeaderCell>
            <TableHeaderCell align="right">Amount</TableHeaderCell>
            <TableHeaderCell align="right">Paid</TableHeaderCell>
            <TableHeaderCell align="right">Outstanding</TableHeaderCell>
            <TableHeaderCell>Status</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {isLoading ? (
            <TableEmptyRow colSpan={COLUMN_COUNT} className="py-12">
              <div className="flex items-center justify-center">
                <Spinner size="md" />
              </div>
            </TableEmptyRow>
          ) : rows.length === 0 ? (
            <TableEmptyRow colSpan={COLUMN_COUNT}>
              <EmptyState
                variant="inline"
                icon={<FinancesIcon />}
                title={isFiltered ? "No invoices match" : "No invoice payments yet"}
                description={
                  isFiltered
                    ? "Try another invoice number or vendor."
                    : "Payments you record against invoices will be listed here under their invoice."
                }
              />
            </TableEmptyRow>
          ) : (
            rows.map((row) => (
              <Fragment key={row.id}>
                <InvoiceParentRow row={row} currency={currency} open={expanded.has(row.id)} onToggle={onToggle} />
                {expanded.has(row.id) ? <PaymentLines row={row} currency={currency} onOpenInvoice={onOpenInvoice} /> : null}
              </Fragment>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}

InvoicePaymentsTable.displayName = "InvoicePaymentsTable";

interface InvoiceParentRowProps {
  row: InvoicePaymentsRow;
  currency: string;
  open: boolean;
  onToggle: (invoiceId: string) => void;
}

function InvoiceParentRow({ row, currency, open, onToggle }: InvoiceParentRowProps) {
  return (
    <TableRow
      onClick={() => onToggle(row.id)}
      aria-expanded={open}
      tone={row.voidedAt ? "muted" : "default"}
      className="bg-white"
    >
      <TableCell className="px-4">
        <span
          aria-hidden="true"
          className={cn("inline-block text-xs text-ink-muted transition-transform", open ? "rotate-90" : "rotate-0")}
        >
          ▶
        </span>
      </TableCell>
      <TableCell className="whitespace-nowrap font-medium text-ink">
        {row.number ?? <span className="font-normal text-ink-muted">Missing invoice #</span>}
        <span className="ml-2 text-xs text-ink-muted">
          {row.payments.length} payment{row.payments.length === 1 ? "" : "s"}
        </span>
      </TableCell>
      <TableCell>
        <p>{row.counterparty ?? row.vendorName}</p>
        <p className="text-xs text-ink-muted">
          {row.direction === "payable" ? "Vendor" : "Client"}
        </p>
      </TableCell>
      <TableCell align="right" className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(row.netPayable, row.currency || currency)}</TableCell>
      <TableCell align="right" className="whitespace-nowrap tabular-nums">{formatCurrency(row.amountPaid, row.currency || currency)}</TableCell>
      <TableCell align="right" className="whitespace-nowrap font-medium tabular-nums text-primary-500">
        {formatCurrency(row.balanceDue, row.currency || currency)}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={INVOICE_STATUS_TONE[row.status]} size="sm">
            {INVOICE_STATUS_LABEL[row.status]}
          </Badge>
          {row.paidLateDays && row.paidLateDays > 0 ? (
            <Badge tone="warning" size="sm" dot>
              Paid {row.paidLateDays}d late
            </Badge>
          ) : null}
          {row.overdueDays && row.overdueDays > 0 ? (
            <Badge tone="danger" size="sm" dot>
              {row.overdueDays}d overdue
            </Badge>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

InvoiceParentRow.displayName = "InvoiceParentRow";

interface PaymentLinesProps {
  row: InvoicePaymentsRow;
  currency: string;
  onOpenInvoice: (invoiceId: string) => void;
}

function PaymentLines({ row, currency, onOpenInvoice }: PaymentLinesProps) {
  return (
    <TableRow className="bg-surface-alt">
      <TableCell colSpan={COLUMN_COUNT} className="px-4 py-3 sm:px-14">
        {row.payments.length === 0 ? (
          <p className="text-xs text-ink-muted">No payments recorded against this invoice yet.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line-hair bg-white">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell className="px-4">Date</TableHeaderCell>
                  <TableHeaderCell align="right" className="px-4">Amount</TableHeaderCell>
                  <TableHeaderCell className="px-4">Method</TableHeaderCell>
                  <TableHeaderCell className="px-4">Note</TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {row.payments.map((payment) => (
                  <TableRow key={payment.id} onClick={() => onOpenInvoice(row.id)}>
                    <TableCell className="whitespace-nowrap px-4">{payment.paidAt ?? "—"}</TableCell>
                    <TableCell align="right" className="px-4 font-medium tabular-nums">{formatCurrency(payment.amount, row.currency || currency)}</TableCell>
                    <TableCell className="px-4">
                      {payment.method}
                      {payment.credit ? (
                        <span className="ml-2 text-xs text-warning-500">Overpayment credit</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="px-4 text-gray-600">{payment.note ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

PaymentLines.displayName = "PaymentLines";
