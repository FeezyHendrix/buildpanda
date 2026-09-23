// The `as const` JSON schemas for the two sheet-level editor operations: the
// scale a drawing is measured at, and the regions of it drawn at their own
// scale. Split out of `route-schemas.ts` to keep both files inside the file
// ceiling; they are runtime validation values, so they stay beside the routes.

const sheetViewport = {
  type: "object",
  required: ["label", "rect", "scaleMmPerPt"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1, maxLength: 80 },
    label: { type: "string", minLength: 1, maxLength: 120 },
    rect: { type: "array", minItems: 4, maxItems: 4, items: { type: "number" } },
    scaleMmPerPt: { type: "number", exclusiveMinimum: 0 },
  },
} as const;

const newScaleMmPerPt = { type: "number", exclusiveMinimum: 0, maximum: 100000 } as const;

export const calibrationPreviewBody = {
  type: "object",
  required: ["newScaleMmPerPt", "version"],
  additionalProperties: false,
  properties: { newScaleMmPerPt, version: { type: "integer", minimum: 1 } },
} as const;



export const viewportPreviewBody = {
  type: "object",
  required: ["viewports", "version"],
  additionalProperties: false,
  properties: {
    viewports: { type: "array", maxItems: 50, items: sheetViewport },
    version: { type: "integer", minimum: 1 },
  },
} as const;


const scaleSuggestion = {
  type: "object",
  properties: {
    rowId: { type: "string" },
    geometryId: { type: "string" },
    proposedViewportId: { type: ["string", "null"] },
    unconfirmed: { type: "boolean" },
  },
} as const;

// A response schema is an allowlist: a field missing here is silently dropped on
// the wire. The version of every affected line and the preview token are what
// bind the apply to these figures, so omitting them left the HTTP caller unable
// to commit what it had been shown (contract 12).
export const calibrationPreviewResponse = {
  200: {
    type: "object",
    properties: {
      sheetId: { type: "string" },
      currentScaleMmPerPt: { type: ["number", "null"] },
      newScaleMmPerPt: { type: "number" },
      sheetVersion: { type: "integer" },
      affectedRows: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rowId: { type: "string" },
            description: { type: "string" },
            version: { type: "integer" },
            currentQtyGross: { type: ["number", "null"] },
            newQtyGross: { type: ["number", "null"] },
            currentQty: { type: ["number", "null"] },
            newQty: { type: ["number", "null"] },
            unit: { type: ["string", "null"] },
            contributions: { type: "integer" },
            hasUnresolvableBasis: { type: "boolean" },
          },
        },
      },
      unresolvedCount: { type: "integer" },
      unresolvedRowIds: { type: "array", items: { type: "string" } },
      blocked: { type: "boolean" },
      rebindSuggestions: { type: "array", items: scaleSuggestion },
      legacySuggestions: { type: "array", items: scaleSuggestion },
      previewToken: { type: "string" },
    },
  },
} as const;

export const viewportPreviewResponse = {
  200: {
    type: "object",
    properties: {
      sheetId: { type: "string" },
      sheetVersion: { type: "integer" },
      rescaled: {
        type: "array",
        items: {
          type: "object",
          properties: {
            rowId: { type: "string" },
            description: { type: "string" },
            version: { type: "integer" },
            currentQtyGross: { type: ["number", "null"] },
            newQtyGross: { type: "number" },
            currentQty: { type: ["number", "null"] },
            newQty: { type: "number" },
            unit: { type: ["string", "null"] },
          },
        },
      },
      removed: {
        type: "array",
        items: {
          type: "object",
          properties: {
            viewportId: { type: "string" },
            label: { type: "string" },
            measurements: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  rowId: { type: "string" },
                  geometryId: { type: "string" },
                  description: { type: "string" },
                },
              },
            },
          },
        },
      },
      blocked: { type: "boolean" },
      unresolvedRowIds: { type: "array", items: { type: "string" } },
      previewToken: { type: "string" },
    },
  },
} as const;



