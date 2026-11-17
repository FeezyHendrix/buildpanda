import type { Knex } from "knex";
import type { TaskEntityLink } from "./types.ts";

/** Batched target checks keep stale or cross-project links out of task details. */
export function taskEntityAccessRepository(db: Knex) {
  return {
    async visible(projectId: string, links: readonly Pick<TaskEntityLink, "entityType" | "entityId">[], sharedRfisOnly: boolean): Promise<Set<string>> {
      const sources = { rfi: "rfis", change_request: "change_requests", material: "material_orders", invoice: "project_invoices", milestone_payment: "milestone_payments" } as const;
      const ids = await Promise.all(Object.entries(sources).map(async ([type, table]) => {
        const targetIds = links.filter((link) => link.entityType === type).map((link) => link.entityId);
        if (!targetIds.length) return [];
        const query = db(table).where("project_id", projectId).whereIn("id", targetIds);
        if (type === "rfi" && sharedRfisOnly) query.where("visibility", "shared");
        const rows = await query.select<{ id: string }[]>("id");
        return rows.map((row) => `${type}:${row.id}`);
      }));
      return new Set(ids.flat());
    },
  };
}
export type TaskEntityAccessRepository = ReturnType<typeof taskEntityAccessRepository>;
