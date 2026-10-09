// The `as const` JSON schemas the take-off routes validate against. They are
// runtime validation values, not types, so they live next to the routes rather
// than in types.ts; they are shared here because several sub-routers reuse the
// same param and version-only shapes.
import { DEDUCTION_MODES, GEOMETRY_KINDS, ROW_TYPES, TAKEOFF_MODES, TAKEOFF_SCOPE_KINDS } from "./types.ts";
import { BESMM_ELEMENT_ORDER } from "./engine/besmm-reference.ts";

export const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

export const sheetParams = {
  type: "object",
  required: ["sheetId"],
  additionalProperties: false,
  properties: { sheetId: { type: "string", minLength: 1 } },
} as const;

export const rowParams = {
  type: "object",
  required: ["rowId"],
  additionalProperties: false,
  properties: { rowId: { type: "string", minLength: 1 } },
} as const;

export const taskParams = {
  type: "object",
  required: ["taskId"],
  additionalProperties: false,
  properties: { taskId: { type: "string", minLength: 1 } },
} as const;

export const programmeStartBody = {
  type: "object",
  required: ["startDate"],
  additionalProperties: false,
  properties: { startDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } },
} as const;

export const programmeLink = {
  type: "object",
  required: ["taskId", "type"],
  additionalProperties: false,
  properties: {
    taskId: { type: "string", minLength: 1 },
    type: { type: "string", enum: ["FS", "SS", "FF", "SF"] },
    lagDays: { type: "number", minimum: -60, maximum: 60, default: 0 },
  },
} as const;

export const updateProgrammeTaskBody = {
  type: "object",
  required: ["version"],
  additionalProperties: false,
  minProperties: 2,
  properties: {
    version: { type: "integer", minimum: 1 },
    name: { type: "string", minLength: 1, maxLength: 120 },
    durationDays: { type: "number", minimum: 0, maximum: 400 },
    isMilestone: { type: "boolean" },
    basis: { type: "string", maxLength: 200 },
    outlineLevel: { type: "integer", minimum: 1, maximum: 5 },
    sort: { type: "integer", minimum: 0 },
    predecessors: { type: "array", maxItems: 20, items: programmeLink },
  },
} as const;

export const createProgrammeTaskBody = {
  type: "object",
  required: ["name", "durationDays"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    durationDays: { type: "number", minimum: 0, maximum: 400 },
    isMilestone: { type: "boolean" },
    basis: { type: "string", maxLength: 200 },
    outlineLevel: { type: "integer", minimum: 1, maximum: 5 },
    afterTaskId: { type: "string", minLength: 1 },
    predecessors: { type: "array", maxItems: 20, items: programmeLink },
  },
} as const;

export const updateRowBody = {
  type: "object",
  required: ["version", "changes"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    changes: {
      type: "object",
      additionalProperties: false,
      minProperties: 1,
      properties: {
        description: { type: "string", maxLength: 4000 },
        qty: { type: "number", minimum: 0 },
        rate: { type: "number", minimum: 0 },
        unit: { type: "string", maxLength: 20 },
        typical: { type: "integer", minimum: 1, maximum: 500 },
      },
    },
  },
} as const;

export const versionOnlyBody = {
  type: "object",
  required: ["version"],
  additionalProperties: false,
  properties: { version: { type: "integer", minimum: 1 } },
} as const;

export const vertices = {
  type: "array",
  minItems: 1,
  maxItems: 2000,
  items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
} as const;

