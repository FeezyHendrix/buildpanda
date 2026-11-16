import { GEOMETRY_SPACES, MARKUP_KINDS, MEDIA_KINDS } from "./types.ts";

export const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

export const markupParams = {
  type: "object",
  required: ["id", "markupId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    markupId: { type: "string", minLength: 1 },
  },
} as const;

export const documentParams = {
  type: "object",
  required: ["id", "documentId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    documentId: { type: "string", minLength: 1 },
  },
} as const;

export const listQuery = {
  type: "object",
  required: ["documentVersionId"],
  additionalProperties: false,
  properties: {
    documentVersionId: { type: "string", minLength: 1 },
    pageNo: { type: "integer", minimum: 1 },
  },
} as const;

export const point = {
  type: "object",
  required: ["x", "y"],
  additionalProperties: false,
  properties: { x: { type: "number" }, y: { type: "number" } },
} as const;

export const geometry = {
  oneOf: [
    { type: "object", required: ["kind", "at"], additionalProperties: false, properties: {
      kind: { const: "pin" }, space: { type: "string", enum: GEOMETRY_SPACES }, at: point,
    } },
    { type: "object", required: ["kind", "points"], additionalProperties: false, properties: {
      kind: { const: "pen" }, space: { type: "string", enum: GEOMETRY_SPACES },
      points: { type: "array", minItems: 2, maxItems: 1000, items: point },
    } },
    { type: "object", required: ["kind", "rect"], additionalProperties: false, properties: {
      kind: { const: "cloud" }, space: { type: "string", enum: GEOMETRY_SPACES },
      rect: { type: "object", required: ["x", "y", "w", "h"], additionalProperties: false, properties: {
        x: { type: "number" }, y: { type: "number" }, w: { type: "number", exclusiveMinimum: 0 }, h: { type: "number", exclusiveMinimum: 0 },
      } },
    } },
    { type: "object", required: ["kind", "a", "b"], additionalProperties: false, properties: {
      kind: { const: "measure" }, space: { type: "string", enum: GEOMETRY_SPACES }, a: point, b: point,
    } },
  ],
} as const;

export const createMarkupBody = {
  type: "object",
  required: ["documentId", "documentVersionId", "kind", "geometry"],
  additionalProperties: false,
  properties: {
    documentId: { type: "string", minLength: 1, maxLength: 100 },
    documentVersionId: { type: "string", minLength: 1, maxLength: 100 },
    pageNo: { type: "integer", minimum: 1 },
    kind: { type: "string", enum: MARKUP_KINDS },
    geometry,
    color: { type: "string", minLength: 1, maxLength: 20 },
  },
} as const;

export const createCommentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", minLength: 1, maxLength: 4000 },
    bodyHtml: { type: ["string", "null"], maxLength: 200000 },
    mediaKind: { type: ["string", "null"], enum: [...MEDIA_KINDS, null] },
    fileId: { type: ["string", "null"], maxLength: 100 },
    mediaDurationSeconds: { type: ["integer", "null"], minimum: 0 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
  },
} as const;

export const resolveBody = {
  type: "object",
  required: ["resolved"],
  additionalProperties: false,
  properties: { resolved: { type: "boolean" } },
} as const;

// ── WS-M1D: markups on take-off sheets ────────────────────────────────────

export const sessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

export const preconMarkupParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

export const preconCommentParams = {
  type: "object",
  required: ["id", "commentId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    commentId: { type: "string", minLength: 1 },
  },
} as const;

export const sessionListQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    sheetId: { type: "string", minLength: 1 },
    includeDeleted: { type: "boolean" },
  },
} as const;

// Required. Withdrawing evidence without saying which version you are
// withdrawing is a delete aimed at whatever happens to be there.
export const deleteMarkupQuery = {
  type: "object",
  required: ["version"],
  additionalProperties: false,
  properties: { version: { type: "integer", minimum: 1 } },
} as const;

// One declaration for both the create and the edit: a pen a stroke may be
// DRAWN with and a pen it may be RESTATED to are the same pen, and two schemas
// would let one of them quietly accept a width the other refuses.
export const style = {
  type: "object",
  additionalProperties: false,
  properties: {
    color: { type: "string", minLength: 1, maxLength: 20 },
    strokeWidthPx: { type: "number", minimum: 0, maximum: 200 },
  },
} as const;

export const editMarkupBody = {
  type: "object",
  required: ["version"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    geometry,
    color: { type: "string", minLength: 1, maxLength: 20 },
    style,
  },
} as const;

export const editCommentBody = {
  type: "object",
  required: ["version", "body"],
  additionalProperties: false,
  properties: {
    version: { type: "integer", minimum: 1 },
    body: { type: "string", minLength: 1, maxLength: 4000 },
    bodyHtml: { type: ["string", "null"], maxLength: 200000 },
  },
} as const;

export const createPreconMarkupBody = {
  type: "object",
  required: ["sheetId", "kind", "geometry"],
  additionalProperties: false,
  properties: {
    sheetId: { type: "string", minLength: 1, maxLength: 100 },
    rowId: { type: ["string", "null"], maxLength: 100 },
    kind: { type: "string", enum: MARKUP_KINDS },
    geometry,
    color: { type: "string", minLength: 1, maxLength: 20 },
    style,
  },
} as const;

