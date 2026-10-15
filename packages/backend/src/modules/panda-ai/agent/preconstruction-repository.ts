import type { Knex } from "knex";

export function preconstructionAgentRepository(db: Knex) {
  return {
    boqItems(projectId: string) {
      return db("proposal_boq_items as item")
        .join("proposals as proposal", "proposal.id", "item.proposal_id")
        .where("proposal.project_id", projectId)
        .whereIn("proposal.status", ["Accepted", "Converted"])
        .orderBy("item.sort", "asc")
        .select(
          "proposal.id as proposal_id",
          "proposal.title as proposal_title",
          "proposal.status as proposal_status",
          "item.id",
          "item.group_label",
          "item.description",
          "item.qty",
          "item.unit",
        );
    },

    async acceptedEstimate(projectId: string) {
      const project = await db("projects")
        .where({ id: projectId })
        .select<{ estimate_id: string | null }>("estimate_id")
        .first();
      const estimate = await db("estimates as e")
        .join("proposals as p", "p.id", "e.proposal_id")
        .where("p.project_id", projectId)
        .modify((q) => {
          if (project?.estimate_id) q.where("e.id", project.estimate_id);
          else q.whereIn("e.status", ["Accepted", "Superseded", "Sent"]).orderBy("e.revision_no", "desc");
        })
        .select(
          "e.id",
          "e.revision_no",
          "e.status",
          "e.contingency_pct",
          "e.tax_label",
          "e.tax_pct",
          "e.subtotal",
          "e.tax_amount",
          "e.total",
          "e.accepted_at",
          "e.accepted_by_name",
          "p.id as proposal_id",
          "p.title as proposal_title",
          "p.currency",
        )
        .first();
      if (!estimate) return null;
      const [items, schedule] = await Promise.all([
        db("estimate_items").where({ estimate_id: estimate.id }).orderBy("sort", "asc").select("group_label", "description", "qty", "unit", "unit_rate", "total"),
        db("estimate_payment_schedule").where({ estimate_id: estimate.id }).orderBy("sort", "asc").select("label", "percent", "description"),
      ]);
      return { estimate, items, schedule };
    },
  };
}
