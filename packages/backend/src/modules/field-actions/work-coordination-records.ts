import { buildChangeServices } from "../change-requests/wiring.ts";
import * as changes from "../change-requests/route-schemas.ts";
import type { CreateChangeRequestInput, UpdateChangeRequestInput } from "../change-requests/types.ts";
import { buildLookAheadsService } from "../look-aheads/wiring.ts";
import * as lookAheads from "../look-aheads/route-schemas.ts";
import type { CreateLookAheadInput, UpdateLookAheadInput } from "../look-aheads/types.ts";
import { coordinationPayload, bodyWithoutTarget, coordinationBuilding, assertTargetBuilding } from "./work-coordination-support.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import type { FieldToolHandler } from "./tool-types.ts";
import { requireCoordinationReferences } from "./work-coordination-references.ts";

const changeHandler: FieldToolHandler = async (input, context) => {
  const payload = coordinationPayload(input);
  const { project, request, user } = context;
  await request.requireProjectPermission(project.id, input.kind === "comment_change_request" ? "comments" : "change-requests", input.kind === "comment_change_request" ? "post" : "manage");
  await context.requireFiles(payload);
  await requireCoordinationReferences((payload.patch ?? payload) as Record<string, unknown>, context);
  const { service, actions, repository, flush } = buildChangeServices(context.db, context.queue);
  const changeId = payload.changeRequestId as string;
  let recordId = changeId;
  if (input.kind === "change_request") recordId = (await service.create(project.id, validateFieldPayload<CreateChangeRequestInput>(changes.createBody, payload), user.id)).id;
  else if (input.kind === "update_change_request") {
    const body = validateFieldPayload<UpdateChangeRequestInput>(changes.updateBody, payload.patch);
    await service.update(project.id, changeId, body, user.id);
  } else if (input.kind === "delete_change_request") {
    await actions.assertRemovable(project.id, changeId, await repository.countReferencingRfis(changeId));
    await service.remove(project.id, changeId);
  } else {
    const body = bodyWithoutTarget<{ body: string }>(payload, "changeRequestId", changes.commentBody);
    recordId = (await service.addComment(project.id, changeId, body.body, { id: user.id, name: user.name })).id;
  }
  await flush();
  return { kind: input.kind, projectId: project.id, recordId };
};

const lookAheadHandler: FieldToolHandler = async (input, context) => {
  const payload = coordinationPayload(input);
  const { project, request } = context;
  await request.requireProjectPermission(project.id, "schedule", "manage");
  const service = buildLookAheadsService(context.db);
  const lookAheadId = payload.lookAheadId as string;
  let recordId = lookAheadId;
  if (input.kind === "look_ahead") {
    const body = validateFieldPayload<CreateLookAheadInput>(lookAheads.lookAheadBody, payload);
    const buildingId = await coordinationBuilding(context, body.buildingId);
    recordId = (await service.create(project.id, { ...body, buildingId }, context.user.id)).id;
  } else {
    const current = await service.get(project.id, lookAheadId);
    assertTargetBuilding(context, current.buildingId);
    if (input.kind === "update_look_ahead") await service.update(project.id, lookAheadId,
      validateFieldPayload<UpdateLookAheadInput>(lookAheads.lookAheadPatchBody, payload.patch));
    else await service.remove(project.id, lookAheadId);
  }
  return { kind: input.kind, projectId: project.id, recordId };
};

export const workRecordHandlers = {
  change_request: changeHandler, update_change_request: changeHandler,
  delete_change_request: changeHandler, comment_change_request: changeHandler,
  look_ahead: lookAheadHandler, update_look_ahead: lookAheadHandler, delete_look_ahead: lookAheadHandler,
} satisfies Record<string, FieldToolHandler>;
