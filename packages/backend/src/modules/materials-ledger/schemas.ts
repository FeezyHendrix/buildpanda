export const materialLogBody = {
  type: "object",
  required: ["entryType", "materialName", "quantity"],
  additionalProperties: false,
  properties: {
    entryType: { type: "string", enum: ["IN", "USED"] },
    materialName: { type: "string", minLength: 1, maxLength: 200 },
    unit: { type: "string", maxLength: 40 },
    quantity: { type: "number", exclusiveMinimum: 0 },
    locationKey: { type: ["string", "null"], maxLength: 100 },
    stageId: { type: ["string", "null"], maxLength: 100 },
    occurredAt: { type: ["string", "null"], maxLength: 40 },
    materialOrderId: { type: ["string", "null"], maxLength: 100 },
    taskId: { type: ["string", "null"], maxLength: 100 },
    activityId: { type: ["string", "null"], maxLength: 100 },
    fileIds: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 10 },
    reason: { type: ["string", "null"], maxLength: 1000 },
    notesHtml: { type: ["string", "null"], maxLength: 200000 },
    idempotencyKey: { type: ["string", "null"], maxLength: 100 },
    supplier: { type: ["string", "null"], maxLength: 200 },
    deliveryNote: { type: ["string", "null"], maxLength: 120 },
  },
} as const;

export const voidLedgerBody = {
  type: "object", required: ["reason"], additionalProperties: false,
  properties: { reason: { type: "string", minLength: 1, maxLength: 1000 } },
} as const;

