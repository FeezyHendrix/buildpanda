import { MAX_VOICE_NOTE_SECONDS } from "@buildpanda/rich-content";

const updateCategoryEnum = [
  "Progress",
  "Material Delivery",
  "Inspections",
  "Issues",
] as const;

const mediaItems = {
  type: "array",
  maxItems: 10,
  items: {
    type: "object",
    required: ["type", "url"],
    additionalProperties: false,
    properties: {
      type: { type: "string", enum: ["photo", "video"] },
      url: { type: "string", minLength: 1, maxLength: 2000 },
    },
  },
} as const;

export const createUpdateBody = {
  type: "object",
  required: ["category", "title", "description"],
  additionalProperties: false,
  properties: {
    stageId: { type: ["string", "null"], minLength: 1, maxLength: 200 },
    category: { type: "string", enum: [...updateCategoryEnum] },
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    media: mediaItems,
  },
} as const;

export const editUpdateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    stageId: { type: ["string", "null"], minLength: 1, maxLength: 200 },
    category: { type: "string", enum: [...updateCategoryEnum] },
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: "string", minLength: 1, maxLength: 2000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    media: mediaItems,
  },
} as const;

export const updateCommentBody = { type: "object", additionalProperties: false, properties: {
  body: { type: "string", maxLength: 2000 }, bodyHtml: { type: ["string", "null"], maxLength: 200000 },
  audioFileId: { type: ["string", "null"], pattern: "^[a-zA-Z0-9_-]{1,160}$" },
  audioDurationSeconds: { type: ["integer", "null"], minimum: 1, maximum: MAX_VOICE_NOTE_SECONDS },
  clientMutationId: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,160}$" },
} } as const;

