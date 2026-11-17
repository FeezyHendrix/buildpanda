import AjvCompiler from "@fastify/ajv-compiler";
import { htmlFromText } from "@buildpanda/rich-content";
import { BadRequestError } from "../../lib/errors.ts";
import { sanitizeHtmlFields } from "../../lib/rich-text.ts";
import { entryBody, upsertBody } from "../daily-logs/schemas.ts";
import type { DailyLogCommand } from "./types.ts";

const compile = AjvCompiler()({}, { customOptions: {} });
const commandProperties = {
  projectId: { type: "string", minLength: 1, maxLength: 100 },
  buildingId: { type: "string", minLength: 1, maxLength: 100 },
  logDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
};
const validators = {
  daily_log: compile({ method: "POST", url: "/field-actions/daily-log", httpPart: "body", schema: {
    type: "object", required: ["kind", "projectId", "buildingId", "logDate", "payload"], additionalProperties: false,
    properties: { ...commandProperties, kind: { const: "daily_log" }, payload: entryBody },
  } }),
  update_daily_log: compile({ method: "PUT", url: "/field-actions/daily-log", httpPart: "body", schema: {
    type: "object", required: ["kind", "projectId", "buildingId", "logDate", "payload"], additionalProperties: false,
    properties: { ...commandProperties, kind: { const: "update_daily_log" }, payload: upsertBody },
  } }),
};

export function validateDailyLogCommand(input: unknown): DailyLogCommand {
  const kind = input && typeof input === "object" ? (input as { kind?: unknown }).kind : undefined;
  if (kind !== "daily_log" && kind !== "update_daily_log") throw new BadRequestError("Unsupported field action");
  const value = structuredClone(input) as DailyLogCommand;
  const validate = validators[kind];
  if (!validate(value)) throw new BadRequestError("The daily-log action needs valid fields", validate.errors);
  const date = new Date(`${value.logDate}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value.logDate) {
    throw new BadRequestError("logDate must be a valid calendar date");
  }
  if (value.payload.buildingId && value.payload.buildingId !== value.buildingId) {
    throw new BadRequestError("The action and payload must use the same building");
  }
  value.payload.buildingId = value.buildingId;
  if (value.kind === "daily_log" && value.payload.bodyHtml == null && value.payload.bodyText != null) {
    value.payload.bodyHtml = htmlFromText(value.payload.bodyText);
  }
  value.payload = sanitizeHtmlFields(value.payload) as typeof value.payload;
  if (!validate(value)) throw new BadRequestError("The daily-log action needs valid fields", validate.errors);
  return value;
}
