import type { Knex } from "knex";
import type { InvoiceEventRow, InvoiceRow, NewInvoiceEventRecord } from "./types.ts";

/**
 * The certificate-side reads: the audit trail of status changes, the ordinal
 * and running totals of the certificates already raised on a contract, and the
 * advance position they recover against. Split from the main invoice
 * repository so each file keeps one concern.
 */
export function invoiceCertificateRepository(db: Knex) {
  return {
    listEvents(invoiceId: string): Promise<InvoiceEventRow[]> {
      return db<InvoiceEventRow>("invoice_events")
        .where({ invoice_id: invoiceId })
        .orderBy("created_at", "asc");
    },

    listEventsForInvoices(invoiceIds: string[]): Promise<InvoiceEventRow[]> {
      if (invoiceIds.length === 0) return Promise.resolve([]);
      return db<InvoiceEventRow>("invoice_events")
        .whereIn("invoice_id", invoiceIds)
        .orderBy("created_at", "asc");
    },

    async insertEvent(record: NewInvoiceEventRecord): Promise<void> {
      await db("invoice_events").insert(record);
    },

    /**
     * Certificates already raised on this contract, oldest first — the ordinal
     * of the next one (IPC 2 …) and the gross already certified come from here.
     */
    listCertificates(projectId: string, contractId: string | null): Promise<InvoiceRow[]> {
      return db<InvoiceRow>("project_invoices")
        .where({ project_id: projectId, direction: "receivable" })
        .modify((q) => {
          if (contractId) q.where({ contract_id: contractId });
        })
        .whereNull("voided_at")
        .whereIn("invoice_type", ["progress", "final"])
        .orderBy([{ column: "billing_period", order: "asc" }, { column: "created_at", order: "asc" }]);
    },

    /** The advance certified on this project and what has been recovered so far. */
    async advancePosition(projectId: string): Promise<{ paid: string; recovered: string }> {
      const [advance, recovered] = await Promise.all([
        db("project_invoices")
          .where({ project_id: projectId, invoice_type: "advance", direction: "receivable" })
          .whereNull("voided_at")
          .select(db.raw("COALESCE(SUM(subtotal), 0)::text as total"))
          .first<{ total: string }>(),
        db("project_invoices")
          .where({ project_id: projectId, direction: "receivable" })
          .whereNull("voided_at")
          .select(db.raw("COALESCE(SUM(advance_recovery), 0)::text as total"))
          .first<{ total: string }>(),
      ]);
      return { paid: advance?.total ?? "0", recovered: recovered?.total ?? "0" };
    },

    /** The main contract of a project — the default a certificate bills against. */
    async mainContractId(projectId: string): Promise<string | null> {
      const row = await db("project_contracts")
        .where({ project_id: projectId, kind: "main" })
        .select("id")
        .first<{ id: string }>();
      return row?.id ?? null;
    },

    /** The live certificate raised for a billing month, if one exists. */
    async certificateForPeriod(
      projectId: string,
      period: string,
    ): Promise<{ id: string; number: string | null } | undefined> {
      return db("project_invoices")
        .where({ project_id: projectId, billing_period: period, direction: "receivable" })
        .whereNull("voided_at")
        .select("id", "number")
        .first<{ id: string; number: string | null }>();
    },

    async countPayments(invoiceId: string): Promise<number> {
      const row = await db("invoice_payments")
        .where({ invoice_id: invoiceId })
        .count<{ count: string }[]>("id as count");
      return Number(row[0]?.count ?? 0);
    },
  };
}

export type InvoiceCertificateRepository = ReturnType<typeof invoiceCertificateRepository>;
