import type { Knex } from "knex";
import type {
  InvoicePaymentRow,
  InvoiceRow,
  InvoiceStatus,
  PaymentMethod,
} from "./types.ts";

export interface NewInvoiceRecord {
  id: string;
  project_id: string;
  vendor_name: string;
  trade: string;
  number: string | null;
  status: InvoiceStatus;
  amount: string;
  retainage_percentage: string;
  issue_date: string | null;
  due_date: string | null;
  notes: string | null;
}

export interface InvoiceUpdatePatch {
  vendor_name?: string;
  trade?: string;
  number?: string | null;
  status?: InvoiceStatus;
  amount?: string;
  retainage_percentage?: string;
  issue_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
}

export interface NewPaymentRecord {
  id: string;
  invoice_id: string;
  amount: string;
  method: PaymentMethod;
  paid_at: string | null;
  note: string | null;
}

export function invoicesRepository(db: Knex) {
  return {
    listByProject(projectId: string): Promise<InvoiceRow[]> {
      return db<InvoiceRow>("project_invoices")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    findById(id: string): Promise<InvoiceRow | undefined> {
      return db<InvoiceRow>("project_invoices").where({ id }).first();
    },

    listPaymentsForInvoices(invoiceIds: string[]): Promise<InvoicePaymentRow[]> {
      if (invoiceIds.length === 0) return Promise.resolve([]);
      return db<InvoicePaymentRow>("invoice_payments")
        .whereIn("invoice_id", invoiceIds)
        .orderBy("created_at", "asc");
    },

    findPayment(paymentId: string): Promise<InvoicePaymentRow | undefined> {
      return db<InvoicePaymentRow>("invoice_payments").where({ id: paymentId }).first();
    },

    async create(record: NewInvoiceRecord): Promise<InvoiceRow> {
      const [row] = await db<InvoiceRow>("project_invoices").insert(record).returning("*");
      if (!row) throw new Error("Failed to insert invoice");
      return row;
    },

    async update(
      id: string,
      patch: InvoiceUpdatePatch,
    ): Promise<InvoiceRow | undefined> {
      const [row] = await db<InvoiceRow>("project_invoices")
        .where({ id })
        .update(patch)
        .returning("*");
      return row;
    },

    async deleteInvoice(id: string): Promise<number> {
      return db("project_invoices").where({ id }).delete();
    },

    async createPayment(record: NewPaymentRecord): Promise<InvoicePaymentRow> {
      const [row] = await db<InvoicePaymentRow>("invoice_payments")
        .insert(record)
        .returning("*");
      if (!row) throw new Error("Failed to insert invoice payment");
      return row;
    },

    async deletePayment(paymentId: string): Promise<number> {
      return db("invoice_payments").where({ id: paymentId }).delete();
    },
  };
}

export type InvoicesRepository = ReturnType<typeof invoicesRepository>;
