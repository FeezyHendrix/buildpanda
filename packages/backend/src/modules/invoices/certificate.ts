import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { Money } from "../../lib/money.ts";
import type { ContractTerms } from "../finances/types.ts";
import { seedCertificate } from "./ipc-seeding.ts";
import { num, toInvoice } from "./invoice-mapper.ts";
import { toWorkflowStatus } from "./invoice-status.ts";
import { assertDeletable, assertPaymentAllowed } from "./payment-guards.ts";
import type { InvoiceCertificateRepository } from "./certificate-repository.ts";
import type { InvoicesRepository } from "./repository.ts";
import type {
  AddPaymentInput,
  Invoice,
  InvoiceCertificate,
  InvoiceEvent,
  InvoiceEventType,
  InvoiceRow,
  QueryInvoiceInput,
  VoidInvoiceInput,
} from "./types.ts";

export interface CertificateActor {
  id: string;
  name: string;
}

export interface CertificateDeps {
  invoices: InvoicesRepository;
  certificates: InvoiceCertificateRepository;
  /** Contract terms for the project, from the finances module. */
  terms: (projectId: string) => Promise<ContractTerms | null>;
  /** Adjusted contract value, for the retention cap. */
  adjustedContract: (projectId: string) => Promise<number>;
  /** Fired after a status change so the project team hears about it. */
  onEvent?: (
    projectId: string,
    invoice: InvoiceRow,
    type: InvoiceEventType,
    actor: CertificateActor,
    reason: string | null,
  ) => void;
}

/**
 * The certificate lifecycle: issuing, querying, certifying, voiding, and the
 * receipts recorded against it.
 *
 * Every one of those is an EVENT with an actor, a timestamp and — where the
 * contract demands it — a reason. A client query is a formal dispute, an
 * approval is a certification, and a voided certificate stays on the record
 * with its figures reversed. Nothing here moves money: a payment is a log of a
 * transfer a human made off-platform.
 */
