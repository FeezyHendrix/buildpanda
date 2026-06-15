import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { InvoicesRepository } from "./repository.ts";
import type {
  Invoice,
  InvoiceBudgetAllocation,
  InvoicePayment,
  InvoicePaymentRow,
  InvoiceRow,
  InvoiceStatus,
  PaymentMethod,
} from "./types.ts";

export interface CreateInvoiceInput {
  vendorName: string;
  trade: string;
  number?: string;
  status?: InvoiceStatus;
  amount: number;
  retainagePercentage?: number;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
}

export interface EditInvoiceInput {
  vendorName?: string;
  trade?: string;
  number?: string;
  status?: InvoiceStatus;
  amount?: number;
  retainagePercentage?: number;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
}

export interface AddPaymentInput {
  amount: number;
  method?: PaymentMethod;
  paidAt?: string;
  note?: string;
}

function num(value: string): number {
  return Number(value);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function optional(value: string | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toPayment(row: InvoicePaymentRow): InvoicePayment {
  return {
    id: row.id,
    amount: num(row.amount),
    method: row.method,
    paidAt: row.paid_at,
    note: row.note,
  };
}

function toInvoice(row: InvoiceRow, paymentRows: InvoicePaymentRow[]): Invoice {
  const amount = num(row.amount);
  const retainagePercentage = num(row.retainage_percentage);
  const retainageAmount = round2((amount * retainagePercentage) / 100);
  const payableAmount = round2(amount - retainageAmount);
  const payments = paymentRows.map(toPayment);
  const amountPaid = round2(payments.reduce((sum, p) => sum + p.amount, 0));
  const balanceDue = round2(payableAmount - amountPaid);

  return {
    id: row.id,
    vendorName: row.vendor_name,
    trade: row.trade,
    number: row.number,
    status: row.status,
    amount,
    retainagePercentage,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    notes: row.notes,
    retainageAmount,
    payableAmount,
    amountPaid,
    balanceDue,
    payments,
  };
}

export function invoicesService(repository: InvoicesRepository) {
  async function buildInvoice(row: InvoiceRow): Promise<Invoice> {
    const payments = await repository.listPaymentsForInvoices([row.id]);
    return toInvoice(row, payments);
  }

  async function getOwnedInvoice(
    projectId: string,
    invoiceId: string,
  ): Promise<InvoiceRow> {
    const existing = await repository.findById(invoiceId);
    if (!existing || existing.project_id !== projectId) {
      throw new NotFoundError("Invoice");
    }
    return existing;
  }

  return {
    async listByProject(projectId: string): Promise<Invoice[]> {
      const rows = await repository.listByProject(projectId);
      const paymentRows = await repository.listPaymentsForInvoices(
        rows.map((r) => r.id),
      );
      const grouped = new Map<string, InvoicePaymentRow[]>();
      for (const payment of paymentRows) {
        const bucket = grouped.get(payment.invoice_id);
        if (bucket) bucket.push(payment);
        else grouped.set(payment.invoice_id, [payment]);
      }
      return rows.map((row) => toInvoice(row, grouped.get(row.id) ?? []));
    },

    async create(projectId: string, input: CreateInvoiceInput): Promise<Invoice> {
      if (input.amount < 0) throw new BadRequestError("Invoice amount cannot be negative");
      const retainage = input.retainagePercentage ?? 0;
      if (retainage < 0 || retainage > 100) {
        throw new BadRequestError("Retainage must be between 0 and 100");
      }
      const row = await repository.create({
        id: generateId("inv"),
        project_id: projectId,
        vendor_name: input.vendorName.trim(),
        trade: input.trade.trim(),
        number: optional(input.number) ?? null,
        status: input.status ?? "Draft",
        amount: String(input.amount),
        retainage_percentage: String(retainage),
        issue_date: optional(input.issueDate) ?? null,
        due_date: optional(input.dueDate) ?? null,
        notes: optional(input.notes) ?? null,
      });
      return buildInvoice(row);
    },

    async edit(
      projectId: string,
      invoiceId: string,
      input: EditInvoiceInput,
    ): Promise<Invoice> {
      await getOwnedInvoice(projectId, invoiceId);
      if (input.amount !== undefined && input.amount < 0) {
        throw new BadRequestError("Invoice amount cannot be negative");
      }
      if (
        input.retainagePercentage !== undefined &&
        (input.retainagePercentage < 0 || input.retainagePercentage > 100)
      ) {
        throw new BadRequestError("Retainage must be between 0 and 100");
      }

      const patch: Parameters<typeof repository.update>[1] = {};
      if (input.vendorName !== undefined) patch.vendor_name = input.vendorName.trim();
      if (input.trade !== undefined) patch.trade = input.trade.trim();
      if (input.number !== undefined) patch.number = optional(input.number) ?? null;
      if (input.status !== undefined) patch.status = input.status;
      if (input.amount !== undefined) patch.amount = String(input.amount);
      if (input.retainagePercentage !== undefined) {
        patch.retainage_percentage = String(input.retainagePercentage);
      }
      if (input.issueDate !== undefined) patch.issue_date = optional(input.issueDate) ?? null;
      if (input.dueDate !== undefined) patch.due_date = optional(input.dueDate) ?? null;
      if (input.notes !== undefined) patch.notes = optional(input.notes) ?? null;

      const row = await repository.update(invoiceId, patch);
      if (!row) throw new NotFoundError("Invoice");
      return buildInvoice(row);
    },

    async remove(projectId: string, invoiceId: string): Promise<void> {
      await getOwnedInvoice(projectId, invoiceId);
      const deleted = await repository.deleteInvoice(invoiceId);
      if (deleted === 0) throw new NotFoundError("Invoice");
    },

    async addPayment(
      projectId: string,
      invoiceId: string,
      input: AddPaymentInput,
    ): Promise<Invoice> {
      await getOwnedInvoice(projectId, invoiceId);
      if (input.amount <= 0) {
        throw new BadRequestError("Payment amount must be positive");
      }
      await repository.createPayment({
        id: generateId("pay"),
        invoice_id: invoiceId,
        amount: String(input.amount),
        method: input.method ?? "Bank Transfer",
        paid_at: optional(input.paidAt) ?? null,
        note: optional(input.note) ?? null,
      });
      const row = await getOwnedInvoice(projectId, invoiceId);
      return buildInvoice(row);
    },

    async removePayment(
      projectId: string,
      invoiceId: string,
      paymentId: string,
    ): Promise<Invoice> {
      const row = await getOwnedInvoice(projectId, invoiceId);
      const payment = await repository.findPayment(paymentId);
      if (!payment || payment.invoice_id !== invoiceId) {
        throw new NotFoundError("Payment");
      }
      await repository.deletePayment(paymentId);
      return buildInvoice(row);
    },

    async getAllocations(
      projectId: string,
      invoiceId: string,
    ): Promise<InvoiceBudgetAllocation[]> {
      await getOwnedInvoice(projectId, invoiceId);
      const rows = await repository.listAllocations(invoiceId);
      return rows.map((r) => ({
        budgetCategoryId: r.budget_category_id,
        amount: Number(r.amount),
      }));
    },

    async setAllocations(
      projectId: string,
      invoiceId: string,
      allocations: InvoiceBudgetAllocation[],
    ): Promise<InvoiceBudgetAllocation[]> {
      const row = await getOwnedInvoice(projectId, invoiceId);
      const total = allocations.reduce((sum, a) => sum + a.amount, 0);
      if (total > Number(row.amount) + 0.01) {
        throw new BadRequestError(
          "Allocated amount exceeds the invoice amount",
        );
      }
      await repository.replaceAllocations(
        invoiceId,
        allocations.map((a) => ({
          id: generateId("inva"),
          invoice_id: invoiceId,
          budget_category_id: a.budgetCategoryId,
          amount: String(a.amount),
        })),
      );
      return this.getAllocations(projectId, invoiceId);
    },
  };
}

export type InvoicesService = ReturnType<typeof invoicesService>;
