import type { Knex } from "knex";
import type {
  InvoiceLineItemRow,
  InvoiceParty,
  InvoicePaymentRow,
  InvoiceRow,
  InvoiceType,
  PaymentMethod,
  StoredInvoiceStatus,
} from "./types.ts";

export interface NewInvoiceRecord {
  id: string;
  project_id: string;
  invoice_type: InvoiceType;
  vendor_name: string;
  trade: string;
  number: string | null;
  status: StoredInvoiceStatus;
  currency: string;
  amount: string;
  retainage_percentage: string;
  vat_rate: string;
  wht_rate: string;
  retention_rate: string;
  subtotal: string;
  vat_amount: string;
  wht_amount: string;
  retention_amount: string;
  total_invoiced: string;
  net_payable: string;
  issue_date: string | null;
  due_date: string | null;
  notes: string | null;
  from_party: InvoiceParty | null;
  to_party: InvoiceParty | null;
  recipient_email: string | null;
  cc_emails: string[] | string | null;
  bcc_emails: string[] | string | null;
  po_reference_id: string | null;
  payment_claim_id: string | null;
  milestone_payment_id: string | null;
  contract_reference: string | null;
  payment_terms: string | null;
  payment_instructions: string | null;
  cover_note: string | null;
  header_text: string | null;
  footer_text: string | null;
  source_file_id: string | null;
}

export interface InvoiceUpdatePatch {
  invoice_type?: InvoiceType;
  vendor_name?: string;
  trade?: string;
  number?: string | null;
  status?: StoredInvoiceStatus;
  currency?: string;
  amount?: string;
  retainage_percentage?: string;
  vat_rate?: string;
  wht_rate?: string;
  retention_rate?: string;
  subtotal?: string;
  vat_amount?: string;
  wht_amount?: string;
  retention_amount?: string;
  total_invoiced?: string;
  net_payable?: string;
  issue_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  from_party?: InvoiceParty | null;
  to_party?: InvoiceParty | null;
  recipient_email?: string | null;
  cc_emails?: string[] | string | null;
  bcc_emails?: string[] | string | null;
  po_reference_id?: string | null;
  payment_claim_id?: string | null;
  milestone_payment_id?: string | null;
  contract_reference?: string | null;
  payment_terms?: string | null;
  payment_instructions?: string | null;
  cover_note?: string | null;
  header_text?: string | null;
  footer_text?: string | null;
  sent_at?: Date | string | null;
  sent_to?: unknown | null;
  public_token?: string | null;
  viewed_at?: Date | string | null;
  pdf_storage_key?: string | null;
}

export interface InvoiceOrganizationRow {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  tin: string | null;
  firs_number: string | null;
  bank_details: unknown | null;
  logo_file_id: string | null;
  default_currency: string | null;
}

export interface NewInvoiceLineItemRecord {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: string;
  unit: string | null;
  unit_rate: string;
  amount: string;
  budget_category_id: string | null;
  is_variation: boolean;
}

export interface NewPaymentRecord {
  id: string;
  invoice_id: string;
  amount: string;
  method: PaymentMethod;
  paid_at: string | null;
  note: string | null;
}

export interface InvoiceOrgDefaultsRow {
  default_currency: string | null;
  default_tax_pct: string | null;
  default_wht_pct: string | null;
  default_retention_pct: string | null;
}

