// Request schemas for the operation endpoints.
//
// `additionalProperties: false` everywhere is doing real work: it is what stops a
// client smuggling `qty`, `amount` or a status past validation into a writer. The
// server measures; a client-supplied figure would be a priced line nobody
// computed. The command is a closed discriminated union for the same reason — an
// unrecognised `kind` is rejected at the edge rather than falling through to a
// default branch somewhere.

import { commandRequired } from "./editor-command-required.ts";
import { EDITOR_COMMAND_KINDS } from "./editor-operation-types.ts";
import { DEDUCTION_MODES } from "./editor-types.ts";
import { CROSS_SHEET_MODES } from "./batch-request-types.ts";
import { MEASURE_TOOLS } from "./geometry-types.ts";

const point = { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } } as const;

const vertices = {
  type: "array",
  minItems: 1,
  maxItems: 5000,
  items: { type: "array", minItems: 2, maxItems: 2, items: { type: "number" } },
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

const factor = {
  type: "object",
  additionalProperties: false,
  properties: {
    heightM: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
    depthM: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
  },
} as const;

/** What the QS states about a legacy line that never recorded its own basis. */
const confirm = {
  type: "object",
  required: ["tool", "unit"],
  additionalProperties: false,
  properties: {
    tool: { type: "string", enum: MEASURE_TOOLS },
    unit: { type: "string", minLength: 1, maxLength: 12 },
    factor,
  },
} as const;

const command = {
  type: "object",
  required: ["kind"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: EDITOR_COMMAND_KINDS },
    sheetId: { type: "string", minLength: 1, maxLength: 100 },
    geometryId: { type: "string", minLength: 1, maxLength: 100 },
    rowId: { type: "string", minLength: 1, maxLength: 100 },
    billId: { type: "string", minLength: 1, maxLength: 100 },
    tool: { type: "string", enum: MEASURE_TOOLS },
    vertices,
    description: { type: "string", minLength: 1, maxLength: 500 },
    elementGroup: { type: "string", minLength: 1, maxLength: 120 },
    code: { type: "string", maxLength: 40 },
    unit: { type: "string", minLength: 1, maxLength: 12 },
    factor,
    confirm,
    typical: { type: "integer", minimum: 1, maximum: 500 },
    // repeats: the names a typical line stands for, and splitting one out
    repeatLabels: {
      type: "array",
      minItems: 1,
      maxItems: 500,
      items: { type: "string", minLength: 1, maxLength: 120 },
    },
    confirmed: { type: "boolean" },
    rate: { type: "number", minimum: 0 },
    heightM: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
    depthM: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
    // deductions
    label: { type: "string", minLength: 1, maxLength: 200 },
    // reaching an opening that has no shape: its position, plus exactly what it
    // says now, so a renumbered list refuses rather than lands on another void
    rowVersion: { type: "integer", minimum: 1 },
    index: { type: "integer", minimum: 0, maximum: 500 },
    expect: {
      type: "object",
      required: ["label", "qty"],
      additionalProperties: false,
      properties: {
        label: { type: "string", minLength: 1, maxLength: 200 },
        qty: { type: "number" },
        unit: { type: ["string", "null"], maxLength: 12 },
      },
    },
    qty: { type: "number", exclusiveMinimum: 0, maximum: 1000000 },
    unitConfirmed: { type: "boolean", const: true },
    mode: { type: "string", enum: DEDUCTION_MODES },
    dimensions: {
      type: "object",
      additionalProperties: false,
      properties: {
        widthM: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
        heightM: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
        depthM: { type: "number", exclusiveMinimum: 0, maximum: 1000 },
      },
    },
    // the logical outline: a path of line/arc segments, or marks for a count
    shape: {
      type: "object",
      additionalProperties: false,
      properties: {
        role: { type: "string", enum: ["path", "points"] },
        start: point,
        closed: { type: "boolean" },
        points: { type: "array", minItems: 1, maxItems: 5000, items: point },
        segments: {
          type: "array",
          minItems: 1,
          maxItems: 5000,
          items: {
            type: "object",
            required: ["kind", "end"],
            additionalProperties: false,
            properties: { kind: { type: "string", enum: ["line", "arc"] }, mid: point, end: point },
          },
        },
      },
    },
    // markups
    markupId: { type: "string", minLength: 1, maxLength: 100 },
    commentId: { type: "string", minLength: 1, maxLength: 100 },
    version: { type: "integer", minimum: 1 },
    body: { type: "string", minLength: 1, maxLength: 20000 },
    bodyHtml: { type: ["string", "null"], maxLength: 100000 },
    geometry: { type: "object" },
    color: { type: "string", minLength: 1, maxLength: 20 },
    style: {
      type: "object",
      additionalProperties: false,
      properties: {
        color: { type: "string", minLength: 1, maxLength: 20 },
        strokeWidthPx: { type: "number", minimum: 0, maximum: 200 },
      },
    },
    // overlay: a view record, never a quantity
    overlay: {
      type: ["object", "null"],
      required: ["sourceSheetId", "opacity", "anchors"],
      additionalProperties: false,
      properties: {
        sourceSheetId: { type: "string", minLength: 1, maxLength: 100 },
        opacity: { type: "number", minimum: 0, maximum: 1 },
        anchors: {
          type: "array",
          minItems: 3,
          maxItems: 3,
          items: {
            type: "object",
            required: ["source", "target"],
            additionalProperties: false,
            properties: { source: point, target: point },
          },
        },
      },
    },
    // calibration
    scaleChoice: {
      type: "object",
      required: ["source"],
      additionalProperties: false,
      properties: {
        source: { type: "string", enum: ["sheet", "viewport"] },
        viewportId: { type: "string", minLength: 1, maxLength: 100 },
      },
    },
    mmPerPt: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
    previewToken: { type: "string", minLength: 64, maxLength: 64 },
    reference: {
      type: "object",
      required: ["fromPt", "toPt", "enteredDistance", "unit"],
      additionalProperties: false,
      properties: {
        fromPt: point,
        toPt: point,
        enteredDistance: { type: "number", exclusiveMinimum: 0 },
        unit: { type: "string", enum: ["mm", "cm", "m"] },
      },
    },
    viewports: {
      type: "array",
      maxItems: 50,
      items: {
        type: "object",
        required: ["label", "rect", "scaleMmPerPt"],
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1, maxLength: 100 },
          label: { type: "string", minLength: 1, maxLength: 120 },
          rect: { type: "array", minItems: 4, maxItems: 4, items: { type: "number" } },
          scaleMmPerPt: { type: "number", exclusiveMinimum: 0, maximum: 100000 },
        },
      },
    },
    // batch
    rowIds: { type: "array", minItems: 2, maxItems: 200, items: { type: "string", minLength: 1, maxLength: 100 } },
    targetRowId: { type: "string", minLength: 1, maxLength: 100 },
    targetSheetId: { type: "string", minLength: 1, maxLength: 100 },
    crossSheet: { type: "string", enum: CROSS_SHEET_MODES },
    translate: point,
    about: point,
    rotateDeg: { type: "number", minimum: -360, maximum: 360 },
    cut: { type: "array", minItems: 2, maxItems: 2, items: point },
    assemblyId: { type: "string", minLength: 1, maxLength: 100 },
    vertexIndex: { type: "integer", minimum: 0, maximum: 5000 },
    segmentIndex: { type: "integer", minimum: 0, maximum: 5000 },
    offset: point,
  },
  allOf: commandRequired,
} as const;

