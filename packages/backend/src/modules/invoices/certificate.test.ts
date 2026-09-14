import { test } from "node:test";
import assert from "node:assert/strict";
import type { ContractTerms } from "../finances/types.ts";
import { invoiceCertificateService } from "./certificate.ts";
import type { InvoiceCertificateRepository } from "./certificate-repository.ts";
import type { InvoicesRepository } from "./repository.ts";
import type {
  InvoiceEventRow,
  InvoiceEventType,
  InvoicePaymentRow,
  InvoiceRow,
  NewInvoiceEventRecord,
} from "./types.ts";

const ACTOR = { id: "usr_qs", name: "QA Reviewer" };

function invoiceRow(over: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    id: "inv_1",
    project_id: "prj_1",
    invoice_type: "progress",
    vendor_name: "Lagos State Ministry of Works",
    trade: "Main works",
    number: "IS2-IPC-001",
    status: "Approved",
    currency: "NGN",
    amount: "20187500.00",
    retainage_percentage: "0",
    vat_rate: "0",
    wht_rate: "0",
    retention_rate: "5",
    subtotal: "20187500.00",
    vat_amount: "0.00",
    wht_amount: "0.00",
    retention_amount: "1009375.00",
    total_invoiced: "20187500.00",
    net_payable: "19178125.00",
    issue_date: "2026-09-08",
    due_date: "2026-09-22",
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
    contract_id: "con_main",
    direction: "receivable",
    counterparty: "Lagos State Ministry of Works",
    advance_recovery: "0.00",
    voided_at: null,
    voided_by_id: null,
    void_reason: null,
    created_at: "2026-09-08T00:00:00.000Z",
    ...over,
  };
}

function terms(): ContractTerms {
  return {
    contractType: "unit_rate",
    retentionRate: 0.05,
    retentionReleaseMode: "staged_pc_dlp",
    retentionCapPercent: 0,
    advancePercentage: 0.1,
    advanceRecoveryMode: "percentage",
    advanceRecoveryRate: 0.1,
    advanceRecoveryFromCertificate: 2,
    paymentTermsDays: 14,
    defectsLiabilityDays: 365,
    defectsPeriodMonths: 12,
    vatRate: 0.075,
    liquidatedDamagesRate: 0,
    liquidatedDamagesCapPercent: 0,
    commencementDate: null,
    completionDate: null,
    employerName: null,
    contractorName: null,
    contractForm: "fidic_red",
    valuationFrequency: "monthly",
    contractNotes: null,
  };
}

function harness(seed = invoiceRow(), payments: InvoicePaymentRow[] = []) {
  let stored = seed;
  const events: NewInvoiceEventRecord[] = [];
  const notified: Array<{ type: InvoiceEventType; reason: string | null }> = [];
  const paymentRows = [...payments];

  const invoices = {
    findById: async (id: string) => (id === stored.id ? stored : undefined),
    listPaymentsForInvoices: async () => paymentRows,
    listItemsForInvoices: async () => [],
    update: async (_id: string, patch: Record<string, unknown>) => {
      stored = { ...stored, ...patch } as InvoiceRow;
      return stored;
    },
    createPayment: async (record: InvoicePaymentRow) => {
      paymentRows.push(record);
      return record;
    },
    findPayment: async (id: string) => paymentRows.find((p) => p.id === id),
    deletePayment: async (id: string) => {
      const index = paymentRows.findIndex((p) => p.id === id);
      if (index >= 0) paymentRows.splice(index, 1);
      return 1;
    },
  } as unknown as InvoicesRepository;

  const certificates = {
    listEvents: async (): Promise<InvoiceEventRow[]> =>
      events.map((e, index) => ({ ...e, created_at: `2026-09-1${index}T00:00:00.000Z` })),
    insertEvent: async (record: NewInvoiceEventRecord) => {
      events.push(record);
    },
    listCertificates: async () => [],
    advancePosition: async () => ({ paid: "85000000", recovered: "0" }),
    certificateForPeriod: async () => undefined,
    countPayments: async () => paymentRows.length,
  } as unknown as InvoiceCertificateRepository;

  const service = invoiceCertificateService({
    invoices,
    certificates,
    terms: async () => terms(),
    adjustedContract: async () => 854_200_000,
    onEvent: (_projectId, _invoice, type, _actor, reason) => notified.push({ type, reason }),
  });

  return { service, events, notified, current: () => stored, payments: paymentRows };
}

