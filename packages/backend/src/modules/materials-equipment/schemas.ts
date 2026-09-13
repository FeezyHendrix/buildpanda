import {
  EQUIPMENT_REQUEST_STATUSES,
  MATERIAL_ORDER_STATUSES,
} from "./types.ts";

export const PRIORITY = ["Low", "Normal", "High", "Critical"] as const;
export const BUCKETS = ["requests", "approvals", "schedule", "on-hire", "returns"] as const;

export const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

export const materialParams = {
  type: "object",
  required: ["id", "orderId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    orderId: { type: "string", minLength: 1 },
  },
} as const;

export const equipmentParams = {
  type: "object",
  required: ["id", "requestId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    requestId: { type: "string", minLength: 1 },
  },
} as const;

export const materialQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: MATERIAL_ORDER_STATUSES },
    late: { type: "boolean" },
  },
} as const;

export const equipmentQuery = {
  type: "object",
  additionalProperties: false,
  properties: { bucket: { type: "string", enum: BUCKETS } },
} as const;

export const materialBody = {
  type: "object",
  required: ["title", "materialName", "quantity", "unit", "neededBy"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    materialName: { type: "string", minLength: 1, maxLength: 200 },
    quantity: { type: "number", exclusiveMinimum: 0 },
    unit: { type: "string", minLength: 1, maxLength: 40 },
    supplier: { type: ["string", "null"], maxLength: 200 },
    supplierId: { type: ["string", "null"], maxLength: 100 },
    status: { type: "string", enum: MATERIAL_ORDER_STATUSES },
    priority: { type: "string", enum: PRIORITY },
    phaseId: { type: ["string", "null"], maxLength: 100 },
    activityId: { type: ["string", "null"], maxLength: 100 },
    documentId: { type: ["string", "null"], maxLength: 100 },
    neededBy: { type: "string", minLength: 1, maxLength: 40 },
    orderedAt: { type: ["string", "null"], maxLength: 40 },
    expectedDeliveryAt: { type: ["string", "null"], maxLength: 40 },
    deliveredAt: { type: ["string", "null"], maxLength: 40 },
    unitRate: { type: ["number", "null"], minimum: 0 },
    estimatedCost: { type: "number", minimum: 0 },
    actualCost: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["NGN", "USD"] },
    deliveryLocation: { type: ["string", "null"], maxLength: 200 },
    notes: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

export const materialPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ...materialBody.properties,
    reason: { type: ["string", "null"], maxLength: 1000 },
    force: { type: "boolean" },
    forceNote: { type: ["string", "null"], maxLength: 1000 },
  },
} as const;

export const equipmentBody = {
  type: "object",
  required: ["title", "equipmentName", "equipmentType", "neededFrom", "neededUntil"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    equipmentName: { type: "string", minLength: 1, maxLength: 200 },
    equipmentType: { type: "string", minLength: 1, maxLength: 120 },
    quantity: { type: "integer", minimum: 1, maximum: 500 },
    supplier: { type: ["string", "null"], maxLength: 200 },
    supplierId: { type: ["string", "null"], maxLength: 100 },
    status: { type: "string", enum: EQUIPMENT_REQUEST_STATUSES },
    priority: { type: "string", enum: PRIORITY },
    phaseId: { type: ["string", "null"], maxLength: 100 },
    activityId: { type: ["string", "null"], maxLength: 100 },
    documentId: { type: ["string", "null"], maxLength: 100 },
    neededFrom: { type: "string", minLength: 1, maxLength: 40 },
    neededUntil: { type: "string", minLength: 1, maxLength: 40 },
    mobilizedAt: { type: ["string", "null"], maxLength: 40 },
    returnedAt: { type: ["string", "null"], maxLength: 40 },
    onHireAt: { type: ["string", "null"], maxLength: 40 },
    offHireAt: { type: ["string", "null"], maxLength: 40 },
    plantRef: { type: ["string", "null"], maxLength: 80 },
    dailyRate: { type: ["number", "null"], minimum: 0 },
    estimatedCost: { type: "number", minimum: 0 },
    actualCost: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["NGN", "USD"] },
    deliveryLocation: { type: ["string", "null"], maxLength: 200 },
    operatorRequired: { type: "boolean" },
    notes: { type: ["string", "null"], maxLength: 2000 },
  },
} as const;

export const equipmentPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ...equipmentBody.properties,
    reason: { type: ["string", "null"], maxLength: 1000 },
  },
} as const;

export const extendHireBody = {
  type: "object",
  required: ["offHireAt"],
  additionalProperties: false,
  properties: {
    offHireAt: { type: "string", minLength: 1, maxLength: 40 },
    reason: { type: ["string", "null"], maxLength: 1000 },
  },
} as const;

export const deliveryBody = {
  type: "object",
  required: ["deliveredQty", "deliveredAt"],
  additionalProperties: false,
  properties: {
    deliveredQty: { type: "number", exclusiveMinimum: 0 },
    deliveredAt: { type: "string", minLength: 1, maxLength: 40 },
    deliveryNote: { type: ["string", "null"], maxLength: 120 },
    receivedById: { type: ["string", "null"], maxLength: 100 },
    notes: { type: ["string", "null"], maxLength: 2000 },
    rejected: { type: "boolean" },
    rejectedReason: { type: ["string", "null"], maxLength: 1000 },
  },
} as const;

