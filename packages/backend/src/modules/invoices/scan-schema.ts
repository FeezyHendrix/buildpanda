import { z } from "zod";

const nullifyEmpty = (v: string): string | null => (v.trim().length === 0 ? null : v.trim());

const orNull = <T>(schema: z.ZodType<T>) =>
  schema.nullish().transform((v) => (v ?? null) as T | null);

const trimmedNullable = (max: number) => orNull(z.string().max(max).transform(nullifyEmpty));
const nonNegNumberNullable = orNull(z.number().finite().nonnegative());
const rateNullable = orNull(z.number().min(0).max(100));
const isoDateNullable = orNull(z.string().regex(/^\d{4}-\d{2}-\d{2}$/));
const currencyNullable = orNull(z.string().regex(/^[A-Z]{3}$/));

const partySchema = orNull(
  z
    .object({
      name: trimmedNullable(200),
      address: trimmedNullable(500),
      tin: trimmedNullable(100),
      firsNumber: trimmedNullable(100),
      email: trimmedNullable(200),
      bank: orNull(
        z
          .object({
            accountName: trimmedNullable(200),
            accountNumber: trimmedNullable(100),
            bankName: trimmedNullable(200),
          })
          .partial()
          .transform((b) => ({
            accountName: b.accountName ?? null,
            accountNumber: b.accountNumber ?? null,
            bankName: b.bankName ?? null,
          })),
      ),
    })
    .partial()
    .transform((p) => ({
      name: p.name ?? null,
      address: p.address ?? null,
      tin: p.tin ?? null,
      firsNumber: p.firsNumber ?? null,
      email: p.email ?? null,
      bank: p.bank ?? null,
    })),
);

const lineItemSchema = z
  .object({
    description: z.string().trim().min(1).max(1000),
    quantity: nonNegNumberNullable,
    unit: trimmedNullable(50),
    unitRate: nonNegNumberNullable,
    lineTotal: nonNegNumberNullable,
  })
  .transform((li) => ({
    description: li.description,
    quantity: li.quantity ?? null,
    unit: li.unit ?? null,
    unitRate: li.unitRate ?? null,
    lineTotal: li.lineTotal ?? null,
  }));

export const extractedInvoiceSchema = z.object({
  documentKind: z.enum(["invoice", "receipt", "quote", "other"]),
  confidence: z.enum(["high", "medium", "low"]),
  vendorName: trimmedNullable(200),
  invoiceNumber: trimmedNullable(100),
  issueDate: isoDateNullable,
  dueDate: isoDateNullable,
  currency: currencyNullable,
  lineItems: z.array(lineItemSchema).max(200).default([]),
  subtotal: nonNegNumberNullable,
  vatRate: rateNullable,
  vatAmount: nonNegNumberNullable,
  whtRate: rateNullable,
  retentionRate: rateNullable,
  total: nonNegNumberNullable,
  fromParty: partySchema,
  toParty: partySchema,
  notes: trimmedNullable(2000),
});

export type ExtractedInvoice = z.infer<typeof extractedInvoiceSchema>;

