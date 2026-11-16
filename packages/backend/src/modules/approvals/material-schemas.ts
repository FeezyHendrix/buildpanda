export const STATUS = ["Pending", "Approved", "Rejected", "Resubmit"] as const;

export const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

export const approvalParams = {
  type: "object",
  required: ["id", "approvalId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    approvalId: { type: "string", minLength: 1 },
  },
} as const;

export const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: { status: { type: "string", enum: STATUS } },
} as const;

export const materialFields = {
  materialName: { type: "string", minLength: 1, maxLength: 200 },
  specification: { type: ["string", "null"], maxLength: 4000 },
  quantity: { type: "number", minimum: 0 },
  unit: { type: "string", minLength: 1, maxLength: 40 },
  supplier: { type: ["string", "null"], maxLength: 200 },
  neededBy: { type: ["string", "null"], maxLength: 40 },
  phaseId: { type: ["string", "null"], maxLength: 100 },
  activityId: { type: ["string", "null"], maxLength: 100 },
} as const;

export const createBody = {
  type: "object",
  required: ["title", "materialName"],
  additionalProperties: false,
  properties: {
    ...materialFields,
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    requestedReviewerId: { type: ["string", "null"], maxLength: 100 },
    documentId: { type: ["string", "null"], maxLength: 100 },
    documentVersionId: { type: ["string", "null"], maxLength: 100 },
    // The pin a request was raised from, so the markup can link back to it.
    sourceMarkupId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

export const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    ...materialFields,
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    status: { type: "string", enum: STATUS },
    response: { type: ["string", "null"], maxLength: 4000 },
    responseHtml: { type: ["string", "null"], maxLength: 200000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    requestedReviewerId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

export const resubmitBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    ...materialFields,
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    requestedReviewerId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

export const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

