import { config } from "../../config/index.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import type { InvoicesRepository, NewInvoiceLineItemRecord } from "./repository.ts";
import type {
  Invoice,
  InvoiceBudgetAllocation,
  InvoiceLineItem,
  InvoiceLineItemRow,
  InvoiceParty,
  InvoicePayment,
  InvoicePaymentRow,
  InvoiceRow,
  InvoiceStatus,
  InvoiceType,
  PaymentMethod,
  StoredInvoiceStatus,
} from "./types.ts";

export interface InvoicePartyInput {
  name?: string | null;
  address?: string | null;
  tin?: string | null;
  firsNumber?: string | null;
  email?: string | null;
  bank?: {
    accountName?: string | null;
    accountNumber?: string | null;
    bankName?: string | null;
  } | null;
}

export interface InvoiceLineItemInput {
  description: string;
  quantity?: number;
  unit?: string;
  unitRate?: number;
  budgetCategoryId?: string;
  isVariation?: boolean;
}

export interface CreateInvoiceInput {
  vendorName: string;
  trade: string;
  number?: string;
  status?: StoredInvoiceStatus;
  amount?: number;
  retainagePercentage?: number;
  invoiceType?: InvoiceType;
  currency?: string;
  vatRate?: number;
  whtRate?: number;
  retentionRate?: number;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  fromParty?: InvoicePartyInput | null;
  toParty?: InvoicePartyInput | null;
  recipientEmail?: string;
  ccEmails?: string[];
  bccEmails?: string[];
  poReferenceId?: string;
  paymentClaimId?: string;
  milestonePaymentId?: string;
  contractReference?: string;
  paymentTerms?: string;
  coverNote?: string;
  headerText?: string;
  footerText?: string;
  lineItems?: InvoiceLineItemInput[];
}

export interface EditInvoiceInput {
  vendorName?: string;
  trade?: string;
  number?: string;
  status?: StoredInvoiceStatus;
  amount?: number;
  retainagePercentage?: number;
  invoiceType?: InvoiceType;
  currency?: string;
  vatRate?: number;
  whtRate?: number;
  retentionRate?: number;
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  fromParty?: InvoicePartyInput | null;
  toParty?: InvoicePartyInput | null;
  recipientEmail?: string;
  ccEmails?: string[];
  bccEmails?: string[];
  poReferenceId?: string;
  paymentClaimId?: string;
  milestonePaymentId?: string;
  contractReference?: string;
  paymentTerms?: string;
  coverNote?: string;
  headerText?: string;
  footerText?: string;
  lineItems?: InvoiceLineItemInput[];
}

export interface AddPaymentInput {
  amount: number;
  method?: PaymentMethod;
  paidAt?: string;
  note?: string;
}

export interface SendInvoiceInput {
  recipientEmail: string;
  cc?: string[];
  bcc?: string[];
  coverNote?: string;
  headerText?: string;
  footerText?: string;
}

interface MoneySnapshot {
  subtotal: number;
  vatRate: number;
  whtRate: number;
  retentionRate: number;
  vatAmount: number;
  whtAmount: number;
  retentionAmount: number;
  totalInvoiced: number;
  netPayable: number;
}