export function invoiceCertificateService(deps: CertificateDeps) {
  async function owned(projectId: string, invoiceId: string): Promise<InvoiceRow> {
    const row = await deps.invoices.findById(invoiceId);
    if (!row || row.project_id !== projectId) throw new NotFoundError("Invoice");
    return row;
  }

  async function build(row: InvoiceRow): Promise<Invoice> {
    const [payments, items, events] = await Promise.all([
      deps.invoices.listPaymentsForInvoices([row.id]),
      deps.invoices.listItemsForInvoices([row.id]),
      deps.certificates.listEvents(row.id),
    ]);
    return toInvoice(row, payments, items, events);
  }

  async function record(
    row: InvoiceRow,
    type: InvoiceEventType,
    actor: CertificateActor,
    detail: { fromStatus?: string | null; toStatus?: string | null; reason?: string | null; amount?: number | null } = {},
  ): Promise<void> {
    // The trail is best-effort: losing an audit row must never undo the action
    // the user actually took.
    try {
      await deps.certificates.insertEvent({
        id: generateId("invev"),
        invoice_id: row.id,
        project_id: row.project_id,
        type,
        from_status: detail.fromStatus ?? null,
        to_status: detail.toStatus ?? null,
        reason: detail.reason ?? null,
        actor_id: actor.id,
        actor_name: actor.name,
        amount: detail.amount === undefined || detail.amount === null ? null : String(detail.amount),
      });
    } catch {
      void 0;
    }
    deps.onEvent?.(row.project_id, row, type, actor, detail.reason ?? null);
  }

  return {
    /** The invoice with its audit trail attached. */
    async get(projectId: string, invoiceId: string): Promise<Invoice> {
      return build(await owned(projectId, invoiceId));
    },

    async history(projectId: string, invoiceId: string): Promise<InvoiceEvent[]> {
      return (await build(await owned(projectId, invoiceId))).history;
    },

    /** Records a status change that already happened on the row. */
    async logStatusChange(
      row: InvoiceRow,
      type: InvoiceEventType,
      actor: CertificateActor,
      fromStatus: string,
      toStatus: string,
      reason?: string | null,
    ): Promise<void> {
      await record(row, type, actor, { fromStatus, toStatus, reason: reason ?? null });
    },

    /**
     * A client query holds the certificate. It always carries a reason: "the
     * measurement for culvert 2 is disputed" is the record a QS answers, and
     * "Queried" on its own is not.
     */
    async query(
      projectId: string,
      invoiceId: string,
      input: QueryInvoiceInput,
      actor: CertificateActor,
    ): Promise<Invoice> {
      const row = await owned(projectId, invoiceId);
      const reason = input.reason?.trim();
      if (!reason) throw new BadRequestError("A query on a certificate needs a reason");
      const from = toWorkflowStatus(row.status);
      if (from !== "Sent" && from !== "Submitted" && from !== "Approved") {
        throw new BadRequestError(`A ${from} invoice cannot be queried — it has not been issued`);
      }
      const updated = await deps.invoices.update(invoiceId, { status: "Queried" });
      if (!updated) throw new NotFoundError("Invoice");
      await record(updated, "queried", actor, { fromStatus: from, toStatus: "Queried", reason });
      return build(updated);
    },

    /**
     * Voiding keeps the certificate and its receipts on the record and takes it
     * out of every figure — the honest alternative to deleting a paid
     * accounting record.
     */
    async void(
      projectId: string,
      invoiceId: string,
      input: VoidInvoiceInput,
      actor: CertificateActor,
    ): Promise<Invoice> {
      const row = await owned(projectId, invoiceId);
      const reason = input.reason?.trim();
      if (!reason) throw new BadRequestError("Voiding a certificate needs a reason");
      if (row.voided_at) throw new BadRequestError("This invoice is already voided");
      const updated = await deps.invoices.update(invoiceId, {
        voided_at: new Date(),
        voided_by_id: actor.id,
        void_reason: reason,
      });
      if (!updated) throw new NotFoundError("Invoice");
      await record(updated, "voided", actor, {
        fromStatus: toWorkflowStatus(row.status),
        toStatus: "Void",
        reason,
        amount: num(row.net_payable),
      });
      return build(updated);
    },

    /** Deleting is refused once money has been recorded; void instead. */
    async assertRemovable(projectId: string, invoiceId: string): Promise<void> {
      const row = await owned(projectId, invoiceId);
      assertDeletable(row, await deps.certificates.countPayments(invoiceId));
    },

    async addPayment(
      projectId: string,
      invoiceId: string,
      input: AddPaymentInput,
      actor: CertificateActor,
    ): Promise<Invoice> {
      const row = await owned(projectId, invoiceId);
      const current = await build(row);
      const guard = assertPaymentAllowed(row, input, current.balanceDue);
      await deps.invoices.createPayment({
        id: generateId("pay"),
        invoice_id: invoiceId,
        amount: String(input.amount),
        method: input.method ?? "Bank Transfer",
        paid_at: input.paidAt?.trim() || null,
        note: input.note?.trim() || null,
        credit: guard.credit,
        recorded_by_id: actor.id,
      });
      await record(row, "payment_recorded", actor, {
        amount: input.amount,
        reason: guard.credit ? `Overpayment recorded as a credit — ${input.note?.trim() ?? ""}` : null,
      });
      return build(await owned(projectId, invoiceId));
    },

    async removePayment(
      projectId: string,
      invoiceId: string,
      paymentId: string,
      actor: CertificateActor,
    ): Promise<Invoice> {
      const row = await owned(projectId, invoiceId);
      const payment = await deps.invoices.findPayment(paymentId);
      if (!payment || payment.invoice_id !== invoiceId) throw new NotFoundError("Payment");
      await deps.invoices.deletePayment(paymentId);
      await record(row, "payment_removed", actor, { amount: num(payment.amount) });
      return build(row);
    },

    /**
     * The certificate structure this month's billed lines produce under the
     * contract — previous / this / cumulative with the contract's retention,
     * VAT and advance recovery, rather than a form's defaults.
     */
    async seed(
      projectId: string,
      contractId: string | null,
      lines: { quantity?: number; unitRate?: number }[],
      excludeInvoiceId?: string,
    ): Promise<InvoiceCertificate | null> {
      const terms = await deps.terms(projectId);
      if (!terms) return null;
      const [priorRows, advance, adjustedContract] = await Promise.all([
        deps.certificates.listCertificates(projectId, contractId),
        deps.certificates.advancePosition(projectId),
        deps.adjustedContract(projectId),
      ]);
      const prior = priorRows.filter((r) => r.id !== excludeInvoiceId);
      const previousCertified = Money.sum(prior.map((r) => num(r.subtotal))).round(2).toNumber();
      const retentionHeldToDate = Money.sum(prior.map((r) => num(r.retention_amount)))
        .round(2)
        .toNumber();
      return seedCertificate(terms, {
        lines: lines.map((line) => ({
          description: "",
          quantity: line.quantity ?? 1,
          unitRate: line.unitRate ?? 0,
        })),
        previousCertified,
        retentionHeldToDate,
        advancePaid: Number(advance.paid),
        advanceRecoveredToDate: Number(advance.recovered),
        certificateNumber: prior.length + 1,
        adjustedContract,
      });
    },
  };
}

export type InvoiceCertificateService = ReturnType<typeof invoiceCertificateService>;
