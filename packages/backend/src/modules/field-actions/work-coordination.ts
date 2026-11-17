import type { FieldToolHandler } from "./tool-types.ts";
import { assertCoordinationScope } from "./work-coordination-support.ts";
import { workTaskHandlers } from "./work-coordination-tasks.ts";
import { workRfiHandlers } from "./work-coordination-rfis.ts";
import { workRecordHandlers } from "./work-coordination-records.ts";
import { workProgrammeHandlers } from "./work-coordination-programme.ts";
import { workCoordinationRequirements } from "./work-coordination-requirements.ts";

export { workCoordinationSchemas } from "./work-coordination-schemas.ts";
export { workCoordinationRequirements } from "./work-coordination-requirements.ts";

const handlers = { ...workTaskHandlers, ...workRfiHandlers, ...workRecordHandlers, ...workProgrammeHandlers };

function authorized(handler: FieldToolHandler): FieldToolHandler {
  return async (input, context) => {
    assertCoordinationScope(input, context);
    const requirement = workCoordinationRequirements[input.kind as keyof typeof handlers];
    for (const feature of requirement.features) await context.requireFeature(feature);
    return handler(input, context);
  };
}

/** Only the confirmed-action executor calls this map, inside the receipt transaction. */
export const workCoordinationHandlers: Record<keyof typeof handlers, FieldToolHandler> = Object.fromEntries(
  Object.entries(handlers).map(([kind, handler]) => [kind, authorized(handler)]),
) as Record<keyof typeof handlers, FieldToolHandler>;
