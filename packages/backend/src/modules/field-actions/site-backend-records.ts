import { NotFoundError } from "../../lib/errors.ts";
import { sanitizeHtmlFields } from "../../lib/rich-text.ts";
import { raiseDelayBody } from "../activities/route-schemas.ts";
import type { RaiseDelayInput } from "../activities/types.ts";
import { buildActivityServices } from "../activities/wiring.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import { requireCoordinationReferences } from "./work-coordination-references.ts";
import { assertTargetBuilding } from "./work-coordination-support.ts";
import type { FieldToolHandler, FieldToolRequirement } from "./tool-types.ts";

export const siteBackendSchemas = {
  raise_activity_delay: { ...raiseDelayBody, required: ["activityId", ...raiseDelayBody.required],
    properties: { ...raiseDelayBody.properties, activityId: { type: "string", minLength: 1, maxLength: 100 } } },
};

const raiseDelay: FieldToolHandler = async (input, context) => {
  const payload = validateFieldPayload<Record<string, unknown>>(siteBackendSchemas.raise_activity_delay, sanitizeHtmlFields(structuredClone(input.payload)));
  await context.requireFeature("projects.schedule", "Schedule");
  await context.request.requireProjectPermission(input.projectId, "schedule", "manage");
  const { activityId, ...body } = payload;
  const { repository, delays, flush } = buildActivityServices(context.db, context.queue);
  const activity = await repository.findById(activityId as string);
  if (!activity || activity.project_id !== input.projectId) throw new NotFoundError("Activity");
  assertTargetBuilding(context, activity.building_id);
  await requireCoordinationReferences(body, context);
  await context.requireFiles(body);
  const record = await delays.raise(input.projectId, activity.id, validateFieldPayload<RaiseDelayInput>(raiseDelayBody, body), context.user);
  await flush();
  return { kind: input.kind, projectId: input.projectId, recordId: record.id, message: "Activity delay recorded.", data: { activityId: activity.id } };
};

export const siteBackendHandlers = { raise_activity_delay: raiseDelay } satisfies Record<string, FieldToolHandler>;
export const siteBackendRequirements = {
  raise_activity_delay: { features: ["projects.schedule"], permissions: [["schedule", "manage"]], readPermissions: [["schedule", "view"]] },
} as const satisfies Record<string, FieldToolRequirement>;

export const siteBackendDefinitions = {
  raise_activity_delay: { label: "Log an activity delay", description: "Record an actual stoppage against an authorized activity without inventing hours worked. Ask for the reason and actual start date. Preserve cause, time and cost impact, linked records, and EOT rules.", requiresBuilding: false, destructive: false, fields: [] },
};
