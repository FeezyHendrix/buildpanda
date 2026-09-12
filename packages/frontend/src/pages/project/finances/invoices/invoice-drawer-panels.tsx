import { useMemo, useState } from "react";
import { Button } from "@/components/atoms/button";
import { ConfirmDialog } from "@/components/atoms/confirm-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from "@/components/atoms/table";
import { DrawerMetric, DrawerSectionTitle } from "../finance-drawer";
import { useDeleteInvoicePayment, type Invoice } from "@/hooks/use-invoices";
import { getApiErrorMessage } from "@/lib/api-error";
import { formatCurrency } from "@/lib/formatters";
import { toast } from "@/lib/toast";
import { InvoiceBudgetAllocations } from "../../invoices/invoice-budget-allocations";
import { AddPaymentDrawer } from "../payments/add-payment-drawer";
import { budgetMonthLabel, invoicePeriodLabel } from "./invoice-model";

/** The three panels of the invoice drawer. Amounts are recorded figures. */

interface PanelProps {
  projectId: string;
  invoice: Invoice;
  currency: string;
  canManage: boolean;
}

export function InvoiceDetailsPanel({ projectId, invoice, currency, canManage }: PanelProps) {
  const money = (value: number) => formatCurrency(value, currency);
  return (
    <>
      <section>
        <DrawerSectionTitle>Details</DrawerSectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <DrawerMetric label="Vendor" value={invoice.vendorName} />
          <DrawerMetric label="Trade" value={invoice.trade} />
          <DrawerMetric label="Type" value={invoice.invoiceType} />
          <DrawerMetric label="Budget month" value={budgetMonthLabel(invoice)} />
          <DrawerMetric label="Period" value={invoicePeriodLabel(invoice)} />
          <DrawerMetric label="Contract ref." value={invoice.contractReference ?? "—"} />
        </div>
      </section>

      <section>
        <DrawerSectionTitle>Amounts</DrawerSectionTitle>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <DrawerMetric label="Subtotal" value={money(invoice.subtotal)} />
          <DrawerMetric label={`VAT (${invoice.vatRate}%)`} value={money(invoice.vatAmount)} />
          <DrawerMetric label={`Retention (${invoice.retentionRate}%)`} value={money(invoice.retentionAmount)} />
          <DrawerMetric label={`WHT (${invoice.whtRate}%)`} value={money(invoice.whtAmount)} />
          <DrawerMetric label="Total invoiced" value={money(invoice.totalInvoiced)} />
          <DrawerMetric label="Net payable" value={money(invoice.netPayable)} />
          <DrawerMetric label="Paid" value={money(invoice.amountPaid)} />
          <DrawerMetric label="Balance" value={money(invoice.balanceDue)} />
        </div>
      </section>

      {invoice.notes ? (
        <section>
          <DrawerSectionTitle>Notes</DrawerSectionTitle>
          <p className="mt-3 rounded-lg bg-surface-alt p-4 text-sm leading-6 text-gray-700">{invoice.notes}</p>
        </section>
      ) : null}

      {invoice.paymentInstructions ? (
        <section>
          <DrawerSectionTitle>Payment details</DrawerSectionTitle>
          <p className="mt-3 whitespace-pre-line rounded-lg bg-surface-alt p-4 text-sm leading-6 text-gray-700">
            {invoice.paymentInstructions}
          </p>
        </section>
      ) : null}

      <InvoiceBudgetAllocations projectId={projectId} invoice={invoice} currency={currency} canManage={canManage} />
    </>
  );
}

InvoiceDetailsPanel.displayName = "InvoiceDetailsPanel";

