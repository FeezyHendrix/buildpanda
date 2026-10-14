import { RFI_DISTRIBUTION_ROLES, RFI_PRIORITIES, RFI_STATUSES } from "./types.ts";
export const TRANSITION_TARGETS = ["Closed", "Void", "Open"] as const;

export const EXTERNAL_REPLY_TTL_DAYS = 14;

export const rfiParams = {
  type: "object",
  required: ["id", "rfiId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    rfiId: { type: "string", minLength: 1 },
  },
} as const;

export const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: RFI_STATUSES },
    ballInCourt: { type: "string", enum: ["mine"] },
    stageId: { type: "string", minLength: 1, maxLength: 200 },
  },
} as const;

export const createBody = {
  type: "object",
  required: ["subject", "question"],
  additionalProperties: false,
  properties: {
    subject: { type: "string", minLength: 1, maxLength: 200 },
    question: { type: "string", minLength: 1, maxLength: 8000 },
    questionHtml: { type: ["string", "null"], maxLength: 200000 },
    priority: { type: "string", enum: RFI_PRIORITIES },
    ballInCourtId: { type: ["string", "null"], maxLength: 100 },
    ballInCourtName: { type: ["string", "null"], maxLength: 200 },
    ballInCourtEmail: { type: ["string", "null"], maxLength: 200, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    assigneeRole: { type: ["string", "null"], maxLength: 40 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    costImpact: { type: "boolean" },
    scheduleImpact: { type: "boolean" },
    documentId: { type: ["string", "null"], maxLength: 100 },
    documentVersionId: { type: ["string", "null"], maxLength: 100 },
    sourceMarkupId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

export const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    subject: { type: "string", minLength: 1, maxLength: 200 },
    question: { type: "string", minLength: 1, maxLength: 8000 },
    questionHtml: { type: ["string", "null"], maxLength: 200000 },
    priority: { type: "string", enum: RFI_PRIORITIES },
    ballInCourtId: { type: ["string", "null"], maxLength: 100 },
    ballInCourtName: { type: ["string", "null"], maxLength: 200 },
    ballInCourtEmail: { type: ["string", "null"], maxLength: 200, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    assigneeRole: { type: ["string", "null"], maxLength: 40 },
    dueDate: { type: ["string", "null"], maxLength: 40 },
    costImpact: { type: "boolean" },
    scheduleImpact: { type: "boolean" },
  },
} as const;

export const respondBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", minLength: 1, maxLength: 8000 },
    official: { type: "boolean" },
    contentHtml: { type: ["string", "null"], maxLength: 50000 },
    attachments: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        required: ["fileId", "url", "name"],
        additionalProperties: false,
        properties: {
          fileId: { type: "string", maxLength: 100 },
          url: { type: "string", maxLength: 1000 },
          name: { type: "string", maxLength: 300 },
        },
      },
    },
    references: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["type", "id", "label"],
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["action_item", "activity"] },
          id: { type: "string", maxLength: 100 },
          label: { type: "string", maxLength: 300 },
        },
      },
    },
  },
} as const;

export const transitionBody = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: { status: { type: "string", enum: TRANSITION_TARGETS } },
} as const;

export const convertBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    changeRequestId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

export const eventsResponse = {
  200: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        rfiId: { type: "string" },
        type: { type: "string" },
        actorId: { type: ["string", "null"] },
        actorLabel: { type: ["string", "null"] },
        detail: {},
        createdAt: { type: "string" },
      },
    },
  },
} as const;

export const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 4000 } },
} as const;

export const distributionBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    userId: { type: ["string", "null"], maxLength: 100 },
    email: { type: ["string", "null"], maxLength: 200, pattern: "^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$" },
    name: { type: ["string", "null"], maxLength: 200 },
    role: { type: "string", enum: RFI_DISTRIBUTION_ROLES },
  },
} as const;
