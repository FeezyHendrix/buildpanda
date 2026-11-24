import type { Knex } from "knex";
import { taskVisibilityRepository } from "../tasks/visibility-repository.ts";
import { applyExpenseVisibility } from "../transactions/visibility-repository.ts";
import type { MessagingReviewTargetScope } from "./review-access-types.ts";

/** Batches history authorization by record family rather than querying each card. */
export function messagingReviewAccessRepository(db: Knex) {
  return {
    async visible(scope: MessagingReviewTargetScope, targets: Record<string, string[]>): Promise<Record<string, Set<string>>> {
      const { projectId, userId } = scope;
      const rules: Record<string, () => PromiseLike<{ id: string }[]>> = {
        taskId: async () => (await taskVisibilityRepository(db).visibleIds(projectId, targets.taskId ?? [], scope.fullTasks ? undefined : userId)).map((id) => ({ id })),
        rfiId: () => db("rfis").where({ project_id: projectId }).whereIn("id", targets.rfiId ?? []).modify((query) => { if (!scope.internalRfis) query.where("visibility", "shared"); }).select("id"),
        expenseId: () => db("project_transactions").where({ project_id: projectId }).whereIn("id", targets.expenseId ?? []).modify((query) => applyExpenseVisibility(query, scope.fullExpenses ? undefined : userId)).select("id"),
      };
      rules.purchaseOrderId = () => db("purchase_orders").where({ project_id: projectId }).whereIn("id", targets.purchaseOrderId ?? []).modify((query) => { if (!scope.financialCosts) query.whereRaw("false"); }).select("id");
      rules.invoiceId = () => db("project_invoices").where({ project_id: projectId }).whereIn("id", targets.invoiceId ?? []).modify((query) => {
        if (!scope.financialView) query.whereRaw("false");
        if (!scope.financialCosts) query.where("direction", "receivable");
      }).select("id");
      const tables: Record<string, string> = { orderId: "material_orders", approvalId: "approvals", changeRequestId: "change_requests", lookAheadId: "look_aheads", activityId: "activities", stageId: "project_phases", documentId: "project_documents", buildingId: "buildings", dailyEntryId: "daily_log_entries", ledgerEntryId: "material_ledger_entries" };
      for (const [key, table] of Object.entries(tables)) rules[key] = () => db(table).where({ project_id: projectId }).whereIn("id", targets[key] ?? []).modify((query) => {
        if (key === "approvalId") query.where("kind", "material");
        if (key === "buildingId") query.where("kind", "real");
      }).select("id");
      rules.versionId = () => db("document_versions as v").join("project_documents as d", "d.id", "v.document_id").where("d.project_id", projectId).whereIn("v.id", targets.versionId ?? []).select("v.id");
      rules.markupId = () => db("drawing_markups").where({ project_id: projectId }).whereNull("deleted_at").whereIn("id", targets.markupId ?? []).select("id");
      rules.columnId = () => db("task_columns as c").join("task_boards as b", "b.id", "c.board_id").where("b.project_id", projectId).whereIn("c.id", targets.columnId ?? []).select("c.id");
      const channels = () => db("channels as c").join("channel_members as m", "m.channel_id", "c.id").where("m.user_id", userId).where((query) => {
        if (scope.projectMessages) query.orWhere("c.project_id", projectId);
        if (scope.workspaceMessages) query.orWhere((workspace) => workspace.whereNull("c.project_id").where((organization) => organization.where("c.organization_id", scope.organizationId).orWhereNull("c.organization_id")));
        if (!scope.projectMessages && !scope.workspaceMessages) query.whereRaw("false");
      });
      rules.channelId = () => channels().whereIn("c.id", targets.channelId ?? []).select("c.id");
      rules.messageId = () => db("messages as message").whereNull("message.deleted_at").whereIn("message.id", targets.messageId ?? [])
        .whereIn("message.channel_id", channels().select("c.id")).select("message.id");
      rules.updateId = () => db("project_updates").where({ project_id: projectId, is_draft: false }).whereIn("id", targets.updateId ?? []).select("id");
      const entries = await Promise.all(Object.entries(targets).filter(([key, ids]) => ids.length && rules[key]).map(async ([key]) => [key, new Set((await rules[key]!()).map((row) => row.id))] as const));
      return Object.fromEntries(entries);
    },
  };
}