export const updateGeometryBody = {
  type: "object",
  required: ["version", "kind", "vertices"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    kind: { type: "string", enum: GEOMETRY_KINDS },
    vertices,
    sheetId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

export const addDeductionBody = {
  type: "object",
  required: ["version", "label", "vertices"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    label: { type: "string", minLength: 1, maxLength: 200 },
    vertices,
    // Optional, but checked against the dimension the line is billed in when
    // given: this legacy route reaches the same writer as the envelope, so it
    // must not be the one door where a cross-dimensional cut still gets in.
    mode: { type: "string", enum: DEDUCTION_MODES },
    sheetId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

export const operationId = { type: "string", minLength: 1, maxLength: 64 } as const;

export const rowDeductionParams = {
  type: "object",
  required: ["rowId", "geometryId"],
  additionalProperties: false,
  properties: {
    rowId: { type: "string", minLength: 1 },
    geometryId: { type: "string", minLength: 1 },
  },
} as const;

// `version` is the optimistic-concurrency check, in the query string because a
// DELETE carries no body. Without it a stale client withdraws an opening from a
// line someone else has since re-measured.
export const removeDeductionQuery = {
  type: "object",
  required: ["version"],
  additionalProperties: false,
  properties: { version: { type: "integer", minimum: 1 }, operationId },
} as const;

export const editDeductionBody = {
  type: "object",
  required: ["version", "vertices"],
  additionalProperties: false,
  properties: { version: { type: "integer", minimum: 1 }, vertices, operationId },
} as const;

const factorMetres = { type: "number", exclusiveMinimum: 0, maximum: 1000 } as const;

export const editHeightBody = {
  type: "object",
  required: ["version", "heightM"],
  additionalProperties: false,
  properties: { version: { type: "integer", minimum: 1 }, heightM: factorMetres, operationId },
} as const;

export const editDepthBody = {
  type: "object",
  required: ["version", "depthM"],
  additionalProperties: false,
  properties: { version: { type: "integer", minimum: 1 }, depthM: factorMetres, operationId },
} as const;

export const editTypicalBody = {
  type: "object",
  required: ["version", "typical"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    typical: { type: "integer", minimum: 1, maximum: 500 },
    operationId,
  },
} as const;

export const createSessionQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string", maxLength: 200 },
    proposalId: { type: "string", maxLength: 100 },
  },
} as const;

export const listSessionsQuery = {
  type: "object",
  additionalProperties: false,
  properties: { proposalId: { type: "string", maxLength: 100 } },
} as const;

export const billParams = {
  type: "object",
  required: ["billId"],
  additionalProperties: false,
  properties: { billId: { type: "string", minLength: 1 } },
} as const;

export const blankSessionBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    proposalId: { type: "string", maxLength: 100 },
  },
} as const;

export const billBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: { title: { type: "string", minLength: 1, maxLength: 200 } },
} as const;

export const createRowBody = {
  type: "object",
  required: ["description"],
  additionalProperties: false,
  properties: {
    rowType: { type: "string", enum: ROW_TYPES },
    description: { type: "string", minLength: 1, maxLength: 4000 },
    elementGroup: { type: "string", maxLength: 200 },
    code: { type: "string", maxLength: 40 },
    unit: { type: "string", maxLength: 20 },
    qty: { type: "number", minimum: 0 },
    rate: { type: "number", minimum: 0 },
  },
} as const;

export const fromPlanBody = {
  type: "object",
  required: ["proposalId", "planId"],
  additionalProperties: false,
  properties: {
    proposalId: { type: "string", minLength: 1 },
    planId: { type: "string", minLength: 1 },
    mode: { type: "string", enum: TAKEOFF_MODES },
    scope: {
      type: "object",
      required: ["kind", "elements"],
      additionalProperties: false,
      properties: {
        kind: { type: "string", enum: TAKEOFF_SCOPE_KINDS },
        elements: { type: "array", maxItems: 20, items: { type: "string", enum: BESMM_ELEMENT_ORDER } },
      },
    },
  },
} as const;

export const reverseOperationParams = {
  type: "object",
  required: ["sessionId", "eventId"],
  additionalProperties: false,
  properties: {
    sessionId: { type: "string", minLength: 1 },
    eventId: { type: "string", minLength: 1 },
  },
} as const;

const expectedVersions = {
  type: "array",
  maxItems: 200,
  items: {
    type: "object",
    required: ["id", "version"],
    additionalProperties: false,
    properties: { id: { type: "string", minLength: 1 }, version: { type: "integer", minimum: 1 } },
  },
} as const;

export const reverseOperationBody = {
  type: "object",
  required: ["operationId"],
  additionalProperties: false,
  properties: {
    operationId: { type: "string", minLength: 1, maxLength: 64 },
    expectedRows: expectedVersions,
    expectedSheets: expectedVersions,
    expectedMarkups: expectedVersions,
  },
} as const;

export const reverseOperationResponse = {
  200: {
    type: "object",
    properties: {
      ok: { type: "boolean" },
      reversed: { type: "boolean" },
      reason: { type: "string" },
    },
  },
} as const;

export const settingsBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    prelimsPct: { type: "number", minimum: 0, maximum: 100 },
    contingencyPct: { type: "number", minimum: 0, maximum: 100 },
    vatPct: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;
