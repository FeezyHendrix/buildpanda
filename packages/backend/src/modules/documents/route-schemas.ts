import { DOCUMENT_VISIBILITIES } from "./types.ts";

export const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
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

export const registerFields = {
  title: { type: ["string", "null"], maxLength: 300 },
  revision: { type: ["string", "null"], maxLength: 50 },
  supersedesId: { type: ["string", "null"], maxLength: 100 },
  visibility: { type: "string", enum: [...DOCUMENT_VISIBILITIES] },
  documentDate: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
} as const;

export const createDocumentBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    categoryId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    fileId: { type: "string", minLength: 1, maxLength: 100 },
    fileName: { type: "string", minLength: 1, maxLength: 255 },
    size: { type: "string", minLength: 1, maxLength: 50 },
    uploadedAt: { type: "string", minLength: 1, maxLength: 100 },
    status: { type: "string", enum: ["Verified", "Pending", "Expired"] },
    ...registerFields,
  },
} as const;

export const editDocumentBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    categoryId: { type: "string", minLength: 1, maxLength: 100 },
    fileName: { type: "string", minLength: 1, maxLength: 255 },
    status: { type: "string", enum: ["Verified", "Pending", "Expired"] },
    ...registerFields,
  },
} as const;

export const versionViewParams = {
  type: "object",
  required: ["id", "documentId", "versionId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    documentId: { type: "string", minLength: 1 },
    versionId: { type: "string", minLength: 1 },
  },
} as const;

export const addVersionBody = {
  type: "object",
  required: ["fileId"],
  additionalProperties: false,
  properties: {
    fileId: { type: "string", minLength: 1, maxLength: 100 },
    revisionLabel: { type: "string", minLength: 1, maxLength: 50 },
    notes: { type: "string", maxLength: 1000 },
  },
} as const;

