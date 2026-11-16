import { htmlFromText } from "@buildpanda/rich-content";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { assertMaterialsAction, MATERIAL_APPROVAL_STATUSES } from "../materials-equipment/permissions.ts";
import { materialPatchBody } from "../materials-equipment/schemas.ts";
import type { CreateMaterialOrderInput, UpdateMaterialOrderInput, RecordDeliveryInput } from "../materials-equipment/types.ts";
import { buildMaterialsServices } from "../materials-equipment/wiring.ts";
import { requireMaterialLogPermission } from "../materials-ledger/permissions.ts";
import { validateMaterialQuantity } from "../materials-ledger/quantity.ts";
import type { LogEntryInput } from "../materials-ledger/types.ts";
import { buildMaterialsLedgerService } from "../materials-ledger/wiring.ts";
import { canonicalUnit } from "../materials-ledger/units.ts";
import { requireSiteRecordReferences } from "./site-records-access.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import type { FieldToolHandler } from "./tool-types.ts";

export const materialsRecordHandler: FieldToolHandler = async (input, context) => {
  const projectId = input.projectId, actorId = context.user.id;
  await context.requireFeature("commercial.materialsEquipment", "Materials and equipment");
  if (input.kind === "material_log" || input.kind === "void_ledger_entry") {
    await context.requireFeature("commercial.materialsLedger", "Materials ledger");
    const ledger = buildMaterialsLedgerService(context.db, context.queue);
    if (input.kind === "void_ledger_entry") {
      await context.request.requireProjectPermission(projectId, "materials", "manage");
      const entry = await ledger.voidEntry(projectId, input.payload.entryId as string, input.payload.reason as string, actorId);
      return { kind: input.kind, projectId, recordId: entry.id };
    }
    const payload = input.payload as unknown as LogEntryInput;
    await requireMaterialLogPermission(context.request, projectId, payload.entryType);
    if (!payload.materialName.trim() || !payload.unit?.trim()) throw new BadRequestError("Provide the material and its explicit unit");
    validateMaterialQuantity(payload.quantity);
    await requireSiteRecordReferences(context, input.payload);
    const saved = await ledger.logEntry(projectId, { ...payload,
      notesHtml: payload.notesHtml ?? (payload.reason == null ? null : htmlFromText(payload.reason)),
      idempotencyKey: input.idempotencyKey }, actorId);
    return { kind: input.kind, projectId, recordId: saved.entry.id,
      data: { materialName: saved.entry.materialName, quantity: saved.entry.quantity, unit: saved.entry.unit, onHandQty: saved.onHandQty, duplicate: saved.duplicate } };
  }
  const project = await context.request.requireProjectPermission(projectId, "materials", "request");
  const { repository, service, deliveries } = buildMaterialsServices({ db: context.db });
  const { orderId, ...body } = input.payload;
  let recordId: string;
  switch (input.kind) {
    case "material_order": {
      const payload = body as unknown as CreateMaterialOrderInput;
      assertMaterialsAction(context.request, project, payload.status && MATERIAL_APPROVAL_STATUSES.has(payload.status) ? "approve" : "request");
      await requireSiteRecordReferences(context, body);
      recordId = (await service.createMaterialOrder(projectId, payload, actorId)).id; break;
    }
    case "update_material_order": {
      const patch = validateFieldPayload<UpdateMaterialOrderInput>(materialPatchBody, input.payload.patch);
      assertMaterialsAction(context.request, project, patch.status && MATERIAL_APPROVAL_STATUSES.has(patch.status) ? "approve" : "request");
      await requireSiteRecordReferences(context, patch as Record<string, unknown>);
      recordId = (await deliveries.update(projectId, orderId as string, patch, actorId)).id; break;
    }
    case "receive_material_order": {
      assertMaterialsAction(context.request, project, "approve");
      const { unit, ...delivery } = body;
      const order = await repository.lockMaterialOrder(projectId, orderId as string);
      if (!order) throw new NotFoundError("Material order");
      if (canonicalUnit(unit as string) !== canonicalUnit(order.unit)) {
        throw new BadRequestError("The delivered quantity uses a different unit from the order. Confirm the quantity in the existing order's unit; Panda cannot guess a conversion.");
      }
      await requireSiteRecordReferences(context, delivery);
      const record = await deliveries.record(projectId, orderId as string, delivery as unknown as RecordDeliveryInput, actorId);
      recordId = record.id; break;
    }
    default:
      assertMaterialsAction(context.request, project, "approve");
      await service.deleteMaterialOrder(projectId, orderId as string); recordId = orderId as string;
  }
  return { kind: input.kind, projectId, recordId };
};
