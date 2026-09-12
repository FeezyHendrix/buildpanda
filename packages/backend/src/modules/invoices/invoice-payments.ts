import { Money } from "../../lib/money.ts";
import type { InvoicesService } from "./service.ts";
import type { Invoice, InvoicePayment, InvoicePaymentsOverview, InvoiceWithPayments } from "./types.ts";

/**
 * The Payments tab: every invoice as a parent row with its recorded payments
 * nested, plus the invoiced / paid / outstanding totals. Reads through the
 * invoices service so the derived figures stay the single computation.
 */
export function invoicePaymentsService(invoices: Pick<InvoicesService, "listByProject" | "get">) {
  function parentRow(invoice: Invoice): InvoiceWithPayments {
    return {
      id: invoice.id,
      number: invoice.number,
      vendorName: invoice.vendorName,
      invoiceType: invoice.invoiceType,
      status: invoice.status,
      workflowStatus: invoice.workflowStatus,
      currency: invoice.currency,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      budgetMonth: invoice.budgetMonth,
      netPayable: invoice.netPayable,
      amountPaid: invoice.amountPaid,
      balanceDue: invoice.balanceDue,
      payments: invoice.payments,
    };
  }

  return {
    async listForInvoice(projectId: string, invoiceId: string): Promise<InvoicePayment[]> {
      return (await invoices.get(projectId, invoiceId)).payments;
    },

    async overview(projectId: string): Promise<InvoicePaymentsOverview> {
      const rows = (await invoices.listByProject(projectId)).map(parentRow);
      const invoiced = Money.sum(rows.map((row) => row.netPayable)).round(2);
      const paid = Money.sum(rows.map((row) => row.amountPaid)).round(2);
      return {
        invoices: rows,
        totals: {
          invoiced: invoiced.toNumber(),
          paid: paid.toNumber(),
          outstanding: invoiced.sub(paid).round(2).toNumber(),
        },
      };
    },
  };
}

export type InvoicePaymentsService = ReturnType<typeof invoicePaymentsService>;
