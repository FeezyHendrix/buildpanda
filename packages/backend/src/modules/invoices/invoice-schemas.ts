import { INVOICE_DIRECTIONS, INVOICE_TYPES, INVOICE_WORKFLOW_STATUSES } from "./types.ts";

/** The create/edit request shapes for an invoice. Runtime validation, not types. */

const statusSchema = {
  type: "string",
  enum: INVOICE_WORKFLOW_STATUSES,
} as const;

const invoiceTypeSchema = {
  type: "string",
  enum: INVOICE_TYPES,
} as const;

/** Which way the certificate points, who is on the other side, and under which contract. */
const certificateFields = {
  direction: { type: "string", enum: INVOICE_DIRECTIONS },
  counterparty: { type: ["string", "null"], maxLength: 200 },
  contractId: { type: ["string", "null"], maxLength: 100 },
} as const;

const partySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: ["string", "null"], maxLength: 200 },
    address: { type: ["string", "null"], maxLength: 500 },
    tin: { type: ["string", "null"], maxLength: 100 },
    firsNumber: { type: ["string", "null"], maxLength: 100 },
    email: { type: ["string", "null"], maxLength: 200 },
    bank: {
      type: ["object", "null"],
      additionalProperties: false,
      properties: {
        accountName: { type: ["string", "null"], maxLength: 200 },
        accountNumber: { type: ["string", "null"], maxLength: 100 },
        bankName: { type: ["string", "null"], maxLength: 200 },
      },
    },
  },
} as const;

const lineItemSchema = {
  type: "object",
  required: ["description"],
  additionalProperties: false,
  properties: {
    description: { type: "string", minLength: 1, maxLength: 1000 },
    quantity: { type: "number", exclusiveMinimum: 0 },
    unit: { type: "string", maxLength: 50 },
    unitRate: { type: "number", minimum: 0 },
    budgetCategoryId: { type: "string", minLength: 1 },
    isVariation: { type: "boolean" },
  },
} as const;

export const createInvoiceBody = {
  type: "object",
  required: ["vendorName", "trade"],
  additionalProperties: false,
  properties: {
    ...certificateFields,
    vendorName: { type: "string", minLength: 1, maxLength: 200 },
    trade: { type: "string", minLength: 1, maxLength: 120 },
    number: { type: "string", maxLength: 100 },
    status: statusSchema,
    amount: { type: "number", minimum: 0 },
    retainagePercentage: { type: "number", minimum: 0, maximum: 100 },
    invoiceType: invoiceTypeSchema,
    currency: { type: "string", minLength: 1, maxLength: 10 },
    vatRate: { type: "number", minimum: 0, maximum: 100 },
    whtRate: { type: "number", minimum: 0, maximum: 100 },
    retentionRate: { type: "number", minimum: 0, maximum: 100 },
    issueDate: { type: "string", maxLength: 30 },
    dueDate: { type: "string", maxLength: 30 },
    notes: { type: "string", maxLength: 2000 },
    fromParty: { ...partySchema, type: ["object", "null"] },
    toParty: { ...partySchema, type: ["object", "null"] },
    recipientEmail: { type: "string", maxLength: 200 },
    ccEmails: { type: "array", items: { type: "string", maxLength: 200 } },
    bccEmails: { type: "array", items: { type: "string", maxLength: 200 } },
    poReferenceId: { type: "string", minLength: 1 },
    paymentClaimId: { type: "string", minLength: 1 },
    milestonePaymentId: { type: "string", minLength: 1 },
    contractReference: { type: "string", maxLength: 200 },
    paymentTerms: { type: "string", maxLength: 1000 },
    paymentInstructions: { type: "string", maxLength: 2000 },
    coverNote: { type: "string", maxLength: 4000 },
    headerText: { type: "string", maxLength: 2000 },
    footerText: { type: "string", maxLength: 2000 },
    sourceFileId: { type: "string", maxLength: 100 },
    lineItems: { type: "array", items: lineItemSchema },
  },
} as const;

export const editInvoiceBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: createInvoiceBody.properties,
} as const;

export const sendInvoiceBody = {
  type: "object",
  required: ["recipientEmail"],
  additionalProperties: false,
  properties: {
    recipientEmail: { type: "string", minLength: 1, maxLength: 200 },
    cc: { type: "array", items: { type: "string", maxLength: 200 } },
    bcc: { type: "array", items: { type: "string", maxLength: 200 } },
    coverNote: { type: "string", maxLength: 4000 },
    headerText: { type: "string", maxLength: 2000 },
    footerText: { type: "string", maxLength: 2000 },
  },
} as const;