const lifecycleLinks = {
  phaseId: { type: ["string", "null"] },
  phaseName: { type: ["string", "null"] },
  activityId: { type: ["string", "null"] },
  activityName: { type: ["string", "null"] },
  documentId: { type: ["string", "null"] },
  documentName: { type: ["string", "null"] },
} as const;

export const deliveryResponse = {
  type: "object",
  properties: {
    id: { type: "string" },
    orderId: { type: "string" },
    deliveredQty: { type: "number" },
    deliveredAt: { type: "string" },
    deliveryNote: { type: ["string", "null"] },
    receivedById: { type: ["string", "null"] },
    receivedByName: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    rejected: { type: "boolean" },
    rejectedReason: { type: ["string", "null"] },
    ledgerEntryId: { type: ["string", "null"] },
    transactionId: { type: ["string", "null"] },
    createdAt: { type: "string" },
  },
} as const;

export const materialOrderResponse = {
  type: "object",
  properties: {
    ...lifecycleLinks,
    id: { type: "string" },
    projectId: { type: "string" },
    title: { type: "string" },
    materialName: { type: "string" },
    quantity: { type: "number" },
    unit: { type: "string" },
    supplier: { type: ["string", "null"] },
    supplierId: { type: ["string", "null"] },
    supplierName: { type: ["string", "null"] },
    status: { type: "string", enum: MATERIAL_ORDER_STATUSES },
    priority: { type: "string", enum: PRIORITY },
    neededBy: { type: "string" },
    orderedAt: { type: ["string", "null"] },
    expectedDeliveryAt: { type: ["string", "null"] },
    deliveredAt: { type: ["string", "null"] },
    unitRate: { type: ["number", "null"] },
    estimatedCost: { type: "number" },
    actualCost: { type: "number" },
    currency: { type: "string" },
    deliveryLocation: { type: ["string", "null"] },
    notes: { type: ["string", "null"] },
    cancelReason: { type: ["string", "null"] },
    rejectedReason: { type: ["string", "null"] },
    requestedById: { type: ["string", "null"] },
    procurementId: { type: ["string", "null"] },
    late: { type: "boolean" },
    deliveredQuantity: { type: "number" },
    outstandingQuantity: { type: "number" },
    deliveries: { type: "array", items: deliveryResponse },
    approvalStatus: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

export const equipmentResponse = {
  type: "object",
  properties: {
    ...lifecycleLinks,
    id: { type: "string" },
    projectId: { type: "string" },
    title: { type: "string" },
    equipmentName: { type: "string" },
    equipmentType: { type: "string" },
    quantity: { type: "number" },
    supplier: { type: ["string", "null"] },
    supplierId: { type: ["string", "null"] },
    supplierName: { type: ["string", "null"] },
    status: { type: "string", enum: EQUIPMENT_REQUEST_STATUSES },
    bucket: { type: "string", enum: BUCKETS },
    priority: { type: "string", enum: PRIORITY },
    neededFrom: { type: "string" },
    neededUntil: { type: "string" },
    mobilizedAt: { type: ["string", "null"] },
    returnedAt: { type: ["string", "null"] },
    onHireAt: { type: ["string", "null"] },
    offHireAt: { type: ["string", "null"] },
    plantRef: { type: ["string", "null"] },
    dailyRate: { type: ["number", "null"] },
    hireDays: { type: ["number", "null"] },
    extensions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          at: { type: "string" },
          from: { type: ["string", "null"] },
          to: { type: "string" },
          reason: { type: ["string", "null"] },
          actorId: { type: ["string", "null"] },
        },
      },
    },
    estimatedCost: { type: "number" },
    actualCost: { type: "number" },
    currency: { type: "string" },
    deliveryLocation: { type: ["string", "null"] },
    operatorRequired: { type: "boolean" },
    notes: { type: ["string", "null"] },
    cancelReason: { type: ["string", "null"] },
    rejectedReason: { type: ["string", "null"] },
    requestedById: { type: ["string", "null"] },
    late: { type: "boolean" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" },
  },
} as const;

export const importJobParams = {
  type: "object",
  required: ["id", "jobId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    jobId: { type: "string", minLength: 1 },
  },
} as const;

export const bulkImportBody = {
  type: "object",
  required: ["materials"],
  additionalProperties: false,
  properties: {
    materials: {
      type: "array",
      minItems: 1,
      maxItems: 500,
      items: {
        type: "object",
        required: ["materialName", "quantity", "unit"],
        additionalProperties: false,
        properties: {
          materialName: { type: "string", minLength: 1, maxLength: 2000 },
          quantity: { type: "number", minimum: 0 },
          unit: { type: "string", minLength: 1, maxLength: 80 },
          estimatedCost: { type: "number", minimum: 0 },
          supplier: { type: ["string", "null"], maxLength: 200 },
          neededBy: { type: "string", maxLength: 40 },
          section: { type: ["string", "null"], maxLength: 200 },
        },
      },
    },
  },
} as const;
