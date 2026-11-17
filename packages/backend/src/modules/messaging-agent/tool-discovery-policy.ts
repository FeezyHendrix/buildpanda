import { canRead, permissionFor } from "../panda-ai/agent/tool-permissions.ts";
import type { AgentTool } from "../panda-ai/agent/tool-helpers.ts";
import type { ToolContext } from "../panda-ai/agent/tool-context.ts";
import type { MessagingFeatures } from "./management-types.ts";
import { fieldReadToolFeatures } from "../field-actions/read-tools-policy.ts";

/** Explicit allowlist: a new agent write can never become a planner read by naming convention. */
export const MESSAGING_READ_TOOLS = new Set([
  "find_work_records", "get_open_items", "get_schedule", "get_delays", "get_schedule_position", "get_programme_baseline",
  "get_buildings", "get_key_dates", "get_schedule_of_values", "get_finances", "get_finance_position", "get_finance_events",
  "get_contracts", "get_invoices", "get_payment_claims", "get_retention", "get_advance", "get_measured_work", "get_budget",
  "get_purchase_orders", "list_transactions", "get_transaction_summary", "get_project_updates", "get_update_comments",
  "get_daily_logs", "get_inspections", "get_risks", "get_permits", "get_change_requests", "get_selections", "get_materials",
  "get_late_material_orders", "get_material_stock", "get_material_ledger", "get_suppliers", "get_tasks", "get_task_links",
  "get_task_comments", "list_documents", "analyze_document", "analyze_drawing", "get_drawing_markups", "get_estimate", "get_boq_items", "get_precon_boq",
  "read_rfi", "read_change_request", "read_material_approval", "read_material_order", "read_daily_log", "read_task", "read_look_ahead",
  "read_activity", "read_document", "read_drawing", "read_expense", "read_conversation", "read_stage", "read_key_date", "read_material_log",
]);

const resourceFeatures: Record<string, readonly string[]> = {
  schedule: ["projects.schedule"], stages: ["projects.schedule"], tasks: ["projects.schedule"], buildings: ["projects.multiBuilding"],
  "key-dates": ["compliance.keyDates"], finances: ["commercial.finances"], updates: ["project.updates"], dailyLog: ["quality.dailyLogs"],
  inspections: ["quality.inspections"], risks: ["quality.risks"], permits: ["compliance.permits"],
  rfis: ["workflow.rfis"],
  "change-requests": ["workflow.changeRequests"], selections: ["projects.selections"], materials: ["commercial.materialsEquipment"],
  documents: ["projects.documents"], approvals: ["workflow.approvals"], participants: ["collaboration.participants"],
  messages: ["collaboration.messaging"], estimates: ["sales.proposals"], proposals: ["sales.proposals"], takeoffs: ["sales.proposals", "ai.automatedTakeoff"],
};
const specificFeatures: Record<string, readonly string[]> = {
  get_invoices: ["commercial.invoices"], get_budget: ["commercial.budget"], get_payment_claims: ["commercial.paymentClaims"],
  get_purchase_orders: ["commercial.purchaseOrders"], list_transactions: ["commercial.transactions"], get_transaction_summary: ["commercial.transactions"],
  get_material_stock: ["commercial.materialsLedger"], get_material_ledger: ["commercial.materialsLedger"],
};
export function messagingReadResourceEnabled(features: MessagingFeatures, resource: string): boolean {
  return (resourceFeatures[resource] ?? []).every((key) => features.enabled?.[key] === true);
}
export function messagingReadToolEnabled(entry: AgentTool, context: ToolContext, features: MessagingFeatures): boolean {
  const name = entry.spec.function.name;
  const canonicalFeature = fieldReadToolFeatures[name];
  if (!MESSAGING_READ_TOOLS.has(name) || !(specificFeatures[name] ?? []).every((key) => features.enabled?.[key] === true) ||
    (canonicalFeature && features.enabled?.[canonicalFeature] !== true)) return false;
  if (name === "read_conversation") {
    const organizationId = context.caller.project.organizationId;
    return context.readableResource?.("messages") !== false && (canRead(context, "messages", "view") ||
      !!(organizationId && context.caller.orgPermissions.get(organizationId)?.get("messages")?.has("view")));
  }
  if (permissionFor(name) !== null) return true;
  const resources = name === "find_work_records" ? ["schedule", "rfis", "change-requests", "risks", "inspections", "materials"] : ["rfis", "approvals", "materials"];
  return resources.some((resource) => canRead(context, resource, "view"));
}

/** Transactions and material approvals have independent canonical route flags. */
export function messagingReadContext(context: ToolContext, name: string): ToolContext {
  if (name !== "read_material_approval" && name !== "read_expense") return context;
  return { ...context, readableResource: (resource) =>
    (name === "read_material_approval" && resource === "materials") || (name === "read_expense" && resource === "finances") || context.readableResource?.(resource) !== false };
}
