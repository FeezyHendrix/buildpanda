const id = { type: "string", minLength: 1, maxLength: 100 } as const;
const channelId = { type: "string", pattern: "^[a-z][a-z0-9-]{0,49}$", maxLength: 50 } as const;
const accountId = { type: "string", minLength: 1, maxLength: 200 } as const;
const nullableId = { anyOf: [id, { type: "null" }] } as const;
const text = { type: "string" } as const;
const version = { type: "integer", minimum: 1 } as const;
const scope = {
  type: "object", additionalProperties: false, required: ["projectId", "buildingId"],
  properties: { projectId: id, buildingId: nullableId },
} as const;
const action = {
  type: "object", additionalProperties: false, required: ["kind", "payload"],
  properties: {
    kind: { type: "string", enum: ["daily_log", "update_daily_log"] },
    title: { type: "string", maxLength: 200 }, summary: text,
    payload: { type: "object", additionalProperties: true },
    missing: { type: "array", items: text },
  },
} as const;

export const projectParams = {
  type: "object", additionalProperties: false, required: ["projectId"], properties: { projectId: id },
} as const;
export const proposalParams = {
  type: "object", additionalProperties: false, required: ["projectId", "proposalId"],
  properties: { projectId: id, proposalId: id },
} as const;
export const messageParams = {
  type: "object", additionalProperties: false, required: ["projectId", "messageId"],
  properties: { projectId: id, messageId: id },
} as const;
export const linkBody = {
  type: "object", additionalProperties: false, required: ["channel", "accountId", "projectId"],
  properties: { channel: channelId, accountId, projectId: id, buildingId: nullableId },
} as const;
export const scopeBody = {
  type: "object", additionalProperties: false, required: ["connectionId", "buildingId"], properties: { connectionId: id, buildingId: nullableId },
} as const;
export const draftBody = {
  type: "object", additionalProperties: false, required: ["connectionId", "text"],
  properties: { connectionId: id, text: { type: "string", minLength: 1, maxLength: 20_000 } },
} as const;
export const confirmBody = {
  type: "object", additionalProperties: false, required: ["version"], properties: { version },
} as const;
export const editBody = {
  type: "object", additionalProperties: false, required: ["version", "actions"],
  properties: { version, actions: { type: "array", minItems: 1, maxItems: 10, items: action } },
} as const;
export const proposalResponse = {
  type: "object", additionalProperties: false,
  required: ["id", "version", "status", "title", "summary", "actions", "createdAt"],
  properties: {
    id, version, status: { type: "string", enum: ["draft", "confirmed", "completed", "cancelled"] },
    title: text, summary: text, sourceText: text,
    actions: { type: "array", items: action }, createdAt: text,
    result: {
      type: "object", additionalProperties: false,
      properties: { recordId: id, message: text },
    },
  },
} as const;
export const statusResponse = {
  type: "object", additionalProperties: false, required: ["userId", "enabled", "channels", "connections", "projects"],
  properties: {
    userId: id, enabled: { type: "boolean" },
    channels: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["id", "label", "accountId", "enabled"],
      properties: { id: channelId, label: text, accountId, enabled: { type: "boolean" } },
    } },
    connections: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["id", "channel", "accountId", "channelLabel", "linkedAt", "selectedScope"],
      properties: { id, channel: channelId, accountId, channelLabel: text, linkedAt: text, selectedScope: { anyOf: [{ type: "null" }, scope] } },
    } },
    projects: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["id", "name", "organizationId"],
      properties: { id, name: text, organizationId: nullableId },
    } },
  },
} as const;
export const connectionParams = {
  type: "object", additionalProperties: false, required: ["connectionId"], properties: { connectionId: id },
} as const;
export const sessionQuery = {
  type: "object", additionalProperties: false, properties: { connectionId: id },
} as const;
export const linkResponse = {
  type: "object", additionalProperties: false, required: ["code", "expiresAt", "connectUrl"],
  properties: { code: text, expiresAt: text, connectUrl: { anyOf: [text, { type: "null" }] } },
} as const;
export const sessionResponse = {
  type: "object", additionalProperties: false,
  required: ["connectionId", "projectId", "organizationId", "buildingId", "permissions", "buildings", "messages", "proposals"],
  properties: {
    connectionId: nullableId, projectId: id, organizationId: nullableId, buildingId: nullableId,
    permissions: { type: "object", additionalProperties: { type: "array", items: text } },
    buildings: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["id", "name"], properties: { id, name: text },
    } },
    messages: { type: "array", items: {
      type: "object", additionalProperties: false, required: ["id", "role", "text", "createdAt"],
      properties: { id, role: { type: "string", enum: ["user", "assistant"] }, text, createdAt: text,
        status: { type: "string", enum: ["received", "processing", "processed", "failed"] }, retryable: { type: "boolean" },
        inputType: { type: "string", enum: ["text", "audio"] } },
    } },
    proposals: { type: "array", items: proposalResponse },
  },
} as const;
