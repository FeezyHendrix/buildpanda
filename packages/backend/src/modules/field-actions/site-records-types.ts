export type SiteRecordKind = "daily_log" | "update_daily_log" | "void_daily_log_entry" | "material_log" | "void_ledger_entry" |
  "material_order" | "update_material_order" | "delete_material_order" | "receive_material_order" |
  "create_material_approval" | "update_material_approval" | "decide_material_approval" | "reopen_material_approval" |
  "delete_material_approval" | "comment_material_approval" | "create_expense";

export interface SiteBodySchema {
  properties: Record<string, unknown>;
  required?: readonly string[];
  minProperties?: number;
}

