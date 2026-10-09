import type { Knex } from "knex";

/** Resolve existing entity links in one query, bounded by the caller's visible board. */
export function taskStageRepository(db: Knex) {
  return {
    async matchingIds(projectId: string, taskIds: string[], stageId: string): Promise<string[]> {
      if (taskIds.length === 0) return [];
      const rows = await db("task_entity_links as link")
        .join("tasks as task", "task.id", "link.task_id")
        .where("task.project_id", projectId)
        .where("link.project_id", projectId)
        .whereIn("task.id", taskIds)
        .where((query) => {
          query.where((q) => q.where("link.entity_type", "change_request").whereExists(
            db("change_requests as cr").select("cr.id")
              .where("cr.id", db.ref("link.entity_id"))
              .where("cr.project_id", projectId).where("cr.stage_id", stageId),
          ));
          query.orWhere((q) => q.where("link.entity_type", "material").whereExists(
            db("material_orders as material").select("material.id")
              .where("material.id", db.ref("link.entity_id"))
              .where("material.project_id", projectId).where("material.phase_id", stageId),
          ));
          query.orWhere((q) => q.where("link.entity_type", "invoice").whereExists(
            db("invoice_stage_lines as line").select("line.invoice_id")
              .where("line.invoice_id", db.ref("link.entity_id"))
              .where("line.project_id", projectId).where("line.stage_id", stageId),
          ));
          query.orWhere((q) => q.where("link.entity_type", "invoice").whereExists(
            db("project_invoices as invoice")
              .join("purchase_orders as po", "po.id", "invoice.po_reference_id")
              .select("invoice.id").where("invoice.id", db.ref("link.entity_id"))
              .where("invoice.project_id", projectId).where("po.project_id", projectId)
              .where("po.stage_id", stageId),
          ));
          query.orWhere((q) => q.where("link.entity_type", "rfi").whereExists(
            db("rfis as rfi").join("change_requests as cr", "cr.id", "rfi.change_request_id")
              .select("rfi.id").where("rfi.id", db.ref("link.entity_id"))
              .where("rfi.project_id", projectId).where("cr.project_id", projectId)
              .where("cr.stage_id", stageId),
          ));
        })
        .distinct("task.id");
      return rows.map((row: { id: string }) => row.id);
    },
  };
}
