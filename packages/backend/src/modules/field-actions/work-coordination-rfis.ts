import { canProjectPermission } from "../../lib/authorization.ts";
import { requestAccessContext } from "../../lib/authorization-request.ts";
import { buildRfiServices } from "../rfis/wiring.ts";
import { isCompanyCaller } from "../rfis/access.ts";
import * as schemas from "../rfis/route-schemas.ts";
import type { CreateRfiInput, UpdateRfiInput, RespondInput } from "../rfis/service.ts";
import { projectsRepository } from "../projects/repository.ts";
import { usersRepository } from "../users/repository.ts";
import { coordinationPayload, bodyWithoutTarget } from "./work-coordination-support.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import { requireCoordinationReferences } from "./work-coordination-references.ts";
import type { FieldToolHandler } from "./tool-types.ts";

const rfiHandler: FieldToolHandler = async (input, context) => {
  const payload = coordinationPayload(input);
  const { request, project, user } = context;
  const { service, sendBallInCourtEmail, flush } = buildRfiServices(context.db, context.queue);
  const actor = { id: user.id, name: user.name };
  const rfiId = payload.rfiId as string;
  const sharedOnly = !isCompanyCaller(request, project);
  if (input.kind !== "rfi") {
    await request.requireProjectPermission(project.id, "rfis", "view");
    await service.get(project.id, rfiId, sharedOnly);
  }
  await context.requireFiles(payload);
  let recordId = rfiId;
  if (input.kind === "rfi" || input.kind === "update_rfi") {
    await request.requireProjectPermission(project.id, "rfis", input.kind === "rfi" ? "create" : "manage");
    const body = input.kind === "rfi" ? validateFieldPayload<CreateRfiInput>(schemas.createBody, payload)
      : validateFieldPayload<UpdateRfiInput>(schemas.updateBody, payload.patch);
    await requireCoordinationReferences(body as Record<string, unknown>, context);
    const reassigned = body.ballInCourtId !== undefined || body.ballInCourtEmail !== undefined;
    const previous = input.kind === "update_rfi" && reassigned ? await service.get(project.id, rfiId, sharedOnly) : null;
    const saved = input.kind === "rfi" ? await service.create(project.id, body as CreateRfiInput, actor,
      request.projectRoles?.get(project.id) === "client" ? "shared" : "internal")
      : await service.update(project.id, rfiId, body, actor);
    recordId = saved.id;
    if (input.kind === "rfi" || (reassigned && saved.ballInCourtEmail !== previous?.ballInCourtEmail)) {
      const [projectRecord, actorRecord] = await Promise.all([
        projectsRepository(context.db).findById(project.id), usersRepository(context.db).findById(user.id),
      ]);
      await sendBallInCourtEmail(saved, projectRecord?.name ?? "Project", actorRecord?.email ?? "");
    }
  } else if (input.kind === "transition_rfi") {
    await request.requireProjectPermission(project.id, "rfis", "manage");
    const body = bodyWithoutTarget<{ status: typeof schemas.TRANSITION_TARGETS[number] }>(payload, "rfiId", schemas.transitionBody);
    await service.transition(project.id, rfiId, body.status, actor);
  } else if (input.kind === "respond_rfi") {
    await request.requireProjectPermission(project.id, "rfis", "respond");
    const body = bodyWithoutTarget<RespondInput>(payload, "rfiId", schemas.respondBody);
    await requireCoordinationReferences(body as unknown as Record<string, unknown>, context);
    const official = body.official ?? true;
    const mayManage = canProjectPermission({ id: project.id, ownerId: project.owner_id, organizationId: project.organization_id }, requestAccessContext(request), "rfis", "manage");
    await service.respond(project.id, rfiId, { ...body, official }, actor, mayManage);
  } else {
    await request.requireProjectPermission(project.id, "comments", "post");
    const body = bodyWithoutTarget<RespondInput>(payload, "rfiId", schemas.commentBody);
    await requireCoordinationReferences(body as unknown as Record<string, unknown>, context);
    recordId = (await service.addComment(project.id, rfiId, body.body, actor, body)).id;
  }
  await flush();
  return { kind: input.kind, projectId: project.id, recordId };
};

export const workRfiHandlers = {
  rfi: rfiHandler, update_rfi: rfiHandler, transition_rfi: rfiHandler,
  comment_rfi: rfiHandler, respond_rfi: rfiHandler,
} satisfies Record<string, FieldToolHandler>;
