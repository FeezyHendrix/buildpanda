import { REPORT_KINDS } from "./types.ts";
const text = (maxLength: number) => ({ type: "string", maxLength });
const request = {
  type: "object",
  additionalProperties: false,
  required: ["method", "path"],
  properties: {
    method: {
      type: "string",
      enum: [
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "HEAD",
        "OPTIONS",
        "UNKNOWN",
      ],
    },
    path: text(800),
    status: { type: "integer", minimum: 0, maximum: 599 },
    requestId: text(120),
    durationMs: { type: "number", minimum: 0, maximum: 86_400_000 },
  },
} as const;
export const frontendErrorBody = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "name",
    "message",
    "kind",
    "occurredAt",
    "route",
    "sessionId",
    "browser",
    "breadcrumbs",
  ],
  properties: {
    id: { type: "string", pattern: "^[a-zA-Z0-9_-]{8,64}$" },
    sessionId: { type: "string", pattern: "^[a-zA-Z0-9_-]{8,64}$" },
    occurrences: { type: "integer", minimum: 1, maximum: 1000000 },
    name: text(100),
    message: text(2000),
    stack: text(12000),
    componentStack: text(6000),
    kind: { type: "string", enum: REPORT_KINDS },
    occurredAt: text(40),
    release: text(120),
    route: { type: "string", pattern: "^/", maxLength: 800 },
    browser: {
      type: "object",
      additionalProperties: false,
      required: ["userAgent", "language", "viewport", "online", "visibility"],
      properties: {
        userAgent: text(350),
        language: text(30),
        viewport: text(30),
        online: { type: "boolean" },
        visibility: text(30),
      },
    },
    request,
    breadcrumbs: {
      type: "array",
      maxItems: 30,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["at", "type", "description"],
        properties: {
          at: text(40),
          type: {
            type: "string",
            enum: ["navigation", "action", "http", "lifecycle"],
          },
          description: text(300),
          method: text(12),
          status: { type: "integer", minimum: 0, maximum: 599 },
          durationMs: { type: "number", minimum: 0, maximum: 86_400_000 },
          requestId: text(120),
        },
      },
    },
  },
} as const;
export const acceptedResponse = {
  202: {
    type: "object",
    properties: {
      accepted: { type: "boolean" },
      id: { type: ["string", "null"] },
    },
  },
} as const;

const { required: singleRequired, ...errorShape } = frontendErrorBody;
export const errorReportBody = {
  ...errorShape,
  anyOf: [{ required: singleRequired }, { required: ["reports"] }],
  properties: {
    ...errorShape.properties,
    reports: {
      type: "array",
      minItems: 1,
      maxItems: 20,
      items: frontendErrorBody,
    },
  },
} as const;
