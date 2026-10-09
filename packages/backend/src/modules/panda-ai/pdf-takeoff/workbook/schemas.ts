// Request schemas for the workbook endpoints.
//
// `additionalProperties: false` is doing real work here. It is what stops a
// client smuggling a field past validation and into a writer — and in
// `rowPatch` in particular it is what keeps the patch surface to exactly
// description and rate, so a quantity, a unit or a status cannot arrive
// alongside them and be picked up by a future reader of the object.
//
// `snapshot` is deliberately `{ type: "object" }` and nothing more. The
// document's real shape is enforced by `validateWorkbookSnapshot`, which parses
// it into a closed type rather than merely checking it, and duplicating that
// grammar as JSON Schema would be two descriptions of one format that could
// drift apart. What is enforced HERE is only what Fastify can enforce cheaply:
// that it is an object at all.

export const workbookSessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1, maxLength: 100 } },
} as const;

export const workbookEventParams = {
  type: "object",
  required: ["sessionId", "eventId"],
  additionalProperties: false,
  properties: {
    sessionId: { type: "string", minLength: 1, maxLength: 100 },
    eventId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

export const workbookHistoryQuery = {
  type: "object",
  additionalProperties: false,
  properties: { limit: { type: "integer", minimum: 1, maximum: 50 } },
} as const;

/**
 * Rate is `number` and never `null`: clearing a rate is something only a
 * compensating undo does, from a state this server recorded. A client that
 * wants a line to price at nothing types a zero.
 */
const rowPatch = {
  type: "object",
  required: ["rowId", "version"],
  additionalProperties: false,
  properties: {
    rowId: { type: "string", minLength: 1, maxLength: 100 },
    version: { type: "integer", minimum: 1 },
    description: { type: "string", minLength: 1, maxLength: 500 },
    rate: { type: "number", minimum: 0, maximum: 1000000000 },
  },
} as const;

const expectedState = {
  expectedVersion: { type: "integer", minimum: 0 },
  expectedSourceFingerprint: { type: "string", minLength: 64, maxLength: 64 },
} as const;

export const workbookOperationBody = {
  type: "object",
  required: ["operationId", "expectedVersion", "expectedSourceFingerprint", "snapshot"],
  additionalProperties: false,
  properties: {
    operationId: { type: "string", minLength: 1, maxLength: 64 },
    ...expectedState,
    snapshot: { type: "object" },
    rowPatches: { type: "array", maxItems: 500, items: rowPatch },
  },
} as const;

export const workbookReverseBody = {
  type: "object",
  required: ["operationId", "expectedVersion", "expectedSourceFingerprint"],
  additionalProperties: false,
  properties: {
    operationId: { type: "string", minLength: 1, maxLength: 64 },
    ...expectedState,
  },
} as const;
