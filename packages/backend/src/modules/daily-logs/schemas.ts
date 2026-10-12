import { REPORT_PERIODS } from "../../lib/report-period.ts";

/** Request validation for the daily-log routes. */

export const projectIdParams = {
  type: "object",
  required: ["id"],
  additionalProperties: false,
  properties: { id: { type: "string", minLength: 1 } },
} as const;

export const dateParams = {
  type: "object",
  required: ["id", "date"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
} as const;

export const listQuery = {
  type: "object",
  additionalProperties: false,
  properties: {
    from: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    to: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    buildingId: { type: "string", minLength: 1, maxLength: 100 },
  },
} as const;

export const upsertBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    // Which block the day belongs to. Required by the service on a
    // multi-building project; the field app always sends it.
    buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    weatherCondition: {
      type: ["string", "null"],
      enum: ["Sunny", "Cloudy", "Rain", "Storm", "Fog", "ExtremeHeat", null],
    },
    temperatureC: { type: ["number", "null"] },
    precipitationMm: { type: ["number", "null"], minimum: 0 },
    windKph: { type: ["number", "null"], minimum: 0 },
    workersExpected: { type: "integer", minimum: 0, maximum: 5000 },
    workersPresent: { type: "integer", minimum: 0, maximum: 5000 },
    totalHours: { type: "number", minimum: 0, maximum: 100000 },
    summary: { type: ["string", "null"], maxLength: 4000 },
    summaryHtml: { type: ["string", "null"], maxLength: 200000 },
  },
} as const;

export const linkActivityBody = {
  type: "object",
  required: ["activityId", "hoursLogged"],
  additionalProperties: false,
  properties: {
    activityId: { type: "string", minLength: 1, maxLength: 100 },
    hoursLogged: { type: "number", minimum: 0, maximum: 5000 },
    postUpdate: { type: "boolean" },
  },
} as const;

export const coverageSchema = {
  type: "object",
  properties: {
    from: { type: ["string", "null"] },
    to: { type: ["string", "null"] },
    workingDays: { type: "integer" },
    daysLogged: { type: "integer" },
    daysMissed: { type: "integer" },
    missedDates: { type: "array", items: { type: "string" } },
    calendar: {
      type: "object",
      properties: {
        workingDays: { type: "array", items: { type: "integer" } },
        holidays: { type: "array", items: { type: "string" } },
      },
    },
  },
} as const;

export const voidBody = {
  type: "object",
  required: ["reason"],
  additionalProperties: false,
  properties: {
    reason: { type: "string", minLength: 1, maxLength: 8000 },
  },
} as const;

export const periodReportQuery = {
  type: "object",
  required: ["period"],
  additionalProperties: false,
  properties: {
    period: { type: "string", enum: [...REPORT_PERIODS] },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
} as const;


export const reportEmailBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    email: { type: "string", format: "email", maxLength: 320 },
  },
} as const;

// A free-form entry sends bodyHtml; a template entry sends templateId and
// responses, with bodyHtml as optional notes and photos under the form.
export const entryBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    bodyHtml: { type: ["string", "null"], maxLength: 200000 },
    bodyText: { type: ["string", "null"], maxLength: 20000 },
    buildingId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    templateId: { type: ["string", "null"], minLength: 1, maxLength: 100 },
    responses: {
      type: "object",
      maxProperties: 200,
      additionalProperties: { type: ["string", "number", "boolean", "null"], maxLength: 20000 },
    },
  },
} as const;

export const entryParams = {
  type: "object",
  required: ["id", "date", "entryId"],
  additionalProperties: false,
  properties: {
    id: { type: "string", minLength: 1 },
    date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    entryId: { type: "string", minLength: 1 },
  },
} as const;