/**
 * The same command schema, plus the batch's list of them — whose items are the
 * member schema WITHOUT `commands`. One level by construction, so a nested
 * batch is refused by `additionalProperties: false` before a writer sees it,
 * and every member is validated exactly as a single command would be.
 */
const batchable = {
  ...command,
  properties: {
    ...command.properties,
    commands: { type: "array", minItems: 1, maxItems: 200, items: command },
  },
} as const;

export const editorOperationBody = {
  type: "object",
  required: ["operationId", "command"],
  additionalProperties: false,
  properties: {
    operationId: { type: "string", minLength: 1, maxLength: 64 },
    expectedRows: expectedVersions,
    expectedSheets: expectedVersions,
    expectedMarkups: expectedVersions,
    verify: { type: "boolean" },
    command: batchable,
  },
} as const;

export const editorSessionParams = {
  type: "object",
  required: ["sessionId"],
  additionalProperties: false,
  properties: { sessionId: { type: "string", minLength: 1 } },
} as const;

export const editorHistoryQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    sheetId: { type: "string", minLength: 1, maxLength: 100 },
    limit: { type: "integer", minimum: 1, maximum: 100 },
  },
} as const;

export const editorEventParams = {
  type: "object",
  required: ["sessionId", "eventId"],
  additionalProperties: false,
  properties: {
    sessionId: { type: "string", minLength: 1 },
    eventId: { type: "string", minLength: 1 },
  },
} as const;
