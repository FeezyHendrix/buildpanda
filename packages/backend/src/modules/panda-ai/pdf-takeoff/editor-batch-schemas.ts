// The `as const` JSON schemas for the five bulk editor operations. Split out
// of `route-schemas.ts` to keep both files inside the file ceiling; they are
// runtime validation values, so they stay beside the routes they guard.
import { operationId } from "./route-schemas.ts";

const version = { type: "integer", minimum: 1 } as const;

const expectedVersions = {
  type: "array",
  minItems: 1,
  maxItems: 200,
  items: {
    type: "object",
    required: ["id", "version"],
    additionalProperties: false,
    properties: { id: { type: "string", minLength: 1 }, version },
  },
} as const;

export const splitPolylineBody = {
  type: "object",
  required: ["version", "splitAtIndex"],
  additionalProperties: false,
  properties: { version, splitAtIndex: { type: "integer", minimum: 1, maximum: 2000 }, operationId },
} as const;

// `version` rides the query string because a DELETE carries no body: without
// it a stale client trims a run somebody else has since re-measured.
export const removeSegmentQuery = {
  type: "object",
  required: ["version"],
  additionalProperties: false,
  properties: { version, operationId },
} as const;

export const rowSegmentParams = {
  type: "object",
  required: ["rowId", "segmentIndex"],
  additionalProperties: false,
  properties: { rowId: { type: "string", minLength: 1 }, segmentIndex: { type: "integer", minimum: 0 } },
} as const;

export const duplicateGeometryBody = {
  type: "object",
  required: ["version"],
  additionalProperties: false,
  properties: { version, operationId },
} as const;

export const geometryParams = {
  type: "object",
  required: ["geometryId"],
  additionalProperties: false,
  properties: { geometryId: { type: "string", minLength: 1 } },
} as const;

export const mergeGeometriesBody = {
  type: "object",
  required: ["rowIds", "operationId", "expectedRows", "expectedSheets"],
  additionalProperties: false,
  properties: {
    rowIds: { type: "array", minItems: 2, maxItems: 200, items: { type: "string", minLength: 1 } },
    operationId,
    expectedRows: expectedVersions,
    expectedSheets: expectedVersions,
  },
} as const;

export const reassignGeometryBody = {
  type: "object",
  required: ["targetRowId", "operationId", "expectedRows", "expectedSheets"],
  additionalProperties: false,
  properties: {
    targetRowId: { type: "string", minLength: 1 },
    operationId,
    expectedRows: expectedVersions,
    expectedSheets: expectedVersions,
  },
} as const;

// One allowlist for every bill line these routes answer with: a response
// schema is what keeps a column nobody meant to publish out of the payload.
const boqRow = {
  type: "object",
  properties: {
    id: { type: "string" },
    billId: { type: "string" },
    sort: { type: "integer" },
    rowType: { type: "string" },
    elementGroup: { type: ["string", "null"] },
    code: { type: ["string", "null"] },
    description: { type: "string" },
    unit: { type: ["string", "null"] },
    qtyGross: { type: ["number", "null"] },
    deductions: { type: "array", items: { type: "object", additionalProperties: true } },
    typical: { type: "integer" },
    qty: { type: ["number", "null"] },
    rate: { type: ["number", "null"] },
    amount: { type: ["number", "null"] },
    rateSource: { type: ["string", "null"] },
    confidence: { type: ["string", "null"] },
    status: { type: ["string", "null"] },
    version: { type: "integer" },
    measurementBasis: { type: ["string", "null"] },
    confidenceReason: { type: ["string", "null"] },
    provenance: { type: ["string", "null"] },
    // A `response` schema is an allowlist: a field the DTO gained and this did
    // not is silently dropped on the way out, which is how these five routes
    // came to serve a line with no record of the instances it stands for while
    // the snapshot route served them.
    measurementSettings: { type: ["object", "null"], additionalProperties: true },
    origin: { type: "string" },
    editedAt: { type: ["string", "null"] },
    editedBy: { type: ["string", "null"] },
    verifiedBy: { type: ["string", "null"] },
    verifiedAt: { type: ["string", "null"] },
  },
} as const;

export const splitPolylineResponse = {
  200: {
    type: "object",
    properties: { original: boqRow, pieces: { type: "array", items: { type: "string" } } },
  },
} as const;

export const rowResponse = { 200: boqRow } as const;

export const duplicateGeometryResponse = {
  200: { type: "object", properties: { newRow: boqRow, newGeometryId: { type: "string" } } },
} as const;

export const mergeGeometriesResponse = {
  200: {
    type: "object",
    properties: { keptRow: boqRow, mergedRowIds: { type: "array", items: { type: "string" } } },
  },
} as const;

export const reassignGeometryResponse = {
  200: { type: "object", properties: { sourceRow: boqRow, targetRow: boqRow } },
} as const;
