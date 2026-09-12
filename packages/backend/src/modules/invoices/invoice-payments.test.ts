import { test } from "node:test";
import assert from "node:assert/strict";
import { invoicePaymentsService } from "./invoice-payments.ts";
import { toInvoice } from "./invoice-mapper.ts";
import type { Invoice, InvoicePaymentRow, InvoiceRow } from "./types.ts";

function invoiceRow(over: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "inv_1",
    project_id: "prj_1",
    invoice_type: "progress",
    vendor_name: "Panda Builders",
    trade: "Main works",
    number: "INV-001",
    status: "Submitted",
    currency: "NGN",
    amount: "1000000.00",
    retainage_percentage: "0",
    vat_rate: "7.5",
    wht_rate: "0",
    retention_rate: "0",
    subtotal: "1000000.00",
    vat_amount: "75000.00",
    wht_amount: "0.00",
    retention_amount: "0.00",
    total_invoiced: "1075000.00",
    net_payable: "1075000.00",
    issue_date: "2026-09-01",
    due_date: "2099-01-01",
    notes: null,
    from_party: null,
    to_party: null,
    recipient_email: null,
    cc_emails: null,
    bcc_emails: null,
    po_reference_id: null,
    payment_claim_id: null,
    milestone_payment_id: null,
    contract_reference: null,
    payment_terms: null,
    payment_instructions: null,
    cover_note: null,
    header_text: null,
    footer_text: null,
    source_file_id: null,
    sent_at: null,
    sent_to: null,
    public_token: null,
    viewed_at: null,
    pdf_storage_key: null,
    billing_period: "2026-09",
    created_at: "2026-09-01T00:00:00.000Z",
    ...over,
  };
}

function payment(id: string, invoiceId: string, amount: string): InvoicePaymentRow {
  return { id, invoice_id: invoiceId, amount, method: "Bank Transfer", paid_at: "2026-09-10", note: null, created_at: "t" };
}

const first = toInvoice(invoiceRow(), [payment("pay_1", "inv_1", "400000.00")], []);
const second = toInvoice(
  invoiceRow({ id: "inv_2", number: "INV-002", status: "Approved", billing_period: null }),
  [payment("pay_2", "inv_2", "500000.00"), payment("pay_3", "inv_2", "575000.00")],
  [],
);

function fakeInvoices(list: Invoice[]) {
  return {
    listByProject: async () => list,
    get: async (_projectId: string, id: string) => {
      const found = list.find((i) => i.id === id);
      if (!found) throw new Error("not found");
      return found;
    },
  };
}

test("the invoice DTO carries the ladder and the billing month", () => {
  assert.equal(first.workflowStatus, "Sent");
  assert.equal(first.status, "PartiallyPaid");
  assert.deepEqual(first.nextStatuses, ["Approved", "Queried"]);
  assert.equal(first.budgetMonth, "2026-09");
  assert.equal(second.status, "Paid");
  assert.deepEqual(second.nextStatuses, []);
  assert.equal(second.budgetMonth, null);
});

test("overview nests every invoice's payments and totals invoiced / paid / outstanding", async () => {
  const svc = invoicePaymentsService(fakeInvoices([first, second]));
  const overview = await svc.overview("prj_1");
  assert.equal(overview.invoices.length, 2);
  assert.deepEqual(
    overview.invoices.map((i) => [i.id, i.payments.length, i.amountPaid, i.balanceDue]),
    [["inv_1", 1, 400_000, 675_000], ["inv_2", 2, 1_075_000, 0]],
  );
  assert.deepEqual(overview.totals, { invoiced: 2_150_000, paid: 1_475_000, outstanding: 675_000 });
});

test("listForInvoice returns just that invoice's recorded payments", async () => {
  const svc = invoicePaymentsService(fakeInvoices([first, second]));
  const payments = await svc.listForInvoice("prj_1", "inv_2");
  assert.deepEqual(payments.map((p) => p.id), ["pay_2", "pay_3"]);
});
