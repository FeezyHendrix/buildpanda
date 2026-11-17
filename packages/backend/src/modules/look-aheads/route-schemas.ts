import { LOOK_AHEAD_STATUSES } from "./types.ts";

export const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

export const lookAheadParams = {
  type: "object",
  required: ["id", "lookAheadId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    lookAheadId: { type: "string", minLength: 1 },
  },
} as const;

export const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: LOOK_AHEAD_STATUSES },
    timeline: { type: "string", enum: ["past", "current", "future"] },
    activityId: { type: "string", maxLength: 100 },
    buildingId: { type: "string", minLength: 1, maxLength: 100 },
    sort: { type: "string", enum: ["startDate", "endDate", "status"] },
    order: { type: "string", enum: ["asc", "desc"] },
  },
} as const;

export const autoWindowQuery = {
  type: "object",
  additionalProperties: false,
  properties: { weeks: { type: "integer", minimum: 1, maximum: 12 } },
} as const;

export const lookAheadBody = {
  type: "object",
  required: ["name", "startDate", "endDate"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    description: { type: ["string", "null"], maxLength: 2000 },
    status: { type: "string", enum: LOOK_AHEAD_STATUSES },
    startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    totalWorkers: { type: ["integer", "null"], minimum: 0 },
    activityIds: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 200 },
  },
} as const;

export const lookAheadPatchBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 2000 },
    status: { type: "string", enum: LOOK_AHEAD_STATUSES },
    startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    endDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    totalWorkers: { type: ["integer", "null"], minimum: 0 },
    assignActivityIds: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 200 },
    unassignActivityIds: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 200 },
  },
} as const;

export const approveBody = {
  type: "object",
  additionalProperties: false,
  properties: { note: { type: ["string", "null"], maxLength: 2000 } },
} as const;

export const revokeBody = {
  type: "object",
  additionalProperties: false,
  properties: { reason: { type: ["string", "null"], maxLength: 2000 } },
} as const;

