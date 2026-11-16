
export const STATUS = ["Todo", "Doing", "Done"] as const;
export const PRIORITY = ["Low", "Medium", "High"] as const;

export const assigneesSchema = {
  type: "array",
  maxItems: 20,
  items: {
    type: "object",
    required: ["kind", "id"],
    additionalProperties: false,
    properties: {
      kind: { type: "string", enum: ["user", "team"] },
      id: { type: "string", minLength: 1, maxLength: 100 },
    },
  },
} as const;

export const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

export const taskParams = {
  type: "object",
  required: ["id", "taskId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    taskId: { type: "string", minLength: 1 },
  },
} as const;

export const createBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    description: { type: ["string", "null"], maxLength: 50000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    assigneeTeamMemberId: { type: ["string", "null"], maxLength: 100 },
    assignees: assigneesSchema,
    dueDate: { type: ["string", "null"], maxLength: 40 },
    priority: { type: "string", enum: PRIORITY },
    labels: { type: "array", maxItems: 20, items: { type: "string", maxLength: 40 } },
    columnId: { type: ["string", "null"], maxLength: 100 },
    status: { type: "string", enum: STATUS },
  },
} as const;

export const updateBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 200 },
    description: { type: ["string", "null"], maxLength: 50000 },
    descriptionHtml: { type: ["string", "null"], maxLength: 200000 },
    assigneeId: { type: ["string", "null"], maxLength: 100 },
    assigneeTeamMemberId: { type: ["string", "null"], maxLength: 100 },
    assignees: assigneesSchema,
    dueDate: { type: ["string", "null"], maxLength: 40 },
    priority: { type: "string", enum: PRIORITY },
    labels: { type: "array", maxItems: 20, items: { type: "string", maxLength: 40 } },
  },
} as const;

export const moveBody = {
  type: "object",
  required: ["columnId", "position"],
  additionalProperties: false,
  properties: {
    columnId: { type: "string", minLength: 1, maxLength: 100 },
    position: { type: "number" },
  },
} as const;

export const commentBody = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: { body: { type: "string", minLength: 1, maxLength: 2000 } },
} as const;

export const subtaskParams = {
  type: "object",
  required: ["id", "taskId", "subtaskId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    taskId: { type: "string", minLength: 1 },
    subtaskId: { type: "string", minLength: 1 },
  },
} as const;

export const createSubtaskBody = {
  type: "object",
  required: ["title"],
  additionalProperties: false,
  properties: { title: { type: "string", minLength: 1, maxLength: 300 } },
} as const;

export const updateSubtaskBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 300 },
    done: { type: "boolean" },
  },
} as const;

export const createLinkBody = {
  type: "object",
  required: ["targetTaskId"],
  additionalProperties: false,
  properties: {
    targetTaskId: { type: "string", minLength: 1, maxLength: 100 },
    linkType: { type: "string", enum: ["relates_to", "blocks", "blocked_by", "duplicates"] },
  },
} as const;

export const createEntityLinkBody = {
  type: "object",
  required: ["entityType", "entityId"],
  additionalProperties: false,
  properties: {
    entityType: {
      type: "string",
      enum: ["rfi", "change_request", "material", "invoice", "milestone_payment"],
    },
    entityId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

export const linkParams = {
  type: "object",
  required: ["id", "taskId", "linkId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    taskId: { type: "string", minLength: 1 },
    linkId: { type: "string", minLength: 1 },
  },
} as const;

