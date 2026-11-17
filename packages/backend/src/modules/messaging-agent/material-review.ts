import { htmlFromText, referencedFileIds } from "@buildpanda/rich-content";
import { BadRequestError } from "../../lib/errors.ts";
import { sanitizeRichText } from "../../lib/rich-text.ts";
import { validateMaterialQuantity } from "../materials-ledger/quantity.ts";
import { MessagingClarificationError } from "./draft-errors.ts";
import type { MessagingReviewAction } from "./management-types.ts";
import type { MessagingMaterialCommand, MessagingMaterialPayload } from "./material-review-types.ts";
import type { MessagingScope } from "./types.ts";

export const materialDraftFields = ["entryType", "materialName", "quantity", "unit", "reason", "occurredAt", "supplier", "deliveryNote", "locationKey"] as const;
const allowedFields = new Set<string>([...materialDraftFields, "notesHtml"]);
const optionalTextLimits = { reason: 1000, supplier: 200, deliveryNote: 120, locationKey: 100 } as const;

function validOccurrence(value: string): boolean {
  if (value.length > 40 || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value)) return false;
  const day = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(Date.parse(value)) && Number.isFinite(day.getTime()) && day.toISOString().slice(0, 10) === value.slice(0, 10);
}

export function materialReviewCommand(action: MessagingReviewAction, scope: MessagingScope): MessagingMaterialCommand {
  const raw = action.payload;
  if (action.kind !== "material_log" || !raw || typeof raw !== "object" || Array.isArray(raw)
    || Object.keys(raw).some((key) => !allowedFields.has(key)) || referencedFileIds(raw).length) {
    throw new BadRequestError("Material logs accept movement details only. Choose linked records and files in BuildPanda.");
  }
  const missing: string[] = [];
  if (raw.entryType == null || raw.entryType === "") missing.push("whether the material arrived or was used");
  else if (raw.entryType !== "IN" && raw.entryType !== "USED") throw new BadRequestError("Choose received or used for the material movement.");
  if (typeof raw.materialName !== "string" || !raw.materialName.trim()) missing.push("the material name");
  else if (raw.materialName.length > 200) throw new BadRequestError("The material name must be at most 200 characters.");
  if (raw.quantity == null || raw.quantity === "") missing.push("the quantity");
  else if (typeof raw.quantity !== "number" || !Number.isFinite(raw.quantity) || raw.quantity <= 0) {
    missing.push("a numeric quantity greater than zero");
  } else {
    try { validateMaterialQuantity(raw.quantity); }
    catch (error) {
      if (error instanceof BadRequestError) throw new MessagingClarificationError(error.message);
      throw error;
    }
  }
  // A spoken movement needs its actual unit; never use the ledger's fallback 'item'.
  if (typeof raw.unit !== "string" || !raw.unit.trim()) missing.push("the unit (for example, tonnes, m³ or litres)");
  else if (raw.unit.length > 40) throw new BadRequestError("The material unit must be at most 40 characters.");
  if (missing.length) throw new MessagingClarificationError(`I can record this material movement. Please tell me:\n${missing.map((field) => `• ${field}`).join("\n")}`);

  const payload: MessagingMaterialPayload = { entryType: raw.entryType as "IN" | "USED", materialName: raw.materialName as string, quantity: raw.quantity as number, unit: raw.unit as string };
  for (const [key, limit] of Object.entries(optionalTextLimits)) {
    const value = raw[key];
    if (value !== undefined && value !== null && (typeof value !== "string" || value.length > limit)) throw new BadRequestError(`The material ${key} field is invalid.`);
    if (value !== undefined) Object.assign(payload, { [key]: value });
  }
  if (raw.occurredAt !== undefined) {
    if (raw.occurredAt !== null && (typeof raw.occurredAt !== "string" || !validOccurrence(raw.occurredAt))) {
      throw new MessagingClarificationError("When did this movement actually happen? Give its date; an expected delivery date is separate.");
    }
    payload.occurredAt = raw.occurredAt as string | null;
  }
  const mirror = typeof payload.reason === "string" ? sanitizeRichText(htmlFromText(payload.reason)) : null;
  if (raw.notesHtml != null && (typeof raw.notesHtml !== "string" || raw.notesHtml !== mirror)) {
    throw new BadRequestError("Review formatted material notes and files in BuildPanda. Messaging accepts plain delivery notes.");
  }
  if (raw.reason !== undefined || raw.notesHtml !== undefined) payload.notesHtml = mirror;
  return { kind: "material_log", projectId: scope.projectId, payload };
}
