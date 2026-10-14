export const channelIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

export const messageIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

export const listMessagesQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    before: { type: "string", minLength: 1, maxLength: 100 },
    limit: { type: "integer", minimum: 1, maximum: 100 },
  },
} as const;

export const referenceItem = {
  type: "object",
  required: ["type", "id", "label"],
  additionalProperties: false,
  properties: {
    type: { type: "string", minLength: 1, maxLength: 40 },
    id: { type: "string", minLength: 1, maxLength: 100 },
    label: { type: "string", maxLength: 300 },
  },
} as const;

export const mentionItem = {
  type: "object",
  required: ["kind"],
  additionalProperties: false,
  properties: {
    kind: { type: "string", enum: ["user", "here", "channel"] },
    userId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

export const attachmentItem = {
  type: "object",
  required: ["fileId", "url", "name"],
  additionalProperties: false,
  properties: {
    fileId: { type: "string", minLength: 1, maxLength: 100 },
    url: { type: "string", minLength: 1, maxLength: 2000 },
    name: { type: "string", minLength: 1, maxLength: 300 },
    mime: { type: "string", maxLength: 200 },
    size: { type: "integer", minimum: 0 },
  },
} as const;

export const sendMessageBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", maxLength: 8000 },
    contentHtml: { type: ["string", "null"], maxLength: 50000 },
    parentMessageId: { type: ["string", "null"], maxLength: 100 },
    quotedMessageId: { type: ["string", "null"], maxLength: 100 },
    references: { type: "array", maxItems: 50, items: referenceItem },
    mentions: { type: "array", maxItems: 100, items: mentionItem },
    attachments: { type: "array", maxItems: 20, items: attachmentItem },
  },
} as const;

export const editMessageBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", maxLength: 8000 },
    contentHtml: { type: ["string", "null"], maxLength: 50000 },
  },
} as const;

export const createChannelBody = {
  type: "object",
  required: ["type", "name"],
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["project", "org"] },
    name: { type: "string", minLength: 1, maxLength: 80 },
    projectId: { type: ["string", "null"], maxLength: 100 },
    organizationId: { type: ["string", "null"], maxLength: 100 },
    isPrivate: { type: "boolean" },
    topic: { type: ["string", "null"], maxLength: 500 },
    memberIds: { type: "array", maxItems: 200, items: { type: "string", minLength: 1, maxLength: 100 } },
  },
} as const;

export const membershipBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    muted: { type: "boolean" },
    notifyLevel: { type: "string", enum: ["all", "mentions", "none"] },
    lastReadMessageId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

export const addMembersBody = {
  type: "object",
  required: ["memberIds"],
  additionalProperties: false,
  properties: {
    memberIds: { type: "array", minItems: 1, maxItems: 200, items: { type: "string", minLength: 1, maxLength: 100 } },
  },
} as const;
