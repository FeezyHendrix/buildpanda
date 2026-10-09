import { fn, tool } from "./tool-helpers.ts";
import { updateAgentRepository } from "./update-repository.ts";

export function updateTools() {
  return [tool(fn("get_project_updates",
    "Read the latest 100 published project updates, including their assigned build-stage IDs or linked activity's stage. Use get_schedule to resolve stage names when available. Drafts are excluded.",
    { stageId: { type: "string", description: "Optional build-stage ID to filter updates" } }),
  async (ctx, args) => ({
    output: await updateAgentRepository(ctx.db).publishedUpdates(ctx.projectId,
      typeof args.stageId === "string" ? args.stageId : undefined),
  }))];
}