test("querying a certificate demands a reason and records who queried it", async () => {
  const { service, events, notified } = harness();
  await assert.rejects(
    service.query("prj_1", "inv_1", { reason: "   " }, ACTOR),
    /needs a reason/i,
  );

  const queried = await service.query(
    "prj_1",
    "inv_1",
    { reason: "Culvert 2 measurement is disputed" },
    ACTOR,
  );
  assert.equal(queried.workflowStatus, "Queried");
  const event = events.at(-1);
  assert.equal(event?.type, "queried");
  assert.equal(event?.reason, "Culvert 2 measurement is disputed");
  assert.equal(event?.actor_name, "QA Reviewer");
  assert.equal(event?.from_status, "Approved");
  // The project hears about a client query, because it is a formal dispute.
  assert.deepEqual(notified.at(-1), {
    type: "queried",
    reason: "Culvert 2 measurement is disputed",
  });
});

test("a draft invoice cannot be queried — there is nothing to dispute yet", async () => {
  const { service } = harness(invoiceRow({ status: "Draft" }));
  await assert.rejects(service.query("prj_1", "inv_1", { reason: "why" }, ACTOR), /has not been issued/i);
});

test("voiding keeps the certificate on the record with its reason and takes it out of the figures", async () => {
  const { service, events, current } = harness();
  await assert.rejects(service.void("prj_1", "inv_1", { reason: "" }, ACTOR), /needs a reason/i);

  const voided = await service.void(
    "prj_1",
    "inv_1",
    { reason: "Raised against the wrong contract" },
    ACTOR,
  );
  assert.equal(voided.status, "Void");
  assert.equal(voided.voidReason, "Raised against the wrong contract");
  assert.ok(voided.voidedAt);
  // The record and its figures survive; only its status changes.
  assert.equal(voided.netPayable, 19_178_125);
  assert.equal(current().void_reason, "Raised against the wrong contract");
  assert.equal(events.at(-1)?.type, "voided");

  await assert.rejects(
    service.void("prj_1", "inv_1", { reason: "again" }, ACTOR),
    /already voided/i,
  );
});

test("the history is the certificate's audit trail, in order, with actor and reason", async () => {
  const { service } = harness();
  await service.query("prj_1", "inv_1", { reason: "Rates disputed" }, ACTOR);
  const history = await service.history("prj_1", "inv_1");
  assert.equal(history.length, 1);
  assert.equal(history[0]?.type, "queried");
  assert.equal(history[0]?.actor.name, "QA Reviewer");
  assert.equal(history[0]?.reason, "Rates disputed");
  assert.equal(history[0]?.toStatus, "Queried");
});

test("recording a payment logs it and an overpayment is stored as a credit", async () => {
  // Due 5 Sept, received 10 Sept: the certificate was settled five days late,
  // and that stays computable from the record afterwards.
  const { service, events, notified } = harness(invoiceRow({ due_date: "2026-09-05" }));
  const paid = await service.addPayment(
    "prj_1",
    "inv_1",
    { amount: 19_178_125, paidAt: "2026-09-10" },
    ACTOR,
  );
  assert.equal(paid.paidLateDays, 5);
  assert.equal(events.at(-1)?.type, "payment_recorded");
  assert.equal(notified.at(-1)?.type, "payment_recorded");

  const withCredit = await service.addPayment(
    "prj_1",
    "inv_1",
    { amount: 1_000_000, allowOverpayment: true, note: "Employer paid IPC-002 early", paidAt: "2026-09-10" },
    ACTOR,
  );
  // The credit never drives the balance negative.
  assert.equal(withCredit.balanceDue, 0);
  assert.equal(withCredit.payments.at(-1)?.credit, true);
});

test("a certificate carrying payments refuses deletion and points at voiding", async () => {
  const { service } = harness();
  await service.addPayment("prj_1", "inv_1", { amount: 1_000, paidAt: "2026-09-10" }, ACTOR);
  await assert.rejects(service.assertRemovable("prj_1", "inv_1"), /void it with a reason/i);
});

test("seeding a certificate reads the contract, and IPC 1 recovers nothing", async () => {
  const { service } = harness();
  const seeded = await service.seed("prj_1", "con_main", [
    { quantity: 1, unitRate: 17_000_000 },
    { quantity: 1, unitRate: 3_187_500 },
  ]);
  assert.equal(seeded?.number, 1);
  assert.equal(seeded?.thisCertificate, 20_187_500);
  assert.equal(seeded?.retention, 1_009_375);
  assert.equal(seeded?.advanceRecovery, 0);
});
