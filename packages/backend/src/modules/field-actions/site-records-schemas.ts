import { createBody, updateBody, resubmitBody, commentBody } from "../approvals/material-schemas.ts";
import { entryBody, upsertBody, voidBody } from "../daily-logs/schemas.ts";
import { materialBody, materialPatchBody, deliveryBody } from "../materials-equipment/schemas.ts";
import { materialLogBody, voidLedgerBody } from "../materials-ledger/schemas.ts";
import { MAX_MATERIAL_QUANTITY, MATERIAL_QUANTITY_DECIMAL_PLACES } from "../materials-ledger/quantity.ts";
import { createTransactionBody } from "../transactions/schemas.ts";
import { SUPPORTED_CURRENCIES } from "../../lib/currencies.ts";
import type { SiteBodySchema, SiteRecordKind } from "./site-records-types.ts";

const identifier = { type: "string", minLength: 1, maxLength: 100 } as const;
function target(key: string, body?: SiteBodySchema) {
  return { type: "object", additionalProperties: false, required: [key, ...body?.required ?? []],
    ...(body?.minProperties ? { minProperties: body.minProperties + 1 } : {}),
    properties: { [key]: identifier, ...body?.properties } };
}
function day(body: SiteBodySchema) {
  return { ...body, type: "object", additionalProperties: false, required: ["logDate", ...body.required ?? []],
    properties: { ...body.properties, logDate: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } } };
}
const { idempotencyKey: _key, ...movementFields } = materialLogBody.properties;

/** Canonical request bodies plus explicit, authorized record targets. */
export const siteRecordSchemas = {
  daily_log: { ...day(entryBody), anyOf: [
    { type: "object", required: ["templateId"], properties: { templateId: { type: "string", minLength: 1, pattern: "\\S" } } },
    { type: "object", required: ["bodyText"], properties: { bodyText: { type: "string", minLength: 1, pattern: "\\S" } } },
  ] },
  update_daily_log: { ...day(upsertBody), anyOf: Object.entries(upsertBody.properties).filter(([key]) => key !== "buildingId")
    .map(([key, property]) => ({ type: "object", required: [key], properties: { [key]: property } })) },
  void_daily_log_entry: target("entryId", voidBody),
  material_log: { ...materialLogBody, required: [...materialLogBody.required, "unit"], properties: { ...movementFields,
    quantity: { ...movementFields.quantity, maximum: MAX_MATERIAL_QUANTITY, "x-decimalPlaces": MATERIAL_QUANTITY_DECIMAL_PLACES },
    unit: { ...movementFields.unit, minLength: 1, pattern: "\\S" }, materialName: { ...movementFields.materialName, pattern: "\\S" } } },
  void_ledger_entry: target("entryId", voidLedgerBody),
  material_order: materialBody,
  update_material_order: { type: "object", required: ["orderId", "patch"], additionalProperties: false,
    properties: { orderId: identifier, patch: materialPatchBody } },
  delete_material_order: target("orderId"), receive_material_order: target("orderId", {
    ...deliveryBody, required: [...deliveryBody.required, "unit"], properties: { ...deliveryBody.properties,
      deliveredQty: { ...deliveryBody.properties.deliveredQty, maximum: MAX_MATERIAL_QUANTITY, "x-decimalPlaces": MATERIAL_QUANTITY_DECIMAL_PLACES },
      unit: { ...materialLogBody.properties.unit, minLength: 1, pattern: "\\S" },
    },
  }),
  create_material_approval: createBody,
  update_material_approval: target("approvalId", updateBody),
  decide_material_approval: { ...target("approvalId", updateBody), required: ["approvalId", "status"],
    properties: { approvalId: identifier, status: { type: "string", enum: ["Approved", "Rejected", "Resubmit"] },
      response: updateBody.properties.response, responseHtml: updateBody.properties.responseHtml } },
  reopen_material_approval: target("approvalId", resubmitBody),
  delete_material_approval: target("approvalId"), comment_material_approval: target("approvalId", commentBody),
  create_expense: { ...createTransactionBody, required: [...createTransactionBody.required, "currency"],
    properties: { ...createTransactionBody.properties, currency: { type: "string", enum: SUPPORTED_CURRENCIES } } },
} satisfies Record<SiteRecordKind, object>;