function num(value: string | null | undefined): number {
  return Number(value ?? 0);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function optional(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function optionalArray(value: string[] | undefined): string[] | null | undefined {
  if (value === undefined) return undefined;
  const clean = value.map((item) => item.trim()).filter(Boolean);
  return clean.length > 0 ? clean : null;
}

function optionalRate(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (value < 0 || value > 100) throw new BadRequestError("Rate must be between 0 and 100");
  return value;
}

function toWorkflowStatus(status: StoredInvoiceStatus | InvoiceStatus | undefined): StoredInvoiceStatus {
  if (status === undefined) return "Draft";
  if (status === "Submitted") return "Sent";
  if (status === "Draft" || status === "Sent" || status === "Approved") return status;
  if (status === "Paid" || status === "PartiallyPaid" || status === "Overdue") return "Approved";
  throw new BadRequestError("Invoice status must be Draft, Sent, or Approved");
}

function toDatabaseStatus(status: StoredInvoiceStatus): StoredInvoiceStatus {
  return status === "Sent" ? "Submitted" : status;
}

function normalizeParty(input: InvoicePartyInput | null | undefined): InvoiceParty | null | undefined {
  if (input === undefined) return undefined;
  if (input === null) return null;
  return {
    name: optional(input.name) ?? null,
    address: optional(input.address) ?? null,
    tin: optional(input.tin) ?? null,
    firsNumber: optional(input.firsNumber) ?? null,
    email: optional(input.email) ?? null,
    bank: {
      accountName: optional(input.bank?.accountName) ?? null,
      accountNumber: optional(input.bank?.accountNumber) ?? null,
      bankName: optional(input.bank?.bankName) ?? null,
    },
  };
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

function toLineItem(row: InvoiceLineItemRow): InvoiceLineItem {
  return {
    id: row.id,
    position: row.position,
    description: row.description,
    quantity: num(row.quantity),
    unit: row.unit,
    unitRate: num(row.unit_rate),
    amount: num(row.amount),
    budgetCategoryId: row.budget_category_id,
    isVariation: row.is_variation,
  };
}

function deriveStatus(
  row: InvoiceRow,
  amountPaid: number,
  balanceDue: number,
  netPayable: number,
): InvoiceStatus {
  const workflowStatus = toWorkflowStatus(row.status);
  if (balanceDue <= 0 && netPayable > 0) return "Paid";
  if (amountPaid > 0) return "PartiallyPaid";
  const dueDate = row.due_date ? new Date(row.due_date) : null;
  if (dueDate && dueDate < new Date() && balanceDue > 0 && workflowStatus !== "Draft") return "Overdue";
  return workflowStatus === "Submitted" ? "Sent" : workflowStatus;
}

function toInvoice(
  row: InvoiceRow,
  paymentRows: InvoicePaymentRow[],
  lineItemRows: InvoiceLineItemRow[],
): Invoice {
  const amount = num(row.amount);
  const retainagePercentage = num(row.retainage_percentage);
  const retainageAmount = round2((amount * retainagePercentage) / 100);
  const payableAmount = round2(amount - retainageAmount);
  const payments = paymentRows.map(toPayment);
  const amountPaid = round2(payments.reduce((sum, p) => sum + p.amount, 0));
  const netPayable = num(row.net_payable);
  const balanceDue = round2(netPayable - amountPaid);
  const workflowStatus = toWorkflowStatus(row.status);

  return {
    id: row.id,
    invoiceType: row.invoice_type,
    vendorName: row.vendor_name,
    trade: row.trade,
    number: row.number,
    status: deriveStatus(row, amountPaid, balanceDue, netPayable),
    workflowStatus,
    currency: row.currency,
    amount,
    retainagePercentage,
    vatRate: num(row.vat_rate),
    whtRate: num(row.wht_rate),
    retentionRate: num(row.retention_rate),
    subtotal: num(row.subtotal),
    vatAmount: num(row.vat_amount),
    whtAmount: num(row.wht_amount),
    retentionAmount: num(row.retention_amount),
    totalInvoiced: num(row.total_invoiced),
    netPayable,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    notes: row.notes,
    fromParty: row.from_party,
    toParty: row.to_party,
    recipientEmail: row.recipient_email,
    ccEmails: row.cc_emails ?? [],
    bccEmails: row.bcc_emails ?? [],
    poReferenceId: row.po_reference_id,
    paymentClaimId: row.payment_claim_id,
    milestonePaymentId: row.milestone_payment_id,
    contractReference: row.contract_reference,
    paymentTerms: row.payment_terms,
    coverNote: row.cover_note,
    headerText: row.header_text,
    footerText: row.footer_text,
    sentAt: row.sent_at,
    sentTo: row.sent_to,
    publicToken: row.public_token,
    viewedAt: row.viewed_at,
    pdfStorageKey: row.pdf_storage_key,
    retainageAmount,
    payableAmount,
    amountPaid,
    balanceDue,
    lineItems: lineItemRows.map(toLineItem),
    payments,
  };
}

function validateLineItems(items: InvoiceLineItemInput[]): void {
  for (const item of items) {
    if (item.description.trim().length === 0) throw new BadRequestError("Line item description is required");
    const quantity = item.quantity ?? 1;
    const unitRate = item.unitRate ?? 0;
    if (quantity <= 0) throw new BadRequestError("Line item quantity must be positive");
    if (unitRate < 0) throw new BadRequestError("Line item unit rate cannot be negative");
  }
}

function computeMoney(
  items: InvoiceLineItemInput[],
  rates: { vatRate?: number; whtRate?: number; retentionRate?: number },
): MoneySnapshot {
  const subtotal = round2(
    items.reduce((sum, item) => sum + (item.quantity ?? 1) * (item.unitRate ?? 0), 0),
  );
  const vatRate = rates.vatRate ?? config.finance.vatPct;
  const whtRate = rates.whtRate ?? config.finance.whtPct;
  const retentionRate = rates.retentionRate ?? config.finance.retentionPct;
  const vatAmount = round2((subtotal * vatRate) / 100);
  const totalInvoiced = round2(subtotal + vatAmount);
  const whtAmount = round2((subtotal * whtRate) / 100);
  const retentionAmount = round2((subtotal * retentionRate) / 100);
  const netPayable = round2(totalInvoiced - whtAmount - retentionAmount);
  return {
    subtotal,
    vatRate,
    whtRate,
    retentionRate,
    vatAmount,
    whtAmount,
    retentionAmount,
    totalInvoiced,
    netPayable,
  };
}

function itemRecords(invoiceId: string, items: InvoiceLineItemInput[]): NewInvoiceLineItemRecord[] {
  return items.map((item, index) => {
    const quantity = item.quantity ?? 1;
    const unitRate = item.unitRate ?? 0;
    return {
      id: generateId("invl"),
      invoice_id: invoiceId,
      position: index,
      description: item.description.trim(),
      quantity: String(quantity),
      unit: optional(item.unit) ?? null,
      unit_rate: String(unitRate),
      amount: String(round2(quantity * unitRate)),
      budget_category_id: optional(item.budgetCategoryId) ?? null,
      is_variation: item.isVariation ?? false,
    };
  });
}

export function invoicesService(repository: InvoicesRepository) {
  async function buildInvoice(row: InvoiceRow): Promise<Invoice> {
    const [payments, items] = await Promise.all([
      repository.listPaymentsForInvoices([row.id]),
      repository.listItemsForInvoices([row.id]),
    ]);
    return toInvoice(row, payments, items);
  }

  async function getOwnedInvoice(projectId: string, invoiceId: string): Promise<InvoiceRow> {
    const existing = await repository.findById(invoiceId);
    if (!existing || existing.project_id !== projectId) throw new NotFoundError("Invoice");
    return existing;
  }

  async function defaultsForProject(projectId: string) {
    const row = await repository.orgDefaultsForProject(projectId);
    return {
      currency: row?.default_currency ?? "NGN",
      vatRate: row?.default_tax_pct === null || row?.default_tax_pct === undefined
        ? config.finance.vatPct
        : num(row.default_tax_pct),
      whtRate: row?.default_wht_pct === null || row?.default_wht_pct === undefined
        ? config.finance.whtPct
        : num(row.default_wht_pct),
      retentionRate: row?.default_retention_pct === null || row?.default_retention_pct === undefined
        ? config.finance.retentionPct
        : num(row.default_retention_pct),
    };
  }

  return {
    async listByProject(projectId: string): Promise<Invoice[]> {
      const rows = await repository.listByProject(projectId);
      const invoiceIds = rows.map((r) => r.id);
      const [paymentRows, itemRows] = await Promise.all([
        repository.listPaymentsForInvoices(invoiceIds),
        repository.listItemsForInvoices(invoiceIds),
      ]);
      const groupedPayments = new Map<string, InvoicePaymentRow[]>();
      for (const payment of paymentRows) {
        const bucket = groupedPayments.get(payment.invoice_id);
        if (bucket) bucket.push(payment);
        else groupedPayments.set(payment.invoice_id, [payment]);
      }
      const groupedItems = new Map<string, InvoiceLineItemRow[]>();
      for (const item of itemRows) {
        const bucket = groupedItems.get(item.invoice_id);
        if (bucket) bucket.push(item);
        else groupedItems.set(item.invoice_id, [item]);
      }
      return rows.map((row) => toInvoice(row, groupedPayments.get(row.id) ?? [], groupedItems.get(row.id) ?? []));
    },

    async get(projectId: string, invoiceId: string): Promise<Invoice> {
      return buildInvoice(await getOwnedInvoice(projectId, invoiceId));
    },

    async getByPublicToken(token: string): Promise<Invoice> {
      const row = await repository.findByPublicToken(token);
      if (!row) throw new NotFoundError("Invoice");
      return buildInvoice(row);
    },

    async create(projectId: string, input: CreateInvoiceInput): Promise<Invoice> {
      const defaults = await defaultsForProject(projectId);
      const lineItems = input.lineItems ?? [
        {
          description: input.trade,
          quantity: 1,
          unitRate: input.amount ?? 0,
        },
      ];
      validateLineItems(lineItems);
      const money = computeMoney(lineItems, {
        vatRate: optionalRate(input.vatRate) ?? defaults.vatRate,
        whtRate: optionalRate(input.whtRate) ?? defaults.whtRate,
        retentionRate: optionalRate(input.retentionRate) ?? defaults.retentionRate,
      });
      const legacyRetainage = input.retainagePercentage ?? money.retentionRate;
      if (legacyRetainage < 0 || legacyRetainage > 100) {
        throw new BadRequestError("Retainage must be between 0 and 100");
      }
      const id = generateId("inv");
      const row = await repository.create(
        {
          id,
          project_id: projectId,
          invoice_type: input.invoiceType ?? "vendor",
          vendor_name: input.vendorName.trim(),
          trade: input.trade.trim(),
          number: optional(input.number) ?? null,
          status: toDatabaseStatus(toWorkflowStatus(input.status)),
          currency: optional(input.currency) ?? defaults.currency,
          amount: String(money.subtotal),
          retainage_percentage: String(legacyRetainage),
          vat_rate: String(money.vatRate),
          wht_rate: String(money.whtRate),
          retention_rate: String(money.retentionRate),
          subtotal: String(money.subtotal),
          vat_amount: String(money.vatAmount),
          wht_amount: String(money.whtAmount),
          retention_amount: String(money.retentionAmount),
          total_invoiced: String(money.totalInvoiced),
          net_payable: String(money.netPayable),
          issue_date: optional(input.issueDate) ?? null,
          due_date: optional(input.dueDate) ?? null,
          notes: optional(input.notes) ?? null,
          from_party: normalizeParty(input.fromParty) ?? null,
          to_party: normalizeParty(input.toParty) ?? null,
          recipient_email: optional(input.recipientEmail) ?? null,
          cc_emails: optionalArray(input.ccEmails) ?? null,
          bcc_emails: optionalArray(input.bccEmails) ?? null,
          po_reference_id: optional(input.poReferenceId) ?? null,
          payment_claim_id: optional(input.paymentClaimId) ?? null,
          milestone_payment_id: optional(input.milestonePaymentId) ?? null,
          contract_reference: optional(input.contractReference) ?? null,
          payment_terms: optional(input.paymentTerms) ?? null,
          cover_note: optional(input.coverNote) ?? null,
          header_text: optional(input.headerText) ?? null,
          footer_text: optional(input.footerText) ?? null,
        },
        itemRecords(id, lineItems),
      );
      return buildInvoice(row);
    },

    async edit(projectId: string, invoiceId: string, input: EditInvoiceInput): Promise<Invoice> {
      const existing = await getOwnedInvoice(projectId, invoiceId);
      const defaults = await defaultsForProject(projectId);
      const currentItems = await repository.listItemsForInvoices([invoiceId]);
      const lineItems = input.lineItems ?? (
        currentItems.length > 0
          ? currentItems.map((item) => ({
              description: item.description,
              quantity: num(item.quantity),
              unit: item.unit ?? undefined,
              unitRate: num(item.unit_rate),
              budgetCategoryId: item.budget_category_id ?? undefined,
              isVariation: item.is_variation,
            }))
          : [{
              description: input.trade ?? existing.trade,
              quantity: 1,
              unitRate: input.amount ?? num(existing.amount),
            }]
      );
      validateLineItems(lineItems);
      const money = computeMoney(lineItems, {
        vatRate: optionalRate(input.vatRate) ?? (existing.vat_rate === null ? defaults.vatRate : num(existing.vat_rate)),
        whtRate: optionalRate(input.whtRate) ?? (existing.wht_rate === null ? defaults.whtRate : num(existing.wht_rate)),
        retentionRate: optionalRate(input.retentionRate) ?? (existing.retention_rate === null ? defaults.retentionRate : num(existing.retention_rate)),
      });
      if (input.retainagePercentage !== undefined && (input.retainagePercentage < 0 || input.retainagePercentage > 100)) {
        throw new BadRequestError("Retainage must be between 0 and 100");
      }

      const patch: Parameters<typeof repository.update>[1] = {
        amount: String(money.subtotal),
        vat_rate: String(money.vatRate),
        wht_rate: String(money.whtRate),
        retention_rate: String(money.retentionRate),
        subtotal: String(money.subtotal),
        vat_amount: String(money.vatAmount),
        wht_amount: String(money.whtAmount),
        retention_amount: String(money.retentionAmount),
        total_invoiced: String(money.totalInvoiced),
        net_payable: String(money.netPayable),
      };
      if (input.vendorName !== undefined) patch.vendor_name = input.vendorName.trim();
      if (input.trade !== undefined) patch.trade = input.trade.trim();
      if (input.number !== undefined) patch.number = optional(input.number) ?? null;
      if (input.status !== undefined) patch.status = toDatabaseStatus(toWorkflowStatus(input.status));
      if (input.invoiceType !== undefined) patch.invoice_type = input.invoiceType;
      if (input.currency !== undefined) patch.currency = optional(input.currency) ?? defaults.currency;
      if (input.retainagePercentage !== undefined) patch.retainage_percentage = String(input.retainagePercentage);
      if (input.issueDate !== undefined) patch.issue_date = optional(input.issueDate) ?? null;
      if (input.dueDate !== undefined) patch.due_date = optional(input.dueDate) ?? null;
      if (input.notes !== undefined) patch.notes = optional(input.notes) ?? null;
      if (input.fromParty !== undefined) patch.from_party = normalizeParty(input.fromParty) ?? null;
      if (input.toParty !== undefined) patch.to_party = normalizeParty(input.toParty) ?? null;
      if (input.recipientEmail !== undefined) patch.recipient_email = optional(input.recipientEmail) ?? null;
      if (input.ccEmails !== undefined) patch.cc_emails = optionalArray(input.ccEmails) ?? null;
      if (input.bccEmails !== undefined) patch.bcc_emails = optionalArray(input.bccEmails) ?? null;
      if (input.poReferenceId !== undefined) patch.po_reference_id = optional(input.poReferenceId) ?? null;
      if (input.paymentClaimId !== undefined) patch.payment_claim_id = optional(input.paymentClaimId) ?? null;
      if (input.milestonePaymentId !== undefined) patch.milestone_payment_id = optional(input.milestonePaymentId) ?? null;
      if (input.contractReference !== undefined) patch.contract_reference = optional(input.contractReference) ?? null;
      if (input.paymentTerms !== undefined) patch.payment_terms = optional(input.paymentTerms) ?? null;
      if (input.coverNote !== undefined) patch.cover_note = optional(input.coverNote) ?? null;
      if (input.headerText !== undefined) patch.header_text = optional(input.headerText) ?? null;
      if (input.footerText !== undefined) patch.footer_text = optional(input.footerText) ?? null;

      const row = await repository.update(invoiceId, patch, itemRecords(invoiceId, lineItems));
      if (!row) throw new NotFoundError("Invoice");
      return buildInvoice(row);
    },

    async remove(projectId: string, invoiceId: string): Promise<void> {
      await getOwnedInvoice(projectId, invoiceId);
      const deleted = await repository.deleteInvoice(invoiceId);
      if (deleted === 0) throw new NotFoundError("Invoice");
    },

    async markSent(projectId: string, invoiceId: string, input: SendInvoiceInput): Promise<Invoice> {
      const existing = await getOwnedInvoice(projectId, invoiceId);
      const recipientEmail = optional(input.recipientEmail);
      if (!recipientEmail) throw new BadRequestError("Recipient email is required");
      const sentAt = new Date();
      const patch: Parameters<typeof repository.update>[1] = {
        status: "Submitted",
        recipient_email: recipientEmail,
        cc_emails: optionalArray(input.cc) ?? null,
        bcc_emails: optionalArray(input.bcc) ?? null,
        cover_note: optional(input.coverNote) ?? null,
        header_text: optional(input.headerText) ?? null,
        footer_text: optional(input.footerText) ?? null,
        sent_at: sentAt,
        sent_to: {
          to: recipientEmail,
          cc: optionalArray(input.cc) ?? [],
          bcc: optionalArray(input.bcc) ?? [],
          at: sentAt.toISOString(),
        },
        public_token: existing.public_token ?? generateId("invtok"),
      };
      const row = await repository.update(invoiceId, patch);
      if (!row) throw new NotFoundError("Invoice");
      return buildInvoice(row);
    },

    async savePdfStorageKey(invoiceId: string, storageKey: string): Promise<void> {
      await repository.update(invoiceId, { pdf_storage_key: storageKey });
    },

    async markViewed(token: string): Promise<Invoice> {
      const row = await repository.findByPublicToken(token);
      if (!row) throw new NotFoundError("Invoice");
      const updated = await repository.update(row.id, { viewed_at: new Date() });
      return buildInvoice(updated ?? row);
    },

    async addPayment(projectId: string, invoiceId: string, input: AddPaymentInput): Promise<Invoice> {
      await getOwnedInvoice(projectId, invoiceId);
      if (input.amount <= 0) throw new BadRequestError("Payment amount must be positive");
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

    async removePayment(projectId: string, invoiceId: string, paymentId: string): Promise<Invoice> {
      const row = await getOwnedInvoice(projectId, invoiceId);
      const payment = await repository.findPayment(paymentId);
      if (!payment || payment.invoice_id !== invoiceId) throw new NotFoundError("Payment");
      await repository.deletePayment(paymentId);
      return buildInvoice(row);
    },

    async getAllocations(projectId: string, invoiceId: string): Promise<InvoiceBudgetAllocation[]> {
      await getOwnedInvoice(projectId, invoiceId);
      const rows = await repository.listAllocations(invoiceId);
      return rows.map((r) => ({ budgetCategoryId: r.budget_category_id, amount: Number(r.amount) }));
    },

    async setAllocations(
      projectId: string,
      invoiceId: string,
      allocations: InvoiceBudgetAllocation[],
    ): Promise<InvoiceBudgetAllocation[]> {
      const row = await getOwnedInvoice(projectId, invoiceId);
      const total = allocations.reduce((sum, a) => sum + a.amount, 0);
      if (total > Number(row.net_payable) + 0.01) throw new BadRequestError("Allocated amount exceeds the invoice amount");
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
