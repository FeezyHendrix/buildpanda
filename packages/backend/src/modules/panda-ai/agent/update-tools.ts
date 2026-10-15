import { fn, tool } from "./tool-helpers.ts";
import { updateAgentRepository } from "./update-repository.ts";
import { updatesRepository } from "../../updates/repository.ts";
import { updateCommentsService } from "../../updates/comments-service.ts";
import { requiredString } from "./tool-input.ts";

export function updateTools() {
  return [tool(fn("get_project_updates",
    "Read the latest 100 published project updates, including their assigned build-stage IDs or linked activity's stage. Use get_schedule to resolve stage names when available. Drafts are excluded.",
    { stageId: { type: "string", description: "Optional build-stage ID to filter updates" } }),
  async (ctx, args) => ({
    output: await updateAgentRepository(ctx.db).publishedUpdates(ctx.projectId,
      typeof args.stageId === "string" ? args.stageId : undefined),
  })), tool(fn("get_update_comments", "Read the discussion on a published project update. Voice notes are identified by duration; do not invent their untranscribed contents.",
    { updateId: { type: "string", description: "Published update ID from get_project_updates" } }, ["updateId"]),
  async (ctx, args) => ({ output: (await updateCommentsService(updatesRepository(ctx.db)).listComments(ctx.projectId, requiredString(args.updateId, 160, "updateId")))
    .map((comment) => ({ author: comment.author.name, body: comment.body, hasAudio: !!comment.audioFileId,
      audioDurationSeconds: comment.audioDurationSeconds, at: comment.createdAt })) }))];
}
