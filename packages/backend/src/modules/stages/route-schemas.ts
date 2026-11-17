
export const projectIdParams = {
  type: "object",
  properties: { id: { type: "string", minLength: 1 } },
  required: ["id"],
  additionalProperties: false,
} as const;

export const stageParams = {
  type: "object",
  required: ["id", "stageId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    stageId: { type: "string", minLength: 1 },
  },
} as const;

export const buildingQuery = {
  type: "object",
  additionalProperties: false,
  properties: { buildingId: { type: "string", minLength: 1 } },
} as const;

export const STATUS = ["Done", "InProgress", "Pending"] as const;

export const createStageBody = {
  type: "object",
  required: ["name"],
  additionalProperties: false,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    status: { type: "string", enum: STATUS },
    startDate: { type: ["string", "null"], maxLength: 40 },
    endDate: { type: ["string", "null"], maxLength: 40 },
    progressPercent: { type: "integer", minimum: 0, maximum: 100 },
    value: { type: "number", minimum: 0 },
  },
} as const;

export const updateStageBody = {
  type: "object",
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: "string", minLength: 1, maxLength: 120 },
    status: { type: "string", enum: STATUS },
    startDate: { type: ["string", "null"], maxLength: 40 },
    endDate: { type: ["string", "null"], maxLength: 40 },
    progressPercent: { type: "integer", minimum: 0, maximum: 100 },
    value: { type: "number", minimum: 0 },
    contractId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    expectedCost: { type: "number", minimum: 0 },
    estimatedLaborHours: { type: "number", minimum: 0 },
    laborBudget: { type: "number", minimum: 0 },
    materialBudget: { type: "number", minimum: 0 },
  },
} as const;

export const reorderBody = {
  type: "object",
  required: ["stageIds"],
  additionalProperties: false,
  properties: {
    stageIds: {
      type: "array",
      items: { type: "string", minLength: 1 },
      maxItems: 200,
    },
  },
} as const;

export const scheduleOfValuesBody = {
  type: "object",
  required: ["lines"],
  additionalProperties: false,
  properties: {
    lines: {
      type: "array",
      maxItems: 240,
      items: {
        type: "object",
        required: ["period", "percent"],
        additionalProperties: false,
        properties: {
          period: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" },
          percent: { type: "number", minimum: 0, maximum: 100 },
          billed: { type: "boolean" },
        },
      },
    },
  },
} as const;

export const periodParams = {
  type: "object",
  required: ["id", "stageId", "period"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    stageId: { type: "string", minLength: 1 },
    period: { type: "string", pattern: "^[0-9]{4}-(0[1-9]|1[0-2])$" },
  },
} as const;

export const scheduleProgressBody = {
  type: "object",
  required: ["percentComplete"],
  additionalProperties: false,
  properties: {
    percentComplete: { type: ["number", "null"], minimum: 0, maximum: 100 },
    /** A month later than the current one is a projection, never a claim. */
    forecast: { type: "boolean" },
  },
} as const;

export const scheduleOfValueSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    stageId: { type: "string" },
    period: { type: "string" },
    percent: { type: "number" },
    amount: { type: "number" },
    billed: { type: "boolean" },
    sortOrder: { type: "integer" },
    percentComplete: { type: ["number", "null"] },
    periodPercent: { type: "number" },
    periodAmount: { type: "number" },
    toDateAmount: { type: "number" },
    forecast: { type: "boolean" },
    claimable: { type: "boolean" },
  },
} as const;

export const scheduleOfValuesResponse = {
  200: { type: "array", items: scheduleOfValueSchema },
} as const;

export const valueSummarySchema = {
  type: "object",
  properties: {
    valueTotal: { type: "number" },
    contractSum: { type: "number" },
    unallocated: { type: "number" },
    allocatedPercent: { type: "number" },
  },
} as const;

