import type { Knex } from "knex";

export function contractAgentRepository(db: Knex) {
  return {
    milestonePayments(projectId: string) {
      return db("milestone_payments")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc")
        .select("id", "name", "phase", "status", "percent_complete", "amount", "proof_verified");
    },

    paymentClaims(projectId: string) {
      return db("payment_claims as pc")
        .leftJoin("milestone_payments as mp", "mp.id", "pc.milestone_payment_id")
        .where("pc.project_id", projectId)
        .orderBy("pc.created_at", "desc")
        .limit(100)
        .select(
          "pc.id",
          "pc.claim_number",
          "pc.status",
          "pc.amount",
          "pc.period_start",
          "pc.period_end",
          "pc.submitted_at",
          "pc.approved_at",
          "mp.name as milestone_name",
        );
    },
  };
}
