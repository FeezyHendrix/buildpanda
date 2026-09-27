import { config } from "../../config/index.ts";
import { BadRequestError } from "../../lib/errors.ts";
import { generateId } from "../../lib/ids.ts";
import { Money } from "../../lib/money.ts";
import type { NewInvoiceLineItemRecord } from "./repository.ts";
import type { InvoiceLineItemInput, InvoiceParty, InvoicePartyInput } from "./types.ts";

/** Input normalisation and the money arithmetic shared by create and edit. */
export interface MoneySnapshot {
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

export function optional(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function optionalArray(value: string[] | undefined): string[] | null | undefined {
  if (value === undefined) return undefined;
  const clean = value.map((item) => item.trim()).filter(Boolean);
  return clean.length > 0 ? clean : null;
}

export function optionalRate(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (value < 0 || value > 100) throw new BadRequestError("Rate must be between 0 and 100");
  return value;
}

export function normalizeParty(input: InvoicePartyInput | null | undefined): InvoiceParty | null | undefined {
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

export function validateLineItems(items: InvoiceLineItemInput[]): void {
  for (const item of items) {
    if (item.description.trim().length === 0) throw new BadRequestError("Line item description is required");
    const quantity = item.quantity ?? 1;
    const unitRate = item.unitRate ?? 0;
    if (quantity <= 0) throw new BadRequestError("Line item quantity must be positive");
    if (unitRate < 0) throw new BadRequestError("Line item unit rate cannot be negative");
  }
}

export function computeMoney(
  items: InvoiceLineItemInput[],
  rates: { vatRate?: number; whtRate?: number; retentionRate?: number },
): MoneySnapshot {
  const subtotal = Money.sum(
    items.map((item) => Money.of(item.quantity ?? 1).mul(item.unitRate ?? 0)),
  ).round(2);
  const vatRate = rates.vatRate ?? config.finance.vatPct;
  const whtRate = rates.whtRate ?? config.finance.whtPct;
  const retentionRate = rates.retentionRate ?? config.finance.retentionPct;
  const vatAmount = subtotal.percent(vatRate).round(2);
  const totalInvoiced = subtotal.add(vatAmount).round(2);
  const whtAmount = subtotal.percent(whtRate).round(2);
  const retentionAmount = subtotal.percent(retentionRate).round(2);
  const netPayable = totalInvoiced.sub(whtAmount).sub(retentionAmount).round(2);
  return {
    subtotal: subtotal.toNumber(),
    vatRate,
    whtRate,
    retentionRate,
    vatAmount: vatAmount.toNumber(),
    whtAmount: whtAmount.toNumber(),
    retentionAmount: retentionAmount.toNumber(),
    totalInvoiced: totalInvoiced.toNumber(),
    netPayable: netPayable.toNumber(),
  };
}

export function itemRecords(invoiceId: string, items: InvoiceLineItemInput[]): NewInvoiceLineItemRecord[] {
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
      amount: String(Money.of(quantity).mul(unitRate).round(2).toNumber()),
      budget_category_id: optional(item.budgetCategoryId) ?? null,
      is_variation: item.isVariation ?? false,
    };
  });
}
