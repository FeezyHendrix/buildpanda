import type { Knex } from "knex";
import { BadRequestError, ForbiddenError, NotFoundError } from "../../lib/errors.ts";
import { isCompanyCaller } from "../rfis/access.ts";
import { fieldToolContext } from "../field-actions/tool-context.ts";
import { requireSiteRecordReferences } from "../field-actions/site-records-access.ts";
import { requireCoordinationReferences } from "../field-actions/work-coordination-references.ts";
import { dailyLogTemplatesRepository } from "../daily-log-templates/repository.ts";
import { dailyLogTemplatesService } from "../daily-log-templates/service.ts";
import type { TemplateResponses } from "../daily-log-templates/types.ts";
import { messagingReviewAccessRepository } from "./review-access-repository.ts";
import type { MessagingAccess } from "./management-types.ts";
import type { MessagingScope } from "./types.ts";
import type { MessagingReviewTargetAction } from "./review-access-types.ts";

const aliases: Record<string, string> = { materialOrderId: "orderId", phaseId: "stageId", documentVersionId: "versionId", sourceMarkupId: "markupId", parentMessageId: "messageId", quotedMessageId: "messageId", linkedRfiId: "rfiId", linkedChangeRequestId: "changeRequestId", linkedMaterialOrderId: "orderId", supersedesId: "documentId" };
const keys = new Set(["taskId", "rfiId", "orderId", "approvalId", "changeRequestId", "lookAheadId", "activityId", "stageId", "documentId", "buildingId", "versionId", "markupId", "columnId", "channelId", "messageId", "updateId", "dailyEntryId", "ledgerEntryId", "expenseId", "purchaseOrderId", "invoiceId"]);

function targetsFor(action: MessagingReviewTargetAction): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  function visit(value: unknown, field = "") {
    let key = aliases[field] ?? field;
    if (key === "entryId") key = action.kind === "void_daily_log_entry" ? "dailyEntryId" : "ledgerEntryId";
    if (typeof value === "string" && keys.has(key)) result[key] = [...result[key] ?? [], value];
    else if (Array.isArray(value)) for (const item of value) visit(item, field.endsWith("Ids") ? field.slice(0, -1) : field);
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (["task", "activity"].includes(String(record.type)) && typeof record.id === "string") visit(record.id, `${record.type}Id`);
      for (const [name, item] of Object.entries(record)) visit(item, name);
    }
  }
  visit(action.payload);
  const created: Record<string, string> = { create_task: "taskId", rfi: "rfiId", create_expense: "expenseId", attach_expense_receipt: "expenseId", create_purchase_order: "purchaseOrderId", issue_purchase_order: "purchaseOrderId", receive_purchase_order: "purchaseOrderId", create_supplier_invoice: "invoiceId", record_invoice_payment: "invoiceId", create_project_update: "updateId", material_order: "orderId", create_material_approval: "approvalId", daily_log: "dailyEntryId", annotate_drawing: "markupId", upload_document: "documentId", upload_document_version: "versionId", send_message: "messageId", send_direct_message: "messageId", reply_message: "messageId" };
  if (typeof action.result?.recordId === "string" && created[action.kind]) visit(action.result.recordId, created[action.kind]);
  const related = action.result?.data as { relatedKind?: string; relatedRecordId?: string } | undefined;
  if (action.kind === "annotate_drawing" && related?.relatedRecordId) visit(related.relatedRecordId, related.relatedKind === "rfi" ? "rfiId" : "approvalId");
  return result;
}

export async function messagingReviewVisibility(db: Knex, access: MessagingAccess, scope: MessagingScope, actions: MessagingReviewTargetAction[]): Promise<boolean[]> {
  const items = actions.map(targetsFor), targets: Record<string, string[]> = {};
  for (const item of items) for (const [key, ids] of Object.entries(item)) targets[key] = [...new Set([...targets[key] ?? [], ...ids])];
  const request = { ...access.context, requireAuth: () => ({ id: access.user.id }) };
  const has = (resource: string, action: string) => access.permissions[resource]?.includes(action) === true;
  const visible = await messagingReviewAccessRepository(db).visible({ projectId: scope.projectId, organizationId: scope.organizationId, userId: access.user.id,
    financialCosts: has("finances", "viewCosts"), financialView: has("finances", "view"), fullTasks: has("tasks", "viewAll"), fullExpenses: has("finances", "viewAllExpenses"), internalRfis: isCompanyCaller(request, access.project), projectMessages: has("messages", "view"), workspaceMessages: access.workspacePermissions?.messages?.includes("view") === true }, targets);
  return items.map((item) => Object.entries(item).every(([key, ids]) => ids.every((id) => visible[key]?.has(id))));
}

export async function requireMessagingReviewTargets(db: Knex, access: MessagingAccess, scope: MessagingScope, actions: MessagingReviewTargetAction[]): Promise<Map<number, string>> {
  const summaries = new Map<number, string>();
  if (!actions.length) return summaries;
  if ((await messagingReviewVisibility(db, access, scope, actions)).some((allowed) => !allowed)) throw new ForbiddenError("One of the reviewed records is no longer accessible in this project. Select an authorized target again.");
  const context = await fieldToolContext(db, { kind: "review", ...scope, payload: {}, idempotencyKey: "review" }, { userId: access.user.id, organizationId: scope.organizationId });
  for (const [index, action] of actions.entries()) {
    const payload = (action.payload.patch ?? action.payload) as Record<string, unknown>;
    if (action.kind === "send_message" && payload.projectGeneral === true) {
      await context.request.requireProjectPermission(scope.projectId, "messages", "view");
      await context.request.requireProjectPermission(scope.projectId, "messages", "send");
    }
    if (action.kind === "send_message" && payload.projectGeneral === true) {
      await context.request.requireProjectPermission(scope.projectId, "messages", "view");
      await context.request.requireProjectPermission(scope.projectId, "messages", "send");
    }
    if (action.kind === "create_expense" && payload.currency !== access.project.currency) throw new BadRequestError(`This project records expenses in ${access.project.currency}. Provide the amount in that currency; Panda will not guess an exchange rate.`);
    await requireSiteRecordReferences(context, payload);
    await requireCoordinationReferences(payload, context);
    if (action.kind === "daily_log" && typeof payload.templateId === "string") {
      const form = await dailyLogTemplatesService(dailyLogTemplatesRepository(db)).fill(scope.projectId, payload.templateId, (payload.responses ?? {}) as TemplateResponses).catch((error: unknown) => {
        if (error instanceof NotFoundError) throw new BadRequestError("The selected daily-log template is unavailable. Choose its current form before confirming.");
        throw error;
      });
      summaries.set(index, [`Form: ${form.templateName}`, form.text, ...(typeof payload.bodyText === "string" && payload.bodyText ? [`Notes: ${payload.bodyText}`] : [])].join("\n\n"));
    }
  }
  return summaries;
}
