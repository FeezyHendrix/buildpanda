import { PAYMENT_METHODS } from "./types.ts";

export const addPaymentBody = {
  type: "object",
  required: ["amount"],
  additionalProperties: false,
  properties: {
    amount: { type: "number", exclusiveMinimum: 0 },
    sourceFileId: { type: "string", minLength: 1, maxLength: 100 },
    method: { type: "string", enum: PAYMENT_METHODS },
    paidAt: { type: "string", maxLength: 30 },
    note: { type: "string", maxLength: 500 },
    /** Accept a receipt above the balance; it is recorded as a credit. */
    allowOverpayment: { type: "boolean" },
  },
} as const;
