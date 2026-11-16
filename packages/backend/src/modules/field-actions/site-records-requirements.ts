import type { SiteRecordKind } from "./site-records-types.ts";
import type { FieldToolRequirement } from "./tool-types.ts";
import { materialLogPermissionActions } from "../materials-ledger/permissions.ts";
import { materialsPermissionActions } from "../materials-equipment/permissions.ts";

/** Base eligibility only; handlers recheck target, current state and conditional approval authority. */
export const siteRecordRequirements = {
  daily_log: { features: ["quality.dailyLogs"], permissions: [["dailyLog", "create"]] },
  update_daily_log: { features: ["quality.dailyLogs"], permissions: [["dailyLog", "create"]] },
  void_daily_log_entry: { features: ["quality.dailyLogs"], permissions: [["dailyLog", "create"]] },
  material_log: { features: ["commercial.materialsEquipment", "commercial.materialsLedger"], permissions: [], anyPermissions: materialLogPermissionActions("IN").map((action) => ["materials", action] as const) },
  void_ledger_entry: { features: ["commercial.materialsEquipment", "commercial.materialsLedger"], permissions: [["materials", "manage"]] },
  material_order: { features: ["commercial.materialsEquipment"], permissions: [["materials", "request"]] },
  update_material_order: { features: ["commercial.materialsEquipment"], permissions: [["materials", "request"]] },
  delete_material_order: { features: ["commercial.materialsEquipment"], permissions: [["materials", "request"]], anyPermissions: materialsPermissionActions("approve").map((action) => ["materials", action] as const) },
  receive_material_order: { features: ["commercial.materialsEquipment"], permissions: [["materials", "request"]], anyPermissions: materialsPermissionActions("approve").map((action) => ["materials", action] as const) },
  create_material_approval: { features: [], permissions: [["materials", "request"]] },
  update_material_approval: { features: [], permissions: [["materials", "request"]] },
  decide_material_approval: { features: [], permissions: [["materials", "approve"]] },
  reopen_material_approval: { features: [], permissions: [["materials", "request"]] },
  delete_material_approval: { features: [], permissions: [["materials", "approve"]] },
  comment_material_approval: { features: [], permissions: [["comments", "post"]], readPermissions: [["materials", "view"]] },
  create_expense: { features: ["commercial.transactions"], permissions: [["finances", "manage"]] },
} as const satisfies Record<SiteRecordKind, FieldToolRequirement>;
