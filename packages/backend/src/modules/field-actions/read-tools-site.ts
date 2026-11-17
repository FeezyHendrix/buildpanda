import { NotFoundError } from "../../lib/errors.ts";
import { buildMaterialApprovalsService } from "../approvals/material-wiring.ts";
import { listQuery as approvalQuery } from "../approvals/material-schemas.ts";
import type { ApprovalStatus } from "../approvals/types.ts";
import { buildMaterialsServices } from "../materials-equipment/wiring.ts";
import { MATERIAL_ORDER_STATUSES, type MaterialOrderStatus } from "../materials-equipment/types.ts";
import { buildMaterialsLedgerService } from "../materials-ledger/wiring.ts";
import type { LedgerEntryType } from "../materials-ledger/types.ts";
import { buildDailyLogsService } from "../daily-logs/wiring.ts";
import { dailyLogTemplatesService } from "../daily-log-templates/service.ts";
import { dailyLogTemplatesRepository } from "../daily-log-templates/repository.ts";
import { buildTransactionsService } from "../transactions/wiring.ts";
import { readTool, targetFields, buildingFields, dateField, idField, textArg, omitArgs } from "./read-tools-support.ts";

export function siteRecordReadTools() {
  return [
    readTool("read_material_approval", "Read material approval requests or one request with review decisions, resubmission history, attachments and comments.", {
      ...targetFields, ...approvalQuery.properties,
    }, async (context, args) => {
      const service = buildMaterialApprovalsService(context.db);
      const id = textArg(args, "targetId");
      return id ? service.get(context.project.id, id) : service.list(context.project.id, args.status as ApprovalStatus | undefined);
    }),
    readTool("read_material_order", "Read material orders, late orders, or one order with its received and rejected delivery history.", {
      ...targetFields, status: { type: "string", enum: MATERIAL_ORDER_STATUSES }, late: { type: "boolean" },
    }, async (context, args) => {
      const { service, deliveries } = buildMaterialsServices({ db: context.db });
      const id = textArg(args, "targetId");
      if (id) return { order: await service.getMaterialOrder(context.project.id, id), deliveries: await deliveries.list(context.project.id, id) };
      return args.late ? service.listLateMaterialOrders(context.project.id) : service.listMaterialOrders(context.project.id, args.status as MaterialOrderStatus | undefined);
    }),
    readTool("read_material_log", "Read the material stock balance, catalog/reorder rules, or paginated receipt and usage ledger with source files and approval/reversal details.", {
      ...targetFields, view: { type: "string", enum: ["ledger", "stock", "catalog"] }, materialId: idField,
      entryType: { type: "string", enum: ["IN", "USED"] }, limit: { type: "integer", minimum: 1, maximum: 200 }, before: { type: "string", maxLength: 40 },
    }, async (context, args) => {
      const service = buildMaterialsLedgerService(context.db);
      if (args.view === "stock") return service.getStock(context.project.id);
      if (args.view === "catalog") return service.getCatalog(context.project.id);
      const id = textArg(args, "targetId");
      if (id) {
        const entry = await service.getEntry(context.project.id, id);
        if (!entry) throw new NotFoundError("Material log");
        return entry;
      }
      return service.listLedger(context.project.id, { materialId: textArg(args, "materialId"), entryType: args.entryType as LedgerEntryType | undefined,
        limit: args.limit as number | undefined, before: textArg(args, "before") });
    }),
    readTool("read_daily_log", "Read daily-log days with headers, rich entries, files, activity progress and void reasons. Supply date for one day, from/to for a range, or view=templates for available templates.", {
      ...buildingFields, date: dateField, from: dateField, to: dateField, view: { type: "string", enum: ["days", "templates"] },
    }, async (context, args) => {
      if (args.view === "templates") return dailyLogTemplatesService(dailyLogTemplatesRepository(context.db)).list({ projectId: context.project.id, organizationId: context.project.organization_id });
      const service = buildDailyLogsService(context.db);
      const date = textArg(args, "date");
      return date ? service.getDay(context.project.id, date, context.buildingId ?? undefined)
        : service.listDays(context.project.id, textArg(args, "from"), textArg(args, "to"), context.buildingId ?? undefined);
    }),
    readTool("read_expense", "Read expenses or one expense with receipt metadata. Only expenses logged by the caller are visible unless viewAllExpenses is granted. Analytics use the same scope.", {
      ...targetFields, view: { type: "string", enum: ["list", "analytics", "categories"] },
      category: { type: "string", minLength: 1, maxLength: 200 }, stageId: idField,
      from: { type: "string", minLength: 1, maxLength: 30 }, to: { type: "string", minLength: 1, maxLength: 30 }, search: { type: "string", minLength: 1, maxLength: 200 },
    }, async (context, args) => {
      const service = buildTransactionsService(context.db, context.request, context.project);
      const orgId = context.project.organization_id ?? context.project.owner_id ?? context.project.id;
      const id = textArg(args, "targetId");
      if (id) return service.get(context.project.id, orgId, id);
      if (args.view === "categories") return service.listCategories(orgId);
      const filters = omitArgs(args, "targetId", "view");
      return args.view === "analytics" ? service.analytics(context.project.id, orgId, filters) : service.list(context.project.id, orgId, filters);
    }),
  ];
}