export function invoicesRepository(db: Knex) {
  function jsonbArray(value: string[] | string | null | undefined): string | null | undefined {
    if (value === undefined || value === null || typeof value === "string") return value;
    return JSON.stringify(value);
  }

  function prepareRecord(record: NewInvoiceRecord): NewInvoiceRecord {
    return {
      ...record,
      cc_emails: jsonbArray(record.cc_emails) ?? null,
      bcc_emails: jsonbArray(record.bcc_emails) ?? null,
    };
  }

  function preparePatch(patch: InvoiceUpdatePatch): InvoiceUpdatePatch {
    return {
      ...patch,
      cc_emails: jsonbArray(patch.cc_emails),
      bcc_emails: jsonbArray(patch.bcc_emails),
    };
  }

  return {
    listByProject(projectId: string): Promise<InvoiceRow[]> {
      return db<InvoiceRow>("project_invoices")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc");
    },

    findById(id: string): Promise<InvoiceRow | undefined> {
      return db<InvoiceRow>("project_invoices").where({ id }).first();
    },

    findByPublicToken(token: string): Promise<InvoiceRow | undefined> {
      return db<InvoiceRow>("project_invoices").where({ public_token: token }).first();
    },

    async organizationForProject(projectId: string): Promise<InvoiceOrganizationRow | undefined> {
      return db("projects as p")
        .leftJoin("organization as o", "o.id", "p.organization_id")
        .where("p.id", projectId)
        .select(
          "o.id",
          "o.name",
          "o.address",
          "o.phone",
          "o.tin",
          "o.firs_number",
          "o.bank_details",
          "o.logo_file_id",
          "o.default_currency",
        )
        .first<InvoiceOrganizationRow>();
    },

    listPaymentsForInvoices(invoiceIds: string[]): Promise<InvoicePaymentRow[]> {
      if (invoiceIds.length === 0) return Promise.resolve([]);
      return db<InvoicePaymentRow>("invoice_payments")
        .whereIn("invoice_id", invoiceIds)
        .orderBy("created_at", "asc");
    },

    listItemsForInvoices(invoiceIds: string[]): Promise<InvoiceLineItemRow[]> {
      if (invoiceIds.length === 0) return Promise.resolve([]);
      return db<InvoiceLineItemRow>("project_invoice_line_items")
        .whereIn("invoice_id", invoiceIds)
        .orderBy([{ column: "invoice_id", order: "asc" }, { column: "position", order: "asc" }]);
    },

    async orgDefaultsForProject(projectId: string): Promise<InvoiceOrgDefaultsRow | undefined> {
      return db("projects as p")
        .leftJoin("organization as o", "o.id", "p.organization_id")
        .where("p.id", projectId)
        .select(
          "o.default_currency",
          "o.default_tax_pct",
          "o.default_wht_pct",
          "o.default_retention_pct",
        )
        .first<InvoiceOrgDefaultsRow>();
    },

    findPayment(paymentId: string): Promise<InvoicePaymentRow | undefined> {
      return db<InvoicePaymentRow>("invoice_payments").where({ id: paymentId }).first();
    },

    async create(
      record: NewInvoiceRecord,
      items: NewInvoiceLineItemRecord[],
    ): Promise<InvoiceRow> {
      return db.transaction(async (trx) => {
        const [row] = await trx("project_invoices").insert(prepareRecord(record)).returning<InvoiceRow[]>("*");
        if (!row) throw new Error("Failed to insert invoice");
        if (items.length > 0) await trx("project_invoice_line_items").insert(items);
        return row;
      });
    },

    async update(
      id: string,
      patch: InvoiceUpdatePatch,
      items?: NewInvoiceLineItemRecord[],
    ): Promise<InvoiceRow | undefined> {
      return db.transaction(async (trx) => {
        const [row] = await trx("project_invoices")
          .where({ id })
          .update(preparePatch(patch))
          .returning<InvoiceRow[]>("*");
        if (!row) return undefined;
        if (items !== undefined) {
          await trx("project_invoice_line_items").where({ invoice_id: id }).delete();
          if (items.length > 0) await trx("project_invoice_line_items").insert(items);
        }
        return row;
      });
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

    listAllocations(invoiceId: string): Promise<InvoiceAllocationRow[]> {
      return db<InvoiceAllocationRow>("invoice_budget_allocations")
        .where({ invoice_id: invoiceId })
        .select("id", "invoice_id", "budget_category_id", "amount");
    },

    async replaceAllocations(
      invoiceId: string,
      allocations: NewInvoiceAllocationRecord[],
    ): Promise<void> {
      await db.transaction(async (trx) => {
        await trx("invoice_budget_allocations")
          .where({ invoice_id: invoiceId })
          .delete();
        if (allocations.length > 0) {
          await trx("invoice_budget_allocations").insert(allocations);
        }
      });
    },
  };
}

export interface InvoiceAllocationRow {
  id: string;
  invoice_id: string;
  budget_category_id: string;
  amount: string;
}

export interface NewInvoiceAllocationRecord {
  id: string;
  invoice_id: string;
  budget_category_id: string;
  amount: string;
}

export type InvoicesRepository = ReturnType<typeof invoicesRepository>;
