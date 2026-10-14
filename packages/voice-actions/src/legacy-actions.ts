import { allOf } from "./access.ts";
import { features } from "./features.ts";
import type { VoiceDefinition } from "./types.ts";

export const legacyActions = {
  rfi: { label: "Raise RFI", icon: "help-circle-outline", permission: features.rfis.actions.create, instruction: "", fields: {} },
  daily_log: { label: "Append Daily Log", icon: "clipboard-outline", permission: features.dailyLog.actions.create, instruction: "", fields: {} },
  change_request: { label: "Submit Change Request", icon: "swap-horizontal-outline", permission: features.changeRequests.actions.create, instruction: "", fields: {} },
  material_log: { label: "Log Material Movement", icon: "archive-outline", permission: features.materialLog.actions.create, instruction: "", fields: {} },
  material_order: { label: "Request Material", icon: "cube-outline", permission: features.materialOrders.actions.create, instruction: "", fields: {} },
  look_ahead: { label: "Create look ahead", icon: "eye-outline", permission: features.schedule.actions.create, instruction: "", fields: {} },
  update_rfi: { label: "Update RFI", icon: "create-outline", permission: features.rfis.actions.edit, instruction: "", fields: {} },
  transition_rfi: { label: "Change RFI Status", icon: "swap-vertical-outline", permission: features.rfis.actions.transition, instruction: "", fields: {} },
  update_change_request: { label: "Update Change Request", icon: "create-outline", permission: features.changeRequests.actions.edit, instruction: "", fields: {} },
  delete_change_request: { label: "Delete Change Request", icon: "trash-outline", destructive: true, permission: features.changeRequests.actions.remove, instruction: "", fields: {} },
  update_material_order: { label: "Update Material Request", icon: "create-outline", permission: features.materialOrders.actions.edit, instruction: "", fields: {} },
  delete_material_order: { label: "Cancel Material Request", icon: "trash-outline", destructive: true, permission: features.materialOrders.actions.remove, instruction: "", fields: {} },
  update_look_ahead: { label: "Update look ahead", icon: "create-outline", permission: features.schedule.actions.edit, instruction: "", fields: {} },
  delete_look_ahead: { label: "Delete look ahead", icon: "trash-outline", destructive: true, permission: features.schedule.actions.remove, instruction: "", fields: {} },
  update_daily_log: { label: "Update Daily Log", icon: "time-outline", permission: features.dailyLog.actions.edit, instruction: "", fields: {} },
  log_activity: { label: "Log Activity Work", icon: "hammer-outline", permission: allOf(features.dailyLog.actions.create, features.schedule.read), instruction: "", fields: {} },
  comment_rfi: { label: "Comment on RFI", icon: "chatbubble-outline", permission: features.rfis.actions.comment, instruction: "", fields: {} },
  comment_change_request: { label: "Comment on Change Request", icon: "chatbubble-outline", permission: features.changeRequests.actions.comment, instruction: "", fields: {} },
  void_ledger_entry: { label: "Void Material Entry", icon: "trash-outline", destructive: true, permission: features.materialLog.actions.void, instruction: "", fields: {} },
  void_daily_log_entry: { label: "Void Diary Entry", icon: "trash-outline", destructive: true, permission: features.dailyLog.actions.void, instruction: "", fields: {} },
  transition_stage: { label: "Update Build Stage", icon: "flag-outline", permission: features.stages.actions.edit, instruction: "", fields: {} },
} as const satisfies Record<string, VoiceDefinition>;
