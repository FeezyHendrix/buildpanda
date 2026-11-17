import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { activitiesRepository } from "../activities/repository.ts";
import { stagesRepository } from "../stages/repository.ts";
import { rfisRepository } from "../rfis/repository.ts";
import { isCompanyCaller } from "../rfis/access.ts";
import { changeRequestsRepository } from "../change-requests/repository.ts";
import { materialsEquipmentRepository } from "../materials-equipment/repository.ts";
import { documentsRepository } from "../documents/repository.ts";
import { drawingMarkupRepository } from "../drawing-markup/repository.ts";
import { requireProjectDrawingTarget } from "../drawing-markup/project-target.ts";
import { tasksRepository } from "../tasks/repository.ts";
import { taskVisibilityRepository } from "../tasks/visibility-repository.ts";
import { taskVisibilityService } from "../tasks/visibility-service.ts";
import { canSeeFullTaskBoard } from "../tasks/access.ts";
import type { FieldToolContext } from "./tool-types.ts";
import { assertTargetBuilding } from "./work-coordination-support.ts";

/** A reviewed ID is still untrusted: every linked record must belong to the authorized project. */
export async function requireCoordinationReferences(payload: Record<string, unknown>, context: FieldToolContext): Promise<void> {
  const { db, project, request } = context;
  const stageId = payload.stageId ?? payload.phaseId;
  if (typeof stageId === "string") {
    const stage = await stagesRepository(db).findById(stageId);
    if (!stage || stage.project_id !== project.id) throw new NotFoundError("Stage");
    assertTargetBuilding(context, stage.building_id);
  }
  for (const key of ["rfiId", "linkedRfiId"]) if (typeof payload[key] === "string") {
    await request.requireProjectPermission(project.id, "rfis", "view");
    const rfi = await rfisRepository(db).findById(payload[key]);
    if (!rfi || rfi.project_id !== project.id || (!isCompanyCaller(request, project) && rfi.visibility !== "shared")) throw new NotFoundError("RFI");
  }
  if (typeof payload.linkedChangeRequestId === "string") {
    await request.requireProjectPermission(project.id, "change-requests", "view");
    const change = await changeRequestsRepository(db).findById(payload.linkedChangeRequestId);
    if (!change || change.project_id !== project.id) throw new NotFoundError("Change request");
  }
  if (typeof payload.linkedMaterialOrderId === "string") {
    await request.requireProjectPermission(project.id, "materials", "view");
    const order = await materialsEquipmentRepository(db).findMaterialOrder(payload.linkedMaterialOrderId);
    if (!order || order.project_id !== project.id) throw new NotFoundError("Material order");
  }
  const drawings = drawingMarkupRepository(db);
  if (payload.documentId || payload.documentVersionId || payload.sourceMarkupId) {
    await request.requireProjectPermission(project.id, "documents", "view");
    await requireProjectDrawingTarget(project.id, {
      documentId: payload.documentId as string | undefined,
      documentVersionId: payload.documentVersionId as string | undefined,
      markupId: payload.sourceMarkupId as string | undefined,
    }, drawings, documentsRepository(db));
    if (payload.sourceMarkupId) {
      const markup = await drawings.byId(payload.sourceMarkupId as string);
      if (!markup || (payload.documentId && markup.document_id !== payload.documentId) || (payload.documentVersionId && markup.document_version_id !== payload.documentVersionId)) throw new BadRequestError("The drawing pin belongs to another document or revision.");
    }
  }
  const assigneeId = payload.ballInCourtId ?? payload.assigneeId;
  if (typeof assigneeId === "string") {
    const choices = await tasksRepository(db).assignableUsers(project.id, project.organization_id, project.owner_id);
    if (!choices.some((choice) => choice.id === assigneeId)) throw new BadRequestError("Choose a participant in this project.");
  }
  for (const reference of (payload.references ?? []) as { type: string; id: string }[]) {
    if (reference.type === "activity") {
      await request.requireProjectPermission(project.id, "schedule", "view");
      const activity = await activitiesRepository(db).findById(reference.id);
      if (!activity || activity.project_id !== project.id) throw new NotFoundError("Activity");
      assertTargetBuilding(context, activity.building_id);
    } else {
      await request.requireProjectPermission(project.id, "tasks", "view");
      await taskVisibilityService(taskVisibilityRepository(db)).requireVisible(project.id, reference.id,
        canSeeFullTaskBoard(request, project) ? undefined : context.user.id);
    }
  }
}
