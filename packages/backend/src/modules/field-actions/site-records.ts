import { sanitizeHtmlFields } from "../../lib/rich-text.ts";
import { materialApprovalHandler } from "./site-records-approvals.ts";
import { dailyRecordHandler } from "./site-records-daily.ts";
import { expenseRecordHandler } from "./site-records-expense.ts";
import { materialsRecordHandler } from "./site-records-materials.ts";
import { siteRecordSchemas } from "./site-records-schemas.ts";
import type { SiteRecordKind } from "./site-records-types.ts";
import { validateFieldPayload } from "./tool-schema.ts";
import type { FieldToolHandler } from "./tool-types.ts";

function handler(kind: SiteRecordKind, execute: FieldToolHandler): FieldToolHandler {
  return async (input, context) => {
    const payload = validateFieldPayload<Record<string, unknown>>(siteRecordSchemas[kind], structuredClone(input.payload));
    const safe = validateFieldPayload<Record<string, unknown>>(siteRecordSchemas[kind], sanitizeHtmlFields(payload));
    return execute({ ...input, kind, payload: safe }, context);
  };
}

export const siteRecordHandlers = {
  daily_log: handler("daily_log", dailyRecordHandler), update_daily_log: handler("update_daily_log", dailyRecordHandler),
  void_daily_log_entry: handler("void_daily_log_entry", dailyRecordHandler),
  material_log: handler("material_log", materialsRecordHandler), void_ledger_entry: handler("void_ledger_entry", materialsRecordHandler),
  material_order: handler("material_order", materialsRecordHandler), update_material_order: handler("update_material_order", materialsRecordHandler),
  delete_material_order: handler("delete_material_order", materialsRecordHandler), receive_material_order: handler("receive_material_order", materialsRecordHandler),
  create_material_approval: handler("create_material_approval", materialApprovalHandler), update_material_approval: handler("update_material_approval", materialApprovalHandler),
  decide_material_approval: handler("decide_material_approval", materialApprovalHandler), reopen_material_approval: handler("reopen_material_approval", materialApprovalHandler),
  delete_material_approval: handler("delete_material_approval", materialApprovalHandler), comment_material_approval: handler("comment_material_approval", materialApprovalHandler),
  create_expense: handler("create_expense", expenseRecordHandler),
} satisfies Record<SiteRecordKind, FieldToolHandler>;

export { siteRecordSchemas } from "./site-records-schemas.ts";
export { siteRecordRequirements } from "./site-records-requirements.ts";
export { siteBackendHandlers, siteBackendSchemas, siteBackendRequirements, siteBackendDefinitions } from "./site-backend-records.ts";
