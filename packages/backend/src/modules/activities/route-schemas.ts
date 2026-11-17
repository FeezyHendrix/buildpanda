import { CULPABILITIES } from "./types.ts";

export const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

export const activityParams = {
  type: "object",
  required: ["id", "activityId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    activityId: { type: "string", minLength: 1 },
  },
} as const;

export const delayParams = {
  type: "object",
  required: ["id", "activityId", "delayId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    activityId: { type: "string", minLength: 1 },
    delayId: { type: "string", minLength: 1 },
  },
} as const;

export const isoString = { type: "string", minLength: 1, maxLength: 40 } as const;

export const buildingQuery = {
  type: "object",
  additionalProperties: false,
  properties: { buildingId: { type: "string", minLength: 1 } },
} as const;

export const predecessorsSchema = {
  type: "array",
  maxItems: 100,
  items: {
    type: "object",
    required: ["activityId", "type", "lagDays"],
    additionalProperties: false,
    properties: {
      activityId: { type: "string", minLength: 1, maxLength: 100 },
      type: { type: "string", enum: ["FS", "SS", "FF", "SF"] },
      lagDays: { type: "integer", minimum: -365, maximum: 365 },
    },
  },
} as const;

export const createActivityBody = {
  type: "object",
  required: ["name", "activityType", "plannedStartAt", "plannedEndAt"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    activityType: { type: "string", minLength: 1, maxLength: 100 },
    buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    phaseId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    // Optional means optional: an empty box arrives as "" and is stored as null.
    location: { type: "string", maxLength: 200 },
    plannedStartAt: isoString,
    plannedEndAt: isoString,
    workerCountPlanned: { type: "integer", minimum: 0, maximum: 5000 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    notes: { type: "string", maxLength: 2000 },
    predecessors: predecessorsSchema,
    percentComplete: { type: "number", minimum: 0, maximum: 100 },
    isMilestone: { type: "boolean" },
  },
} as const;

export const updateActivityBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    activityType: { type: "string", minLength: 1, maxLength: 100 },
    phaseId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    location: { type: ["string", "null"], minLength: 1, maxLength: 200 },
    status: { type: "string", enum: ["Planned", "InProgress", "Completed", "Cancelled"] },
    plannedStartAt: isoString,
    plannedEndAt: isoString,
    actualStartAt: { type: ["string", "null"], minLength: 1, maxLength: 40 },
    actualEndAt: { type: ["string", "null"], minLength: 1, maxLength: 40 },
    workerCountPlanned: { type: "integer", minimum: 0, maximum: 5000 },
    notes: { type: ["string", "null"], maxLength: 2000 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    predecessors: predecessorsSchema,
    percentComplete: { type: "number", minimum: 0, maximum: 100 },
    isMilestone: { type: "boolean" },
  },
} as const;

export const delayLinkProps = {
  linkedRfiId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
  linkedChangeRequestId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
  linkedMaterialOrderId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
} as const;

export const raiseDelayBody = {
  type: "object",
  required: ["reasonCode", "startedAt"],
  additionalProperties: false,
  properties: {
    reasonCode: { type: "string", minLength: 1, maxLength: 50 },
    description: { type: "string", maxLength: 2000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    startedAt: isoString,
    endedAt: { type: ["string", "null"], minLength: 1, maxLength: 40 },
    daysLost: { type: "integer", minimum: 0, maximum: 3650 },
    culpability: { type: "string", enum: CULPABILITIES },
    eotClaimable: { type: "boolean" },
    ...delayLinkProps,
    costImpact: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["NGN", "USD"] },
    preventionNotes: { type: "string", maxLength: 2000 },
  },
} as const;

export const resolveDelayBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    resolvedAt: isoString,
    endedAt: { type: ["string", "null"], minLength: 1, maxLength: 40 },
    daysLost: { type: "integer", minimum: 0, maximum: 3650 },
    culpability: { type: "string", enum: CULPABILITIES },
    eotClaimable: { type: "boolean" },
    ...delayLinkProps,
    preventionNotes: { type: "string", maxLength: 2000 },
  },
} as const;

export const delaySchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    activityId: { type: "string" },
    reasonCode: { type: "string" },
    reasonName: { type: "string" },
    reasonCategory: { type: "string" },
    description: { type: ["string", "null"] },
    descriptionHtml: { type: ["string", "null"] },
    startedAt: { type: "string" },
    endedAt: { type: ["string", "null"] },
    daysLost: { type: "integer" },
    culpability: { type: "string", enum: CULPABILITIES },
    eotClaimable: { type: "boolean" },
    linkedRfiId: { type: ["string", "null"] },
    linkedChangeRequestId: { type: ["string", "null"] },
    linkedMaterialOrderId: { type: ["string", "null"] },
    appliedShiftDays: { type: "integer" },
    resolvedAt: { type: ["string", "null"] },
    resolvedById: { type: ["string", "null"] },
    costImpact: { type: "number" },
    currency: { type: "string" },
    preventionNotes: { type: ["string", "null"] },
    recordedBy: {
      type: ["object", "null"],
      properties: { id: { type: "string" }, name: { type: ["string", "null"] } },
    },
    createdAt: { type: "string" },
  },
} as const;

export const activityEventSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    activityId: { type: "string" },
    kind: { type: "string" },
    summary: { type: "string" },
    daysDelta: { type: "integer" },
    delayId: { type: ["string", "null"] },
    actorId: { type: ["string", "null"] },
    createdAt: { type: "string" },
  },
} as const;

