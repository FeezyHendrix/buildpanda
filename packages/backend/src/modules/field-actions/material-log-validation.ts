import AjvCompiler from "@fastify/ajv-compiler";
import { htmlFromText, referencedFileIds } from "@buildpanda/rich-content";
import { BadRequestError } from "../../lib/errors.ts";
import { sanitizeRichText } from "../../lib/rich-text.ts";
import { materialLogBody } from "../materials-ledger/schemas.ts";
import { validateMaterialQuantity } from "../materials-ledger/quantity.ts";
import type { MaterialLogCommand } from "./material-types.ts";

const fields = ["entryType", "materialName", "unit", "quantity", "locationKey", "occurredAt", "reason", "notesHtml", "supplier", "deliveryNote", "idempotencyKey"] as const;
const compile = AjvCompiler()({}, { customOptions: { removeAdditional: false, coerceTypes: false } });
const validate = compile({ method: "POST", url: "/field-actions/material-log", httpPart: "body", schema: {
  type: "object", required: ["kind", "projectId", "payload"], additionalProperties: false,
  properties: {
    kind: { const: "material_log" }, projectId: { type: "string", minLength: 1, maxLength: 100 },
    payload: { ...materialLogBody, required: [...materialLogBody.required, "unit"],
      properties: Object.fromEntries(fields.map((key) => [key, materialLogBody.properties[key]])) },
  },
} });

export function validateMaterialLogCommand(input: unknown): MaterialLogCommand {
  const value = structuredClone(input) as MaterialLogCommand;
  if (!validate(value)) throw new BadRequestError("The material movement needs valid fields", validate.errors);
  if (!value.payload.materialName.trim() || !value.payload.unit.trim() || !Number.isFinite(value.payload.quantity)) {
    throw new BadRequestError("Provide the material, a positive quantity and its unit before confirming");
  }
  validateMaterialQuantity(value.payload.quantity);
  if (referencedFileIds(value.payload).length) throw new BadRequestError("Choose material attachments in BuildPanda before confirming");
  if (value.payload.occurredAt) {
    const date = value.payload.occurredAt;
    const calendar = new Date(`${date.slice(0, 10)}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}(?:T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:[0-5]\d))?$/.test(date) ||
      !Number.isFinite(new Date(date).getTime()) || !Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0, 10) !== date.slice(0, 10)) {
      throw new BadRequestError("The material receipt needs a valid occurredAt date");
    }
  }
  value.payload.materialName = value.payload.materialName.trim();
  value.payload.unit = value.payload.unit.trim();
  if (value.payload.notesHtml == null && value.payload.reason != null) value.payload.notesHtml = htmlFromText(value.payload.reason);
  if (value.payload.notesHtml != null) value.payload.notesHtml = sanitizeRichText(value.payload.notesHtml);
  if (!validate(value)) throw new BadRequestError("The material movement needs valid fields", validate.errors);
  return value;
}
