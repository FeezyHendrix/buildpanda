import type { Knex } from "knex";

export function contractAgentRepository(db: Knex) {
  return {
    milestonePayments(projectId: string) {
      return db("milestone_payments")
        .where({ project_id: projectId })
        .orderBy("sort_order", "asc")
        .select("id", "name", "phase", "status", "percent_complete", "amount", "proof_verified");
    },

    paymentSettings(projectId: string) {
      return db("project_finances")
        .where({ project_id: projectId })
        .first(
          "currency",
          "payment_models",
          "mobilization_advance",
          "mobilization_outstanding",
          "mobilization_amort_type",
          "mobilization_amort_value",
          "retention_held",
          "retention_rate",
          "retention_released_pc",
          "retention_released_dl",
        );
    },

    retentionReleases(projectId: string) {
      return db("retention_releases")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .limit(50)
        .select("stage", "amount", "status", "released_at", "released_by", "notes");
    },

    advanceAmortizations(projectId: string) {
      return db("advance_amortizations as aa")
        .leftJoin("milestone_payments as mp", "mp.id", "aa.milestone_id")
        .where("aa.project_id", projectId)
        .orderBy("aa.recovered_at", "desc")
        .limit(100)
        .select("aa.amount", "aa.recovered_at", "mp.name as milestone_name");
    },

    measuredWork(projectId: string) {
      return db("measured_work_records")
        .where({ project_id: projectId })
        .orderBy("created_at", "desc")
        .limit(200)
        .select(
          "description",
          "unit",
          "quantity",
          "unit_rate",
          "amount",
          "period_start",
          "period_end",
          "status",
          "certified_at",
        );
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
