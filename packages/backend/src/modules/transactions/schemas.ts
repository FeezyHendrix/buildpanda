export const createTransactionBody = {
  type: "object",
  required: ["title", "category", "amount", "transactedAt"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 2000 },
    category: { type: "string", minLength: 1, maxLength: 200 },
    amount: { type: "number", minimum: 0 },
    transactedAt: { type: "string", minLength: 1, maxLength: 30 },
    vendor: { type: ["string", "null"], maxLength: 200 },
    reference: { type: ["string", "null"], maxLength: 200 },
    receiptFileId: { type: ["string", "null"], maxLength: 200 },
    stageId: { type: ["string", "null"], maxLength: 200 },
    /** A refund or credit note against this category rather than an outlay. */
    credit: { type: "boolean" },
    /** A refundable outlay — a plant-hire deposit, a bond. */
    recoverable: { type: "boolean" },
  },
} as const;

export const editTransactionBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: createTransactionBody.properties,
} as const;