export function InvoiceLineItemsPanel({ invoice, currency }: Pick<PanelProps, "invoice" | "currency">) {
  if (invoice.lineItems.length === 0) {
    return <p className="rounded-lg bg-surface-alt p-4 text-sm text-ink-muted">No line items on this invoice.</p>;
  }
  return (
    <div className="overflow-hidden rounded-lg border border-line-hair">
      <Table>
        <TableHead>
          <tr>
            <TableHeaderCell className="px-4">Description</TableHeaderCell>
            <TableHeaderCell align="right" className="px-4">Qty</TableHeaderCell>
            <TableHeaderCell align="right" className="px-4">Rate</TableHeaderCell>
            <TableHeaderCell align="right" className="px-4">Amount</TableHeaderCell>
          </tr>
        </TableHead>
        <TableBody>
          {invoice.lineItems.map((line) => (
            <TableRow key={line.id}>
              <TableCell className="px-4">
                {line.description}
                {line.isVariation ? <span className="ml-2 text-xs text-accent-500">Variation</span> : null}
              </TableCell>
              <TableCell align="right" className="px-4 tabular-nums">
                {line.quantity ?? "—"}
                {line.unit ? ` ${line.unit}` : ""}
              </TableCell>
              <TableCell align="right" className="px-4 tabular-nums">{formatCurrency(line.unitRate, currency)}</TableCell>
              <TableCell align="right" className="px-4 font-medium tabular-nums">{formatCurrency(line.amount, currency)}</TableCell>
            </TableRow>
          ))}
          <TableRow tone="total">
            <TableCell colSpan={3} className="px-4">Subtotal</TableCell>
            <TableCell align="right" className="px-4 tabular-nums">{formatCurrency(invoice.subtotal, currency)}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

InvoiceLineItemsPanel.displayName = "InvoiceLineItemsPanel";

export function InvoicePaymentsPanel({ projectId, invoice, currency, canManage }: PanelProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const removePayment = useDeleteInvoicePayment();
  const fixedInvoice = useMemo(() => [invoice], [invoice]);

  function handleRemove(): void {
    if (!removeId) return;
    removePayment.mutate(
      { projectId, invoiceId: invoice.id, paymentId: removeId },
      {
        onSuccess: () => setRemoveId(null),
        onError: (error) => toast(getApiErrorMessage(error, "Could not remove the payment")),
      },
    );
  }

  return (
    <>
      <section>
        <DrawerSectionTitle
          actions={
            canManage ? (
              <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
                Add payment
              </Button>
            ) : undefined
          }
        >
          Payments · {formatCurrency(invoice.amountPaid, currency)} of {formatCurrency(invoice.totalInvoiced, currency)}
        </DrawerSectionTitle>
        {invoice.payments.length === 0 ? (
          <p className="mt-3 rounded-lg bg-surface-alt p-4 text-sm text-ink-muted">No payments recorded yet.</p>
        ) : (
          <div className="mt-3 overflow-hidden rounded-lg border border-line-hair">
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell className="px-4">Date</TableHeaderCell>
                  <TableHeaderCell align="right" className="px-4">Amount</TableHeaderCell>
                  <TableHeaderCell className="px-4">Method</TableHeaderCell>
                  <TableHeaderCell className="px-4">Note</TableHeaderCell>
                  {canManage ? <TableHeaderCell className="w-[80px] px-4" /> : null}
                </tr>
              </TableHead>
              <TableBody>
                {invoice.payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="whitespace-nowrap px-4">{payment.paidAt ?? "—"}</TableCell>
                    <TableCell align="right" className="px-4 font-medium tabular-nums">{formatCurrency(payment.amount, currency)}</TableCell>
                    <TableCell className="px-4">{payment.method}</TableCell>
                    <TableCell className="px-4 text-gray-600">{payment.note ?? "—"}</TableCell>
                    {canManage ? (
                      <TableCell align="right" className="px-4">
                        <Button type="button" variant="danger" size="sm" onClick={() => setRemoveId(payment.id)}>
                          Remove
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <AddPaymentDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
        currency={currency}
        invoices={fixedInvoice}
        invoiceId={invoice.id}
      />

      <ConfirmDialog
        open={removeId !== null}
        onOpenChange={(next) => {
          if (!next) setRemoveId(null);
        }}
        title="Remove this payment?"
        description="The payment will be removed and the balance due recalculated."
        confirmLabel="Remove payment"
        variant="danger"
        loading={removePayment.isPending}
        onConfirm={handleRemove}
      />
    </>
  );
}

InvoicePaymentsPanel.displayName = "InvoicePaymentsPanel";
