import type { FieldToolRequirement } from "./tool-types.ts";


const permission = (resource: string, action: string) => [resource, action] as const;
const rfiView = permission("rfis", "view");
const taskView = permission("tasks", "view");
const comment = permission("comments", "post");
const rfi = (action: string, view = true) => ({ features: ["workflow.rfis"], permissions: [...(view ? [rfiView] : []), permission("rfis", action)] });
const change = { features: ["workflow.changeRequests"], permissions: [permission("change-requests", "manage")] };
const lookAhead = { features: ["projects.schedule"], permissions: [permission("schedule", "manage")] };
const task = (action: string) => ({ features: ["projects.schedule"], permissions: [taskView, permission("tasks", action)] });

/** Minimum grants; mutable record visibility and state are always rechecked by the handler. */
export const workCoordinationRequirements = {
  rfi: rfi("create", false), update_rfi: rfi("manage"), transition_rfi: rfi("manage"),
  comment_rfi: { features: ["workflow.rfis"], permissions: [rfiView, comment] }, respond_rfi: rfi("respond"),
  change_request: change, update_change_request: change, delete_change_request: change,
  comment_change_request: { features: ["workflow.changeRequests"], permissions: [comment], readPermissions: [["change-requests", "view"]] },
  look_ahead: lookAhead, update_look_ahead: lookAhead, delete_look_ahead: lookAhead,
  log_activity: { features: ["quality.dailyLogs"], permissions: [permission("dailyLog", "create")] },
  transition_stage: { features: ["projects.schedule"], permissions: [permission("stages", "manage")] },
  create_task: task("add"), update_task: task("add"), move_task: task("view"), delete_task: task("remove"),
  comment_task: { features: ["projects.schedule"], permissions: [taskView, comment] },
} as const satisfies Record<string, FieldToolRequirement>;

