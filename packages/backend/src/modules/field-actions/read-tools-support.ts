import { buildingsRepository } from "../buildings/repository.ts";
import { buildingsService } from "../buildings/service.ts";
import type { AgentTool } from "../panda-ai/agent/tool-helpers.ts";
import { fn, tool } from "../panda-ai/agent/tool-helpers.ts";
import { fieldToolContext } from "./tool-context.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import { fieldReadToolPermissions, fieldReadToolFeatures } from "./read-tools-policy.ts";
import type { FieldReadRunner } from "./read-tools-types.ts";

export const idField = { type: "string", minLength: 1, maxLength: 200 } as const;
export const dateField = { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" } as const;
export const targetFields = { targetId: idField };
export const buildingFields = { buildingId: idField };
export function textArg(args: Record<string, unknown>, key: string): string | undefined {
  return typeof args[key] === "string" ? args[key] as string : undefined;
}
export function omitArgs(args: Record<string, unknown>, ...keys: string[]): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([key]) => !keys.includes(key)));
}

/** Every invocation refreshes grants; the LLM's tool list is not authorization. */
export function readTool(name: string, description: string, properties: Record<string, unknown>, run: FieldReadRunner, required: string[] = []): AgentTool {
  const spec = fn(name, description, properties, required);
  const schema = { type: "object", properties, required, additionalProperties: false };
  return tool(spec, async (ctx, raw) => {
    const args = validateFieldPayload<Record<string, unknown>>(schema, structuredClone(raw));
    const buildingId = textArg(args, "buildingId") ?? null;
    const context = await fieldToolContext(ctx.db, { kind: name, projectId: ctx.projectId, buildingId, payload: args, idempotencyKey: "read" }, {
      userId: ctx.caller.user.id, organizationId: ctx.caller.project.organizationId,
    }, ctx.queue);
    const feature = fieldReadToolFeatures[name];
    if (feature) await context.requireFeature(feature);
    const permission = fieldReadToolPermissions[name];
    if (permission) await context.request.requireProjectPermission(ctx.projectId, permission.resource, permission.action);
    if (buildingId) await buildingsService(buildingsRepository(ctx.db)).assertRealBuilding(ctx.projectId, buildingId);
    return { output: await run(context, args) };
  });
}
