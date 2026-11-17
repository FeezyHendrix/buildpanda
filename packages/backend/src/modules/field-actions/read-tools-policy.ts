import type { ToolPermission } from "../panda-ai/agent/tool-helpers.ts";

export const fieldReadToolPermissions: Record<string, ToolPermission | null> = {
  read_rfi: { resource: "rfis", action: "view" },
  read_change_request: { resource: "change-requests", action: "view" },
  read_material_approval: { resource: "materials", action: "view" },
  read_material_order: { resource: "materials", action: "view" },
  read_daily_log: { resource: "dailyLog", action: "view" },
  read_task: { resource: "tasks", action: "view" },
  read_look_ahead: { resource: "schedule", action: "view" },
  read_activity: { resource: "schedule", action: "view" },
  read_document: { resource: "documents", action: "view" },
  read_drawing: { resource: "documents", action: "view" },
  read_expense: { resource: "finances", action: "viewCosts" },
  read_conversation: null,
  read_stage: { resource: "stages", action: "view" },
  read_key_date: { resource: "key-dates", action: "view" },
  read_material_log: { resource: "materials", action: "view" },
};

export const fieldReadToolFeatures: Record<string, string> = {
  read_rfi: "workflow.rfis", read_change_request: "workflow.changeRequests",
  read_material_order: "commercial.materialsEquipment", read_material_log: "commercial.materialsLedger",
  read_daily_log: "quality.dailyLogs", read_task: "projects.schedule", read_look_ahead: "projects.schedule",
  read_activity: "projects.schedule", read_stage: "projects.schedule", read_key_date: "compliance.keyDates",
  read_document: "projects.documents", read_drawing: "projects.documents", read_expense: "commercial.transactions",
  read_conversation: "collaboration.messaging",
};
