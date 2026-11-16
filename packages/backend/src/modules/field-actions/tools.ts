import { voiceActions, legacyReviewFields, type VoiceActionKind } from "@buildpanda/voice-actions";
import type { Knex } from "knex";
import { BadRequestError } from "../../lib/errors.ts";
import type { QueueManager } from "../../lib/queue/index.ts";
import { collaborationHandlers, collaborationSchemas, collaborationRequirements } from "./collaboration.ts";
import { siteRecordHandlers, siteRecordSchemas, siteRecordRequirements, siteBackendHandlers, siteBackendSchemas, siteBackendRequirements, siteBackendDefinitions } from "./site-records.ts";
import { workCoordinationHandlers, workCoordinationSchemas, workCoordinationRequirements } from "./work-coordination.ts";
import { fieldToolContext } from "./tool-context.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import type { FieldToolHandler, FieldToolInput, FieldToolRequirement, FieldToolKind, FieldToolDescriptor } from "./tool-types.ts";
import type { FieldActor } from "./types.ts";
import { canonicalToolFields } from "./tool-fields.ts";
import { descriptionOverride } from "./tool-descriptions.ts";

export const fieldToolHandlers = {
  ...siteRecordHandlers, ...workCoordinationHandlers, ...collaborationHandlers, ...siteBackendHandlers,
} satisfies Record<FieldToolKind, FieldToolHandler>;
export const fieldToolSchemas = {
  ...siteRecordSchemas, ...workCoordinationSchemas, ...collaborationSchemas, ...siteBackendSchemas,
} satisfies Record<FieldToolKind, object>;
export const fieldToolRequirements = {
  ...siteRecordRequirements, ...workCoordinationRequirements, ...collaborationRequirements, ...siteBackendRequirements,
} satisfies Record<FieldToolKind, FieldToolRequirement>;

export function isFieldToolKind(kind: unknown): kind is FieldToolKind {
  return typeof kind === "string" && Object.hasOwn(fieldToolHandlers, kind);
}

export function fieldToolDescriptor(kind: FieldToolKind): FieldToolDescriptor {
  if (!Object.hasOwn(voiceActions, kind)) {
    const definition = siteBackendDefinitions[kind as keyof typeof siteBackendDefinitions];
    return { kind, ...definition, schema: fieldToolSchemas[kind], fields: canonicalToolFields(kind, fieldToolSchemas[kind], []) };
  }
  const definition = voiceActions[kind as VoiceActionKind];
  const fields = Object.keys(definition.fields).length ? Object.entries(definition.fields).map(([name, field]) => ({ ...field, name }))
    : legacyReviewFields({ kind, payload: {} });
  return { kind, label: definition.label, description: definition.instruction, ...descriptionOverride(kind), schema: fieldToolSchemas[kind], fields: canonicalToolFields(kind, fieldToolSchemas[kind], fields),
    requiresBuilding: ["daily_log", "update_daily_log", "log_activity"].includes(kind), destructive: "destructive" in definition && definition.destructive === true };
}

export function validateFieldTool(kind: string, payload: unknown): Record<string, unknown> {
  if (!isFieldToolKind(kind)) throw new BadRequestError("Unknown field action. Describe the action again.");
  return validateFieldPayload<Record<string, unknown>>(fieldToolSchemas[kind], structuredClone(payload));
}

/** The same canonical schemas, guards and domain services used by the HTTP forms. */
export function fieldToolsExecutor(db: Knex, queue?: QueueManager) {
  return {
    async execute(input: FieldToolInput, actor: FieldActor) {
      if (!isFieldToolKind(input.kind)) throw new BadRequestError("Unknown field action.");
      if (!input.idempotencyKey) throw new BadRequestError("The confirmed action needs its stable receipt identity.");
      const context = await fieldToolContext(db, input, actor, queue);
      const requirements: FieldToolRequirement = fieldToolRequirements[input.kind];
      for (const feature of requirements.features) await context.requireFeature(feature);
      if (!requirements.permissionScope || requirements.permissionScope === "project") {
        for (const [resource, action] of requirements.permissions) await context.request.requireProjectPermission(input.projectId, resource, action);
      }
      // Conditional and alternative grants are checked by the canonical domain guard.
      const payload = validateFieldTool(input.kind, input.payload);
      return fieldToolHandlers[input.kind]({ ...input, payload }, context);
    },
  };
}
