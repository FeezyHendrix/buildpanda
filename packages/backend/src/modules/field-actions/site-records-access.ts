import { assertCanAccessProject } from "../../lib/authorization.ts";
import { BadRequestError, NotFoundError } from "../../lib/errors.ts";
import { accessContextRepository } from "../access-context/repository.ts";
import { resolveAccessContext } from "../access-context/service.ts";
import { activitiesRepository } from "../activities/repository.ts";
import { documentsRepository } from "../documents/repository.ts";
import { drawingMarkupRepository } from "../drawing-markup/repository.ts";
import { requireProjectDrawingTarget } from "../drawing-markup/project-target.ts";
import { stagesRepository } from "../stages/repository.ts";
import { assertTaskBoardAccess, canSeeFullTaskBoard } from "../tasks/access.ts";
import { taskVisibilityRepository } from "../tasks/visibility-repository.ts";
import { taskVisibilityService } from "../tasks/visibility-service.ts";
import type { FieldToolContext } from "./tool-types.ts";

/** Linking a record must not import another project's private identifiers. */
export async function requireSiteRecordReferences(context: FieldToolContext, payload: Record<string, unknown>) {
  const { db, project, request } = context;
  const phaseId = payload.phaseId ?? payload.stageId;
  if (typeof phaseId === "string" && phaseId) {
    if ((await stagesRepository(db).findById(phaseId))?.project_id !== project.id) throw new BadRequestError("Stage does not belong to this project");
  }
  if (typeof payload.activityId === "string" && payload.activityId) {
    const activity = await activitiesRepository(db).findById(payload.activityId);
    if (!activity || activity.project_id !== project.id) throw new BadRequestError("Activity does not belong to this project");
    if (phaseId && activity.phase_id !== phaseId) throw new BadRequestError("Activity does not belong to the selected stage");
    if (context.buildingId && activity.building_id !== context.buildingId) throw new BadRequestError("Activity does not belong to the selected building");
  }
  if (typeof payload.taskId === "string" && payload.taskId) {
    assertTaskBoardAccess(request, project);
    await taskVisibilityService(taskVisibilityRepository(db)).requireVisible(project.id, payload.taskId,
      canSeeFullTaskBoard(request, project) ? undefined : context.user.id);
  }
  if (payload.documentId || payload.documentVersionId || payload.sourceMarkupId) {
    await request.requireProjectPermission(project.id, "documents", "view");
    await requireProjectDrawingTarget(project.id, {
      documentId: payload.documentId as string | undefined, documentVersionId: payload.documentVersionId as string | undefined,
      markupId: payload.sourceMarkupId as string | undefined,
    }, drawingMarkupRepository(db), documentsRepository(db));
  }
  if (typeof payload.sourceMarkupId === "string" && payload.sourceMarkupId) {
    await request.requireProjectPermission(project.id, "documents", "view");
    const markup = await drawingMarkupRepository(db).byId(payload.sourceMarkupId);
    if (!markup || markup.deleted_at || markup.project_id !== project.id ||
      (payload.documentId && markup.document_id !== payload.documentId) ||
      (payload.documentVersionId && markup.document_version_id !== payload.documentVersionId)) throw new NotFoundError("Drawing markup");
  }
  for (const value of [payload.requestedReviewerId, payload.receivedById]) {
    if (typeof value !== "string" || !value) continue;
    const access = resolveAccessContext(value, await accessContextRepository(db).load(value));
    assertCanAccessProject({ id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, access);
  }
  await context.requireFiles(payload);
}
