import { PARTICIPANT_SIDES, PARTICIPANT_STATUSES } from "./types.ts";

/** Request shapes for the participant routes. Runtime validation, not types. */

export const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

export const participantParams = {
  type: "object",
  required: ["id", "participantId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    participantId: { type: "string", minLength: 1 },
  },
} as const;

export const grantsSchema = {
  type: "object",
  additionalProperties: { type: "array", items: { type: "string", maxLength: 40 } },
} as const;

export const inviteBody = {
  type: "object",
  required: ["email"],
  additionalProperties: false,
  properties: {
    email: { type: "string", minLength: 3, maxLength: 200 },
    name: { type: "string", maxLength: 120 },
    role: { type: "string", minLength: 1, maxLength: 80 },
    side: { type: "string", enum: PARTICIPANT_SIDES },
    permissions: { type: "object", additionalProperties: { type: "string" } },
    grants: grantsSchema,
  },
} as const;

export const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    role: { type: "string", minLength: 1, maxLength: 80 },
    side: { type: "string", enum: PARTICIPANT_SIDES },
    status: { type: "string", enum: PARTICIPANT_STATUSES },
    permissions: { type: "object", additionalProperties: { type: "string" } },
    grants: grantsSchema,
  },
} as const;
