import { CHANGE_ACTIONS, CHANGE_STATUSES as STATUS, CHANGE_TYPES } from "./types.ts";

export const CURRENCY = ["NGN", "USD"] as const;

export const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

export const crParams = {
  type: "object",
  required: ["id", "changeId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    changeId: { type: "string", minLength: 1 },
  },
} as const;

export const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: { status: { type: "string", enum: STATUS } },
} as const;

export const delayIdsField = {
  type: "array",
  maxItems: 200,
  items: { type: "string", minLength: 1, maxLength: 100 },
} as const;

export const createBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    reason: { type: ["string", "null"], maxLength: 1000 },
    reasonHtml: { type: ["string", "null"], maxLength: 200000 },
    costImpact: { type: "number" },
    timeImpactDays: { type: "integer" },
    currency: { type: "string", enum: CURRENCY },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    type: { type: "string", enum: CHANGE_TYPES },
    stageId: { type: ["string", "null"], maxLength: 100 },
    rfiId: { type: ["string", "null"], maxLength: 100 },
    delayIds: delayIdsField,
  },
} as const;

export const budgetLinksBody = {
  type: "object",
  required: ["links"],
  additionalProperties: false,
  properties: {
    links: {
      type: "array",
      items: {
        type: "object",
        required: ["budgetCategoryId", "amount"],
        additionalProperties: false,
        properties: {
          budgetCategoryId: { type: "string", minLength: 1 },
          amount: { type: "number", minimum: 0 },
          committed: { type: "boolean" },
        },
      },
    },
  },
} as const;

export const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 4000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    reason: { type: ["string", "null"], maxLength: 1000 },
    reasonHtml: { type: ["string", "null"], maxLength: 200000 },
    costImpact: { type: "number" },
    timeImpactDays: { type: "integer" },
    currency: { type: "string", enum: CURRENCY },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    type: { type: "string", enum: CHANGE_TYPES },
    stageId: { type: ["string", "null"], maxLength: 100 },
    rfiId: { type: ["string", "null"], maxLength: 100 },
    delayIds: delayIdsField,
  },
} as const;

export const actionParams = {
  type: "object",
  required: ["id", "changeId", "action"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    changeId: { type: "string", minLength: 1 },
    action: { type: "string", enum: CHANGE_ACTIONS },
  },
} as const;

export const actionBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    /** Required on reject; carried into the revision history on resubmit. */
    reason: { type: "string", minLength: 1, maxLength: 2000 },
    costImpact: { type: "number" },
    timeImpactDays: { type: "integer" },
    /** Days granted when approving a time claim; defaults to the days claimed. */
    daysAwarded: { type: "integer", minimum: 0, maximum: 3650 },
  },
} as const;

export const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

export const summaryResponse = {
  200: {
    type: "object",
    properties: {
      draft: { type: "integer" },
      submitted: { type: "integer" },
      approved: { type: "integer" },
      executed: { type: "integer" },
      rejected: { type: "integer" },
      grossProfit: { type: ["number", "null"] },
    },
  },
} as const;

