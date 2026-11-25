import type { Knex } from "knex";
import { runQueries } from "../../lib/run-queries.ts";
import { applyTaskVisibility } from "../tasks/visibility-repository.ts";
import { applyExpenseVisibility } from "../transactions/visibility-repository.ts";
import type { MessagingReviewTargetScope } from "./review-access-types.ts";

export function messagingReadScopeRepository(db: Knex) {
  return {
    async visibleRecords(scope: MessagingReviewTargetScope) {
      const projectId = scope.projectId;
      const [tasks, expenses, rfis, updates, documents, channels] = await runQueries(db, [
        async () => scope.tasks ? applyTaskVisibility(db("tasks as t").where("t.project_id", projectId), db, scope.fullTasks ? undefined : scope.userId).select("t.id").orderBy("t.id") : [],
        async () => scope.expenses ? db("project_transactions").where({ project_id: projectId }).modify((query) => applyExpenseVisibility(query, scope.fullExpenses ? undefined : scope.userId)).select("id").orderBy("id") : [],
        async () => scope.rfis ? db("rfis").where({ project_id: projectId }).modify((query) => { if (!scope.internalRfis) query.where("visibility", "shared"); }).select("id").orderBy("id") : [],
        async () => scope.updates ? db("project_updates").where({ project_id: projectId, is_draft: false }).select("id").orderBy("id") : [],
        async () => scope.documents ? db("project_documents").where({ project_id: projectId }).select("id").orderBy("id") : [],
        async () => scope.projectMessages || scope.workspaceMessages ? db("channels as c").join("channel_members as m", "m.channel_id", "c.id").where("m.user_id", scope.userId).where((query) => {
          if (scope.projectMessages) query.orWhere("c.project_id", projectId);
          if (scope.workspaceMessages) query.orWhere((workspace) => workspace.whereNull("c.project_id").where((organization) => organization.where("c.organization_id", scope.organizationId).orWhereNull("c.organization_id")));
        }).select("c.id").orderBy("c.id") : [],
      ]);
      return { tasks, expenses, rfis, updates, documents, channels, privileges: { internalRfis: scope.internalRfis, fullTasks: scope.fullTasks, fullExpenses: scope.fullExpenses, projectMessages: scope.projectMessages, workspaceMessages: scope.workspaceMessages } };
    },
  };
}
