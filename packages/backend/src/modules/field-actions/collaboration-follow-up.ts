import { BadRequestError } from "../../lib/errors.ts";
import type { DrawingMarkup } from "../drawing-markup/types.ts";
import { workCoordinationHandlers, workCoordinationRequirements } from "./work-coordination.ts";
import { siteRecordHandlers, siteRecordRequirements } from "./site-records.ts";
import type { DrawingFollowUp } from "./collaboration-types.ts";
import type { FieldToolContext, FieldToolInput } from "./tool-types.ts";

export async function requireDrawingFollowUp(followUp: DrawingFollowUp | undefined, anchor: { documentId: string; documentVersionId: string }, context: FieldToolContext) {
  if (!followUp) return;
  for (const key of ["documentId", "documentVersionId"] as const) {
    const selected = followUp.payload[key];
    if (selected != null && selected !== anchor[key]) throw new BadRequestError("The follow-up must refer to the selected drawing revision.");
  }
  const requirement = followUp.kind === "rfi" ? workCoordinationRequirements.rfi : siteRecordRequirements.create_material_approval;
  for (const feature of requirement.features) await context.requireFeature(feature);
  for (const [resource, action] of requirement.permissions) await context.request.requireProjectPermission(context.project.id, resource, action);
}

/** The new pin ID exists only after creation; the planner never supplies a future record ID. */
export async function drawingFollowUp(input: FieldToolInput, followUp: DrawingFollowUp | undefined, markup: DrawingMarkup, context: FieldToolContext) {
  if (!followUp) return undefined;
  const execute = followUp.kind === "rfi" ? workCoordinationHandlers.rfi : siteRecordHandlers.create_material_approval;
  return execute({ ...input, kind: followUp.kind, idempotencyKey: `${input.idempotencyKey}:follow-up`, payload: {
    ...followUp.payload, documentId: markup.documentId, documentVersionId: markup.documentVersionId, sourceMarkupId: markup.id,
  } }, context);
}
