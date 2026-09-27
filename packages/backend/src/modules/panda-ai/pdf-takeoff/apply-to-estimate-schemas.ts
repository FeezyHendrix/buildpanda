// JSON schemas for the apply-to-estimate route.
//
// The drift fields are OPTIONAL here so a preview request stays exactly what it
// always was — `{estimateId, mode}` — and every shipped client keeps validating.
// They are NOT optional for an apply: the route requires them explicitly, which
// is a deliberate 400 rather than a schema that would let an unpinned apply
// through as "write whatever is current".

import { APPLY_MODES } from "./types.ts";

export const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

const expectedRow = {
  type: "object",
  required: ["id", "version"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1, maxLength: 100 },
    version: { type: "integer", minimum: 1 },
  },
} as const;

const SHA256_HEX = "^[0-9a-f]{64}$";

export const applyToEstimateBody = {
  type: "object",
  required: ["estimateId", "mode"],
  additionalProperties: false,
  properties: {
    estimateId: { type: "string", minLength: 1, maxLength: 100 },
    mode: { type: "string", enum: APPLY_MODES },
    sourceFingerprint: { type: "string", pattern: SHA256_HEX },
    targetFingerprint: { type: "string", pattern: SHA256_HEX },
    expectedRows: { type: "array", maxItems: 5000, items: expectedRow },
    acknowledgedUnverifiedRowIds: {
      type: "array",
      maxItems: 5000,
      items: { type: "string", minLength: 1, maxLength: 100 },
    },
  },
} as const;
