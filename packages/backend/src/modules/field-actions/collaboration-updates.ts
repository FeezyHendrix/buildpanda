import { BadRequestError } from "../../lib/errors.ts";
import { updatesRepository } from "../updates/repository.ts";
import { updatesService } from "../updates/service.ts";
import { filesRepository } from "../files/repository.ts";
import { filesService } from "../files/service.ts";
import { collaborationFileId, collaborationFiles } from "./collaboration-files.ts";
import { collaborationSchemas } from "./collaboration-schemas.ts";
import type { CollaborationPayloads } from "./collaboration-types.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import type { FieldToolHandler } from "./tool-types.ts";

const update: FieldToolHandler = async (input, context) => {
  await context.requireFeature("project.updates");
  const kind = input.kind as "create_project_update" | "edit_project_update" | "delete_project_update" | "comment_project_update";
  const payload = validateFieldPayload<CollaborationPayloads[typeof kind]>(collaborationSchemas[kind], input.payload);
  if (kind === "comment_project_update") {
    await context.request.requireProjectPermission(input.projectId, "updates", "view");
    await context.request.requireProjectPermission(input.projectId, "comments", "post");
  } else await context.request.requireProjectPermission(input.projectId, "updates", "post");
  const files = await collaborationFiles(context, payload);
  if ("media" in payload) payload.media?.forEach((item) => {
    const id = collaborationFileId(item.url), file = files.find((row) => row.id === id);
    if (!file || !file.mime_type.startsWith(item.type === "photo" ? "image/" : "video/")) throw new BadRequestError("Choose a matching project photo or video.");
  });
  const service = updatesService(updatesRepository(context.db), filesService(filesRepository(context.db)));
  if (kind === "create_project_update") {
    const body = payload as CollaborationPayloads["create_project_update"];
    const record = await service.create(input.projectId, body, context.user);
    return { kind, projectId: input.projectId, recordId: record.id, message: "Project update published." };
  }
  const { updateId, ...body } = payload as CollaborationPayloads["comment_project_update"] & CollaborationPayloads["edit_project_update"];
  if (kind === "comment_project_update") {
    const comment = await service.addComment(input.projectId, updateId, body, context.user);
    return { kind, projectId: input.projectId, recordId: comment.id, message: "Comment added to the project update.", data: { updateId } };
  }
  if (kind === "delete_project_update") {
    await service.remove(input.projectId, updateId);
    return { kind, projectId: input.projectId, recordId: updateId, message: "Project update deleted." };
  }
  const record = await service.edit(input.projectId, updateId, body);
  return { kind, projectId: input.projectId, recordId: record.id, message: "Project update updated." };
};

export const collaborationUpdateHandlers = { create_project_update: update, edit_project_update: update, delete_project_update: update, comment_project_update: update } satisfies Record<string, FieldToolHandler>;
