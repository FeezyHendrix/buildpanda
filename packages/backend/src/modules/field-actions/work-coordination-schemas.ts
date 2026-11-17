import * as tasks from "../tasks/route-schemas.ts";
import * as rfis from "../rfis/route-schemas.ts";
import * as changes from "../change-requests/route-schemas.ts";
import * as lookAheads from "../look-aheads/route-schemas.ts";
import { linkActivityBody } from "../daily-logs/schemas.ts";
import { raiseDelayBody } from "../activities/route-schemas.ts";
import { updateStageBody } from "../stages/route-schemas.ts";

const id = { type: "string", minLength: 1, maxLength: 100 } as const;
const target = (key: string) => ({ type: "object", required: [key], additionalProperties: false, properties: { [key]: id } });
const patch = (key: string, schema: object) => ({ ...target(key), required: [key, "patch"], properties: { [key]: id, patch: schema } });
const flat = (key: string, schema: { properties: object; required?: readonly string[]; minProperties?: number }) => ({
  type: "object", required: [key, ...(schema.required ?? [])], additionalProperties: false, properties: { [key]: id, ...schema.properties },
  ...(schema.minProperties ? { minProperties: schema.minProperties + 1 } : {}),
});

/** Transport envelopes add only target identity; body fields are the canonical HTTP schemas. */
export const workCoordinationSchemas = {
  rfi: rfis.createBody,
  update_rfi: patch("rfiId", rfis.updateBody),
  transition_rfi: flat("rfiId", rfis.transitionBody),
  comment_rfi: flat("rfiId", rfis.commentBody),
  respond_rfi: flat("rfiId", rfis.respondBody),
  change_request: changes.createBody,
  update_change_request: patch("changeRequestId", changes.updateBody),
  delete_change_request: target("changeRequestId"),
  comment_change_request: flat("changeRequestId", changes.commentBody),
  look_ahead: lookAheads.lookAheadBody,
  update_look_ahead: patch("lookAheadId", lookAheads.lookAheadPatchBody),
  delete_look_ahead: target("lookAheadId"),
  log_activity: {
    type: "object", required: linkActivityBody.required, additionalProperties: false,
    properties: { ...linkActivityBody.properties,
      logDate: { type: "string", format: "date", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
      activityName: { type: "string", maxLength: 200 },
      delayReasonCode: { type: ["string", "null"], minLength: 1, maxLength: 50 },
      delayNote: { type: ["string", "null"], maxLength: 2000 },
      delay: raiseDelayBody,
    },
  },
  transition_stage: {
    ...target("stageId"), required: ["stageId", "status"],
    properties: { stageId: id, status: updateStageBody.properties.status, buildingId: { ...id, type: ["string", "null"] } },
  },
  create_task: tasks.createBody,
  update_task: flat("taskId", tasks.updateBody),
  move_task: { ...flat("taskId", tasks.moveBody), required: ["taskId", "columnId"] },
  delete_task: target("taskId"),
  comment_task: flat("taskId", tasks.commentBody),
} as const;
