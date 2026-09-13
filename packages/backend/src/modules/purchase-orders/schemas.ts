import { PURCHASE_ORDER_STATUSES } from "./types.ts";

export const purchaseOrderParams = {
  type: "object",
  required: ["id", "purchaseOrderId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    purchaseOrderId: { type: "string", minLength: 1 },
  },
} as const;

export const materialOrderParams = {
  type: "object",
  required: ["id", "orderId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    orderId: { type: "string", minLength: 1 },
  },
} as const;

const lineItemSchema = {
  type: "object",
  required: ["description"],
  additionalProperties: false,
  properties: {
    description: { type: "string", minLength: 1, maxLength: 500 },
    quantity: { type: "number", exclusiveMinimum: 0 },
    unitPrice: { type: "number", minimum: 0 },
  },
} as const;

// `status` is deliberately absent: a PO moves through issue / receive / cancel
// / close actions, so it can never be born "Received" or edited into it.
export const createPurchaseOrderBody = {
  type: "object",
  required: ["vendorName", "items"],
  additionalProperties: false,
  properties: {
    poNumber: { type: "string", maxLength: 100 },
    vendorName: { type: "string", minLength: 1, maxLength: 200 },
    supplierId: { type: ["string", "null"], maxLength: 100 },
    orderDate: { type: "string", maxLength: 30 },
    expectedDate: { type: "string", maxLength: 30 },
    notes: { type: "string", maxLength: 2000 },
    stageId: { type: ["string", "null"], maxLength: 200 },
    items: { type: "array", minItems: 1, items: lineItemSchema },
  },
} as const;

export const editPurchaseOrderBody = {
  type: "object",
  required: ["items"],
  additionalProperties: false,
  properties: createPurchaseOrderBody.properties,
} as const;

export const issueBody = {
  type: "object",
  additionalProperties: false,
  properties: { issuedAt: { type: "string", maxLength: 30 } },
} as const;

export const receiveBody = {
  type: "object",
  required: ["lines"],
  additionalProperties: false,
  properties: {
    lines: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["itemId", "receivedQuantity"],
        additionalProperties: false,
        properties: {
          itemId: { type: "string", minLength: 1, maxLength: 100 },
          receivedQuantity: { type: "number", minimum: 0 },
        },
      },
    },
    receivedAt: { type: "string", maxLength: 30 },
    note: { type: "string", maxLength: 1000 },
  },
} as const;

export const cancelBody = {
  type: "object",
  required: ["reason"],
  additionalProperties: false,
  properties: { reason: { type: "string", minLength: 1, maxLength: 1000 } },
} as const;

export const raiseFromOrderBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    poNumber: { type: ["string", "null"], maxLength: 100 },
    expectedDate: { type: ["string", "null"], maxLength: 30 },
    notes: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

export const purchaseOrderResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    poNumber: { type: "string" },
    vendorName: { type: "string" },
    supplierId: { type: ["string", "null"] },
    materialOrderId: { type: ["string", "null"] },
    status: { type: "string", enum: PURCHASE_ORDER_STATUSES },
    orderDate: { type: ["string", "null"] },
    expectedDate: { type: ["string", "null"] },
    issuedAt: { type: ["string", "null"] },
    issuedById: { type: ["string", "null"] },
    cancelReason: { type: ["string", "null"] },
    cancelledAt: { type: ["string", "null"] },
    closedAt: { type: ["string", "null"] },
    overReceipt: { type: "boolean" },
    committed: { type: "boolean" },
    notes: { type: ["string", "null"] },
    stageId: { type: ["string", "null"] },
    stageName: { type: ["string", "null"] },
    total: { type: "number" },
    receivedTotal: { type: "number" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          description: { type: "string" },
          quantity: { type: "number" },
          unitPrice: { type: "number" },
          lineTotal: { type: "number" },
          receivedQuantity: { type: "number" },
          outstandingQuantity: { type: "number" },
          overReceived: { type: "boolean" },
        },
      },
    },
  },
} as const;
